'use client';

import { usePathname, useRouter } from 'next/navigation';
import BottomNav from '@shared/components/BottomNav';
import { ToastProvider } from '@shared/components/Toast';
import { WebNavigationProvider, pathnameToSection, sectionToPathname } from '@shared/lib/navigation-context';
import { WebAuthProvider } from '@shared/lib/auth-context';
import { WebApiClientProvider } from '@shared/lib/api-client';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <WebAuthProvider>
      <WebApiClientProvider>
        <WebNavigationProvider
          currentSection={pathnameToSection(pathname)}
          onNavigate={(section) => router.push(sectionToPathname(section))}
        >
          <ToastProvider>
            <div className="min-h-screen pb-20">
              {children}
            </div>
            <BottomNav />
          </ToastProvider>
        </WebNavigationProvider>
      </WebApiClientProvider>
    </WebAuthProvider>
  );
}
