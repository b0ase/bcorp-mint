'use client';

import { useCallback } from 'react';
import VaultPage from '@shared/app/VaultPage';

export default function Page() {
  const pdfToImage = useCallback(async (arrayBuffer: ArrayBuffer) => {
    const { pdfToImage } = await import('@/lib/pdf-to-image');
    return pdfToImage(arrayBuffer);
  }, []);

  return <VaultPage pdfToImageFn={pdfToImage} />;
}
