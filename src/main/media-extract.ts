import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';

type ProbeResult = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  channels: number;
  codec: string;
  hasVideo: boolean;
  hasAudio: boolean;
};

type ExtractOptions = {
  interval?: number; // seconds between frames (default 1)
  maxFrames?: number; // cap (default 500)
  quality?: 'low' | 'medium' | 'high'; // jpeg 60%, jpeg 85%, png
};

// Lazy-resolved dev path
let _devFfmpegPath: string | null = null;

function getFfmpegPath(): string {
  // In packaged app, ffmpeg is in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'ffmpeg');
  }
  // In development, resolve ffmpeg binary from node_modules directly
  // (avoids require('ffmpeg-static') which ESM linker chokes on in asar)
  if (_devFfmpegPath === null) {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    // Walk up from out/main/ to project root
    const root = path.resolve(thisDir, '..', '..');
    const candidate = path.join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg');
    if (existsSync(candidate)) {
      _devFfmpegPath = candidate;
    } else {
      throw new Error('ffmpeg-static binary not found at ' + candidate + '. Run: pnpm install');
    }
  }
  if (!_devFfmpegPath) throw new Error('ffmpeg-static binary not found');
  return _devFfmpegPath;
}

function ffprobe(filePath: string): Promise<string> {
  const ffmpeg = getFfmpegPath();
  // ffprobe is next to ffmpeg
  const ffprobePath = ffmpeg.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');

  return new Promise((resolve, reject) => {
    // Use ffmpeg -i for probing since ffmpeg-static doesn't include ffprobe
    execFile(ffmpeg, ['-i', filePath, '-f', 'null', '-'], { timeout: 10000 }, (err, stdout, stderr) => {
      // ffmpeg -i always exits with error, but stderr has the info
      resolve(stderr || stdout || '');
    });
  });
}

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const output = await ffprobe(filePath);

  const result: ProbeResult = {
    duration: 0,
    width: 0,
    height: 0,
    fps: 0,
    sampleRate: 0,
    channels: 0,
    codec: '',
    hasVideo: false,
    hasAudio: false
  };

  // Parse duration
  const durMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (durMatch) {
    result.duration =
      parseInt(durMatch[1]) * 3600 +
      parseInt(durMatch[2]) * 60 +
      parseInt(durMatch[3]) +
      parseInt(durMatch[4]) / 100;
  }

  // Parse video stream
  const videoMatch = output.match(/Stream.*Video:\s*(\w+).*?,\s*(\d+)x(\d+)/);
  if (videoMatch) {
    result.hasVideo = true;
    result.codec = videoMatch[1];
    result.width = parseInt(videoMatch[2]);
    result.height = parseInt(videoMatch[3]);
  }

  // Parse fps
  const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (fpsMatch) {
    result.fps = parseFloat(fpsMatch[1]);
  }

  // Parse audio stream
  const audioMatch = output.match(/Stream.*Audio:\s*(\w+).*?,\s*(\d+)\s*Hz.*?,\s*(mono|stereo|\d+\s*channels)/);
  if (audioMatch) {
    result.hasAudio = true;
    if (!result.codec) result.codec = audioMatch[1];
    result.sampleRate = parseInt(audioMatch[2]);
    if (audioMatch[3] === 'mono') result.channels = 1;
    else if (audioMatch[3] === 'stereo') result.channels = 2;
    else {
      const chMatch = audioMatch[3].match(/(\d+)/);
      result.channels = chMatch ? parseInt(chMatch[1]) : 2;
    }
  }

  return result;
}

function createTempDir(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return path.join(app.getPath('temp'), `mint-${id}`);
}

function sendProgress(channel: string, data: { completed: number; total: number; stage: string }) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send(channel, data);
}

export async function extractVideoFrames(
  filePath: string,
  outputDir: string,
  options: ExtractOptions = {}
): Promise<{ frames: Array<{ path: string; index: number; timestamp: number }>; outputDir: string }> {
  const interval = options.interval ?? 1;
  const maxFrames = options.maxFrames ?? 500;
  const quality = options.quality ?? 'medium';

  const dir = outputDir || createTempDir();
  await fs.mkdir(dir, { recursive: true });

  const ext = quality === 'high' ? 'png' : 'jpg';
  const qFlag = quality === 'low' ? '8' : quality === 'medium' ? '3' : '2';
  const pattern = path.join(dir, `frame-%05d.${ext}`);

  const args = [
    '-i', filePath,
    '-vf', `fps=1/${interval}`,
    '-frames:v', String(maxFrames),
    ...(ext === 'jpg' ? ['-q:v', qFlag] : []),
    '-y',
    pattern
  ];

  const ffmpeg = getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    const proc = execFile(ffmpeg, args, { timeout: 300000 }, (err) => {
      if (err && !err.killed) {
        // ffmpeg may exit with code 1 but still produce frames
        // only reject if no frames were produced
      }
      resolve();
    });

    // Parse progress from stderr
    if (proc.stderr) {
      let lastFrame = 0;
      proc.stderr.on('data', (data: string) => {
        const frameMatch = data.toString().match(/frame=\s*(\d+)/);
        if (frameMatch) {
          const frame = parseInt(frameMatch[1]);
          if (frame > lastFrame) {
            lastFrame = frame;
            sendProgress('extraction-progress', { completed: frame, total: maxFrames, stage: 'Extracting frames...' });
          }
        }
      });
    }
  });

  // Collect generated frames
  const entries = await fs.readdir(dir);
  const frameFiles = entries
    .filter((f) => f.startsWith('frame-') && (f.endsWith('.jpg') || f.endsWith('.png')))
    .sort();

  const frames = frameFiles.map((f, i) => ({
    path: path.join(dir, f),
    index: i,
    timestamp: i * interval
  }));

  sendProgress('extraction-progress', { completed: frames.length, total: frames.length, stage: 'Done' });

  return { frames, outputDir: dir };
}

export async function extractAudioSegment(
  filePath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<string> {
  const ffmpeg = getFfmpegPath();
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  const args = [
    '-i', filePath,
    '-ss', String(startTime),
    '-to', String(endTime),
    '-c', 'copy',
    '-y',
    outputPath
  ];

  await new Promise<void>((resolve, reject) => {
    execFile(ffmpeg, args, { timeout: 60000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return outputPath;
}

export async function getAudioPeaks(filePath: string, numSamples: number = 2000): Promise<number[]> {
  const ffmpeg = getFfmpegPath();

  // Use ffmpeg to extract raw audio samples, then compute peaks
  const args = [
    '-i', filePath,
    '-ac', '1', // mono
    '-ar', String(Math.max(numSamples * 2, 8000)), // downsample
    '-f', 'f32le', // 32-bit float raw
    '-acodec', 'pcm_f32le',
    '-vn', // no video
    'pipe:1'
  ];

  return new Promise((resolve, reject) => {
    const proc = execFile(ffmpeg, args, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024, timeout: 30000 } as any, (err, stdout: any) => {
      if (err && !stdout) {
        reject(err);
        return;
      }

      const buf = Buffer.from(stdout);
      const floats = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));

      if (floats.length === 0) {
        resolve(new Array(numSamples).fill(0));
        return;
      }

      // Bin into numSamples peaks
      const samplesPerBin = Math.max(1, Math.floor(floats.length / numSamples));
      const peaks: number[] = [];

      for (let i = 0; i < numSamples; i++) {
        const start = i * samplesPerBin;
        const end = Math.min(start + samplesPerBin, floats.length);
        let max = 0;
        for (let j = start; j < end; j++) {
          const abs = Math.abs(floats[j]);
          if (abs > max) max = abs;
        }
        peaks.push(max);
      }

      // Normalize to 0-1
      const globalMax = Math.max(...peaks, 0.001);
      resolve(peaks.map((p) => p / globalMax));
    });
  });
}

export async function generateWaveformImage(
  filePath: string,
  outputPath: string,
  options: { width?: number; height?: number; color?: string } = {}
): Promise<string> {
  const ffmpeg = getFfmpegPath();
  const width = options.width ?? 800;
  const height = options.height ?? 120;
  const color = options.color ?? '#ff2d78';

  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  const args = [
    '-i', filePath,
    '-filter_complex',
    `aformat=channel_layouts=mono,showwavespic=s=${width}x${height}:colors=${color}`,
    '-frames:v', '1',
    '-y',
    outputPath
  ];

  await new Promise<void>((resolve, reject) => {
    execFile(ffmpeg, args, { timeout: 30000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return outputPath;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    // Safety: only delete dirs in the temp folder that match our pattern
    const tempBase = app.getPath('temp');
    if (!dir.startsWith(tempBase) || !path.basename(dir).startsWith('mint-')) {
      return;
    }
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Cleanup all mint temp dirs on quit
export function registerCleanupOnQuit(): void {
  app.on('before-quit', async () => {
    try {
      const tempBase = app.getPath('temp');
      const entries = await fs.readdir(tempBase, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('mint-')) {
          await fs.rm(path.join(tempBase, entry.name), { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch {
      // Ignore
    }
  });
}
