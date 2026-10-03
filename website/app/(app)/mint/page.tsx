'use client';

import MintApp from '@shared/app/MintApp';
import { PlatformProvider } from '@shared/lib/platform-context';
import { browserPlatform } from '@/lib/browser-platform';
import { useWebWalletManager } from '@/lib/use-web-wallet-manager';

export default function MintPage() {
  return (
    <PlatformProvider value={browserPlatform}>
      <MintApp showDownloadButton useWalletManagerHook={useWebWalletManager} />
    </PlatformProvider>
  );
}
