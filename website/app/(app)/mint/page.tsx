'use client';

import MintApp from '@shared/app/MintApp';
import { PlatformProvider } from '@shared/lib/platform-context';
import { browserPlatform } from '@/lib/browser-platform';

export default function MintPage() {
  return (
    <PlatformProvider value={browserPlatform}>
      <MintApp showDownloadButton />
    </PlatformProvider>
  );
}
