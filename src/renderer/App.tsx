import React from 'react';
import MintApp from '@shared/app/MintApp';
import { PlatformProvider } from '@shared/lib/platform-context';
import { electronPlatform } from './lib/electron-platform';
import { DesktopNavigationProvider, useNavigation } from '@shared/lib/navigation-context';
import { DesktopAuthProvider, useAuth } from '@shared/lib/auth-context';
import { DesktopApiClientProvider } from '@shared/lib/api-client';
import { ToastProvider } from '@shared/components/Toast';
import TopNav from '@shared/components/TopNav';

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
import PatentInscriptionPanel from './components/PatentInscriptionPanel';

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
  PatentInscriptionPanel,
};

/** Section labels for the page header */
const sectionLabels: Record<string, string> = {
  hash: 'Hash',
  vault: 'Vault',
  sign: 'Sign',
  identity: 'Identity',
};

/**
 * Wraps non-Mint pages in the same app shell (topbar, panel layout, gold chrome).
 * Uses the .app / .topbar / .main CSS classes from mint-app.css.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  const { currentSection, navigate } = useNavigation();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button
            onClick={() => navigate('mint')}
            className="brand-title"
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            The Bitcoin Corporation <span className="brand-accent">Mint</span>
          </button>
          <span style={{
            fontSize: 11,
            color: 'var(--accent)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '2px 10px',
            borderRadius: 4,
            border: '1px solid rgba(201, 168, 76, 0.15)',
            background: 'rgba(201, 168, 76, 0.05)',
          }}>
            {sectionLabels[currentSection] || currentSection}
          </span>
        </div>
        <TopNav />
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function SectionRouter() {
  const { currentSection } = useNavigation();
  const { authToken } = useAuth();

  return (
    <DesktopApiClientProvider authToken={authToken}>
      {currentSection === 'mint' ? (
        <MintApp
          desktopComponents={desktopComponents}
          useTokenisationHook={useTokenisation}
          useWalletManagerHook={useWalletManager}
          useMusicEditorHook={useMusicEditor}
        />
      ) : (
        <PageShell>
          {currentSection === 'hash' && <HashPage />}
          {currentSection === 'vault' && <VaultPage />}
          {currentSection === 'sign' && <SignPage />}
          {currentSection === 'identity' && <IdentityPage />}
        </PageShell>
      )}
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
