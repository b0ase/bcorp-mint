import React from 'react';
import MintApp from '@shared/app/MintApp';
import { PlatformProvider } from '@shared/lib/platform-context';
import { electronPlatform } from './lib/electron-platform';
import { DesktopNavigationProvider, useNavigation } from '@shared/lib/navigation-context';
import { DesktopAuthProvider, useAuth } from '@shared/lib/auth-context';
import { DesktopApiClientProvider } from '@shared/lib/api-client';
import { ToastProvider } from '@shared/components/Toast';
import BottomNav from '@shared/components/BottomNav';

// Shared pages
import VaultPage from '@shared/app/VaultPage';
import HashPage from '@shared/app/HashPage';
import SignPage from '@shared/app/SignPage';
import IdentityPage from '@shared/app/IdentityPage';

// Desktop-only components
import FlipBookView from './components/FlipBookView';
import FrameBrowser from './components/FrameBrowser';
import WaveformEditor from './components/WaveformEditor';
import MusicCanvas from './components/MusicCanvas';
import MusicPanel from './components/MusicPanel';
import DocumentHashPanel from './components/DocumentHashPanel';

// Desktop-only hooks
import { useTokenisation } from './hooks/useTokenisation';
import { useWalletManager } from './hooks/useWalletManager';
import { useMusicEditor } from './hooks/useMusicEditor';

const desktopComponents = {
  FlipBookView,
  FrameBrowser,
  WaveformEditor,
  MusicCanvas,
  MusicPanel,
  DocumentHashPanel,
};

function SectionRouter() {
  const { currentSection } = useNavigation();
  const { authToken } = useAuth();

  return (
    <DesktopApiClientProvider authToken={authToken}>
      <div className="min-h-screen pb-20">
        {currentSection === 'mint' && (
          <MintApp
            desktopComponents={desktopComponents}
            useTokenisationHook={useTokenisation}
            useWalletManagerHook={useWalletManager}
            useMusicEditorHook={useMusicEditor}
          />
        )}
        {currentSection === 'hash' && <HashPage />}
        {currentSection === 'vault' && <VaultPage />}
        {currentSection === 'sign' && <SignPage />}
        {currentSection === 'identity' && <IdentityPage />}
      </div>
      <BottomNav />
    </DesktopApiClientProvider>
  );
}

export default function App() {
  return (
    <PlatformProvider value={electronPlatform}>
      <DesktopNavigationProvider>
        <DesktopAuthProvider>
          <ToastProvider>
            <SectionRouter />
          </ToastProvider>
        </DesktopAuthProvider>
      </DesktopNavigationProvider>
    </PlatformProvider>
  );
}
