import React from 'react';
import MintApp from '@shared/app/MintApp';
import { PlatformProvider } from '@shared/lib/platform-context';
import { electronPlatform } from './lib/electron-platform';

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

export default function App() {
  return (
    <PlatformProvider value={electronPlatform}>
      <MintApp
        desktopComponents={desktopComponents}
        useTokenisationHook={useTokenisation}
        useWalletManagerHook={useWalletManager}
        useMusicEditorHook={useMusicEditor}
      />
    </PlatformProvider>
  );
}
