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

export function isVideoFile(name: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return VIDEO_EXT.has(ext);
}

export function isAudioFile(name: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return AUDIO_EXT.has(ext);
}

export function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
