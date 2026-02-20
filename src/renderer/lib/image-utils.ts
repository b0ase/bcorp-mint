export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

export const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.avi']);
export const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);

export function isVideoFile(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  return VIDEO_EXT.has(ext);
}

export function isAudioFile(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  return AUDIO_EXT.has(ext);
}

export function mediaStreamUrl(filePath: string): string {
  return `npg-media://media?path=${encodeURIComponent(filePath)}`;
}

export const loadVideoThumbnail = (
  streamUrl: string
): Promise<{ width: number; height: number; thumbnailUrl: string }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail extraction timed out'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnailUrl
        });
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error(`Failed to load video: ${streamUrl}`));
    };

    video.src = streamUrl;
  });
};
