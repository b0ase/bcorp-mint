import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hasPrivateKey, savePrivateKey, loadPrivateKey, deletePrivateKey } from './keystore';
import { inscribeStamp } from './bsv';
import { getRedirectUrl, getWalletState, disconnect as walletDisconnect } from './handcash';
import { mintStampToken } from './token-mint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

const SUPPORTED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp'
]);

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
};

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.cjs');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
      win.loadURL(url);
    } else {
      win.loadURL('http://localhost:5173');
    }
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --------------- IPC handlers ---------------

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;

  const folder = result.filePaths[0];
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => path.join(folder, e.name))
    .filter((f) => SUPPORTED_EXT.has(path.extname(f).toLowerCase()));

  return { folder, files };
});

ipcMain.handle('open-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths;
});

ipcMain.handle('open-logo', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('choose-export-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (_e, payload: { dataUrl: string; defaultDir?: string; defaultName?: string }) => {
  const defaultPath =
    payload.defaultDir && payload.defaultName
      ? path.join(payload.defaultDir, payload.defaultName)
      : undefined;

  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const match = payload.dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data URL');
  await fs.writeFile(result.filePath, Buffer.from(match[2], 'base64'));
  return result.filePath;
});

ipcMain.handle('write-file', async (_e, payload: { dataUrl: string; folder: string; fileName: string }) => {
  const outPath = path.join(payload.folder, payload.fileName);
  const match = payload.dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data URL');
  await fs.writeFile(outPath, Buffer.from(match[2], 'base64'));
  return outPath;
});

// Read a local file and return a data: URL the renderer can use directly
ipcMain.handle('file-url', async (_e, filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = await fs.readFile(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('basename', (_e, filePath: string) => path.basename(filePath));

// --------------- Edition handlers ---------------

const getEditionsDir = () => {
  const dir = path.join(app.getPath('userData'), 'editions');
  return dir;
};

ipcMain.handle('get-editions-dir', async () => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
});

ipcMain.handle('list-editions', async () => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { id: string; name: string; filePath: string; updatedAt: string }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      results.push({
        id: data.id,
        name: data.name,
        filePath,
        updatedAt: data.updatedAt
      });
    } catch {
      // skip corrupt files
    }
  }

  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return results;
});

ipcMain.handle('save-edition', async (_e, editionJson: string) => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  const data = JSON.parse(editionJson);
  const filePath = path.join(dir, `${data.id}.json`);
  await fs.writeFile(filePath, editionJson, 'utf-8');
  return filePath;
});

ipcMain.handle('load-edition', async (_e, filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return raw;
});

// --------------- Issue maker handlers ---------------

ipcMain.handle('next-issue-number', async (_e, parentDir: string) => {
  const entries = await fs.readdir(parentDir, { withFileTypes: true });
  let max = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^npgx-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
});

ipcMain.handle('create-issue', async (_e, payload: {
  parentDir: string;
  issueNum: number;
  coverPath: string;
  bodyPaths: string[];
}) => {
  const padded = String(payload.issueNum).padStart(3, '0');
  const issueDir = path.join(payload.parentDir, `npgx-${padded}`);
  await fs.mkdir(issueDir, { recursive: true });

  // Copy cover
  const coverExt = path.extname(payload.coverPath);
  const coverDest = path.join(issueDir, `cover${coverExt}`);
  await fs.copyFile(payload.coverPath, coverDest);

  // Copy body images with sequential naming
  const bodyDests: string[] = [];
  for (let i = 0; i < payload.bodyPaths.length; i++) {
    const ext = path.extname(payload.bodyPaths[i]);
    const dest = path.join(issueDir, `${String(i + 1).padStart(3, '0')}${ext}`);
    await fs.copyFile(payload.bodyPaths[i], dest);
    bodyDests.push(dest);
  }

  return { issueDir, coverDest, bodyDests };
});

// --------------- Hashing handlers ---------------

ipcMain.handle('hash-file', async (_e, filePath: string) => {
  const buf = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const stat = await fs.stat(filePath);
  return { hash, size: stat.size };
});

ipcMain.handle('hash-files-batch', async (_e, filePaths: string[]) => {
  const results: { filePath: string; hash: string; size: number }[] = [];
  for (const filePath of filePaths) {
    const buf = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const stat = await fs.stat(filePath);
    results.push({ filePath, hash, size: stat.size });
  }
  return results;
});

// --------------- Stamp receipt handlers ---------------

const getStampsDir = () => path.join(app.getPath('userData'), 'stamps');

ipcMain.handle('save-stamp-receipt', async (_e, receiptJson: string) => {
  const dir = getStampsDir();
  await fs.mkdir(dir, { recursive: true });
  const receipt = JSON.parse(receiptJson);
  const filePath = path.join(dir, `${receipt.id}.stamp.json`);
  await fs.writeFile(filePath, receiptJson, 'utf-8');
  return filePath;
});

ipcMain.handle('list-stamp-receipts', async () => {
  const dir = getStampsDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const receipts: unknown[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.stamp.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, entry.name), 'utf-8');
      receipts.push(JSON.parse(raw));
    } catch { /* skip corrupt */ }
  }
  return receipts;
});

ipcMain.handle('update-stamp-receipt', async (_e, payload: { id: string; patch: Record<string, unknown> }) => {
  const dir = getStampsDir();
  const filePath = path.join(dir, `${payload.id}.stamp.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const receipt = JSON.parse(raw);
  Object.assign(receipt, payload.patch);
  await fs.writeFile(filePath, JSON.stringify(receipt, null, 2), 'utf-8');
  return receipt;
});

// --------------- Wallet handlers ---------------

ipcMain.handle('wallet-connect', async () => {
  try {
    const url = await getRedirectUrl();
    await shell.openExternal(url);
    // Wait for callback (profile will be populated)
    return getWalletState();
  } catch (err) {
    console.error('[wallet-connect]', err);
    return getWalletState();
  }
});

ipcMain.handle('wallet-status', async () => getWalletState());

ipcMain.handle('wallet-disconnect', async () => {
  walletDisconnect();
});

// --------------- Blockchain handlers ---------------

ipcMain.handle('inscribe-stamp', async (_e, payload: { path: string; hash: string; timestamp: string }) => {
  return inscribeStamp(payload);
});

ipcMain.handle('mint-stamp-token', async (_e, payload: { path: string; hash: string; name: string }) => {
  return mintStampToken(payload);
});

// --------------- Keystore handlers ---------------

ipcMain.handle('keystore-has-key', async () => hasPrivateKey());
ipcMain.handle('keystore-save-key', async (_e, wif: string) => savePrivateKey(wif));
ipcMain.handle('keystore-delete-key', async () => deletePrivateKey());

// --------------- ComfyUI integration ---------------

const COMFY_HOST = '127.0.0.1';
const COMFY_PORT = 8188;

function comfyFetch(urlPath: string, options: { method?: string; body?: Buffer | string; headers?: Record<string, string> } = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: COMFY_HOST, port: COMFY_PORT, path: urlPath, method: options.method || 'GET', headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Check if ComfyUI is running
ipcMain.handle('comfyui-check', async () => {
  try {
    const res = await comfyFetch('/system_stats');
    return res.status === 200;
  } catch {
    return false;
  }
});

// List available video models from ComfyUI (checks both checkpoint and UNET loaders)
ipcMain.handle('comfyui-list-models', async () => {
  try {
    const models: string[] = [];

    // Check ImageOnlyCheckpointLoader (SVD-style models)
    try {
      const res = await comfyFetch('/object_info/ImageOnlyCheckpointLoader');
      if (res.status === 200) {
        const data = JSON.parse(res.body.toString());
        const names = data.ImageOnlyCheckpointLoader?.input?.required?.ckpt_name?.[0];
        if (Array.isArray(names)) models.push(...names);
      }
    } catch { /* ignore */ }

    // Check UNETLoader (Wan 2.1, etc.)
    try {
      const res = await comfyFetch('/object_info/UNETLoader');
      if (res.status === 200) {
        const data = JSON.parse(res.body.toString());
        const names = data.UNETLoader?.input?.required?.unet_name?.[0];
        if (Array.isArray(names)) models.push(...names);
      }
    } catch { /* ignore */ }

    return models;
  } catch {
    return [];
  }
});

// Upload an image to ComfyUI and return its filename
async function comfyUploadImage(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const boundary = '----NPGBoundary' + Date.now();

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
  body += `Content-Type: application/octet-stream\r\n\r\n`;

  const header = Buffer.from(body, 'utf-8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const multipart = Buffer.concat([header, fileBuffer, footer]);

  const res = await comfyFetch('/upload/image', {
    method: 'POST',
    body: multipart,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
  });

  if (res.status !== 200) throw new Error(`Upload failed: ${res.status}`);
  const data = JSON.parse(res.body.toString());
  return data.name;
}

// Detect model type from filename
function detectModelType(modelName: string): 'wan' | 'svd' {
  const lower = modelName.toLowerCase();
  if (lower.includes('wan')) return 'wan';
  return 'svd';
}

// Build a Wan 2.1 img2vid workflow
function buildWanWorkflow(imageName: string, frames: number, fps: number, modelName: string) {
  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: modelName, weight_dtype: 'default' }
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan' }
    },
    '3': {
      class_type: 'CLIPVisionLoader',
      inputs: { clip_name: 'clip_vision_h.safetensors' }
    },
    '4': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'wan_2.1_vae.safetensors' }
    },
    '5': {
      class_type: 'LoadImage',
      inputs: { image: imageName, upload: 'image' }
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'cinematic smooth motion, high quality animation', clip: ['2', 0] }
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'blurry, distorted, low quality, static', clip: ['2', 0] }
    },
    '8': {
      class_type: 'CLIPVisionEncode',
      inputs: { clip_vision: ['3', 0], image: ['5', 0], crop: 'center' }
    },
    '9': {
      class_type: 'WanImageToVideo',
      inputs: {
        positive: ['6', 0],
        negative: ['7', 0],
        vae: ['4', 0],
        width: 832,
        height: 480,
        length: frames,
        batch_size: 1,
        clip_vision_output: ['8', 0],
        start_image: ['5', 0]
      }
    },
    '10': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 20,
        cfg: 3.0,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['9', 0],
        negative: ['9', 1],
        latent_image: ['9', 2]
      }
    },
    '11': {
      class_type: 'VAEDecode',
      inputs: { samples: ['10', 0], vae: ['4', 0] }
    },
    '12': {
      class_type: 'CreateVideo',
      inputs: { images: ['11', 0], fps: fps }
    },
    '13': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['12', 0],
        filename_prefix: 'npg_animate',
        format: 'mp4',
        codec: 'h264'
      }
    }
  };
}

// Build an SVD img2vid workflow (for SVD checkpoints)
function buildSvdWorkflow(imageName: string, frames: number, fps: number, motionStrength: number, modelName: string) {
  return {
    '1': {
      class_type: 'ImageOnlyCheckpointLoader',
      inputs: { ckpt_name: modelName }
    },
    '2': {
      class_type: 'LoadImage',
      inputs: { image: imageName, upload: 'image' }
    },
    '3': {
      class_type: 'SVD_img2vid_Conditioning',
      inputs: {
        width: 1024,
        height: 576,
        video_frames: frames,
        motion_bucket_id: Math.round(motionStrength * 255),
        fps: fps,
        augmentation_level: 0.0,
        clip_vision: ['1', 1],
        init_image: ['2', 0],
        vae: ['1', 2]
      }
    },
    '4': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 20,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['3', 0],
        negative: ['3', 1],
        latent_image: ['3', 2]
      }
    },
    '5': {
      class_type: 'VAEDecode',
      inputs: { samples: ['4', 0], vae: ['1', 2] }
    },
    '6': {
      class_type: 'CreateVideo',
      inputs: { images: ['5', 0], fps: fps }
    },
    '7': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['6', 0],
        filename_prefix: 'npg_animate',
        format: 'mp4',
        codec: 'h264'
      }
    }
  };
}

// Queue a prompt and wait for it to complete, return output info
async function comfyQueueAndWait(workflow: Record<string, unknown>, onProgress?: (pct: number) => void): Promise<{ images: string[]; videos: string[] }> {
  const clientId = 'npg-maker-' + Date.now();

  // Queue the prompt
  const promptPayload = JSON.stringify({ prompt: workflow, client_id: clientId });
  const queueRes = await comfyFetch('/prompt', {
    method: 'POST',
    body: promptPayload,
    headers: { 'Content-Type': 'application/json' }
  });

  if (queueRes.status !== 200) {
    const errText = queueRes.body.toString();
    throw new Error(`ComfyUI queue failed (${queueRes.status}): ${errText}`);
  }

  const { prompt_id } = JSON.parse(queueRes.body.toString());

  // Poll for completion
  for (let attempt = 0; attempt < 600; attempt++) { // up to 10 minutes
    await new Promise((r) => setTimeout(r, 1000));

    const histRes = await comfyFetch(`/history/${prompt_id}`);
    if (histRes.status !== 200) continue;

    const history = JSON.parse(histRes.body.toString());
    const entry = history[prompt_id];
    if (!entry) {
      // Check queue position for progress
      if (onProgress) {
        try {
          const qRes = await comfyFetch('/queue');
          const qData = JSON.parse(qRes.body.toString());
          const running = qData.queue_running?.length ?? 0;
          const pending = qData.queue_pending?.length ?? 0;
          if (running > 0) onProgress(0.5); // rough progress
          else if (pending === 0) onProgress(0.9);
        } catch { /* ignore */ }
      }
      continue;
    }

    // Done! Collect outputs
    const outputs: { images: string[]; videos: string[] } = { images: [], videos: [] };
    for (const nodeOutput of Object.values(entry.outputs || {})) {
      const out = nodeOutput as Record<string, unknown[]>;
      // VHS-style video output
      if (out.gifs) {
        for (const gif of out.gifs as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.videos.push(gif.filename);
        }
      }
      // Built-in SaveVideo output
      if (out.videos) {
        for (const vid of out.videos as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.videos.push(vid.filename);
        }
      }
      if (out.images) {
        for (const img of out.images as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.images.push(img.filename);
        }
      }
    }
    return outputs;
  }

  throw new Error('ComfyUI generation timed out');
}

// Main animate handler: upload image → queue workflow → wait → save result
ipcMain.handle('comfyui-animate', async (_e, payload: {
  imagePath: string;
  outputDir: string;
  frames?: number;
  fps?: number;
  motionStrength?: number;
  modelName?: string;
}) => {
  const frames = payload.frames ?? 25;
  const fps = payload.fps ?? 8;
  const motionStrength = payload.motionStrength ?? 0.5;
  const modelName = payload.modelName ?? 'svd_xt_1_1.safetensors';

  // 1. Upload the source image
  const uploadedName = await comfyUploadImage(payload.imagePath);

  // 2. Build and queue the workflow (pick based on model type)
  const modelType = detectModelType(modelName);
  const workflow = modelType === 'wan'
    ? buildWanWorkflow(uploadedName, frames, fps, modelName)
    : buildSvdWorkflow(uploadedName, frames, fps, motionStrength, modelName);
  const result = await comfyQueueAndWait(workflow);

  // 3. Download the output video
  const videoFile = result.videos[0];
  if (!videoFile) throw new Error('No video output from ComfyUI');

  const viewRes = await comfyFetch(`/view?filename=${encodeURIComponent(videoFile)}&type=output`);
  if (viewRes.status !== 200) throw new Error('Failed to download video from ComfyUI');

  // 4. Save to output directory
  await fs.mkdir(payload.outputDir, { recursive: true });
  const outPath = path.join(payload.outputDir, videoFile);
  await fs.writeFile(outPath, viewRes.body);

  return { videoPath: outPath, filename: videoFile };
});
