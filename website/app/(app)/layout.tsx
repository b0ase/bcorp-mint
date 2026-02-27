'use client';

import BottomNav from '@shared/components/BottomNav';
import { ToastProvider } from '@shared/components/Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen pb-20">
        {children}
      </div>
      <BottomNav />
    </ToastProvider>
  );
}
