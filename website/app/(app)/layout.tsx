'use client';

import './app.css';
import { usePathname, useRouter } from 'next/navigation';
import BottomNav from '@shared/components/BottomNav';
import { ToastProvider } from '@shared/components/Toast';
import { WebNavigationProvider, pathnameToSection, sectionToPathname } from '@shared/lib/navigation-context';
import { WebAuthProvider } from '@shared/lib/auth-context';
import { WebApiClientProvider } from '@shared/lib/api-client';
import { useBWallet } from '@shared/lib/bwallet';

/**
 * App frame: a full-height column with the page in a scroll container and the
 * section bar as a normal flex child underneath. No fixed elements at the
 * viewport edges, 100dvh not 100vh, safe-area padding via env().
 *
 * Inside bWallet the wallet provides navigation and Back, so the section bar
 * is dropped and the page gets the whole frame (bApp standard, section 2).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { inWallet } = useBWallet();

  return (
    <WebAuthProvider>
      <WebApiClientProvider>
        <WebNavigationProvider
          currentSection={pathnameToSection(pathname)}
          onNavigate={(section) => router.push(sectionToPathname(section))}
        >
          <ToastProvider>
            <div className={`app-frame ${inWallet ? 'app-frame--in-wallet' : ''}`}>
              <main className="app-frame-main">{children}</main>
              {/* Vault and Identity live at bit-sign.online now; in a PWA a tab that
                  leaves the app is a trap, so the bar only lists sections served here. */}
              {!inWallet && <BottomNav sections={['mint', 'hash', 'sign']} />}
            </div>
          </ToastProvider>
        </WebNavigationProvider>
      </WebApiClientProvider>
    </WebAuthProvider>
  );
}
