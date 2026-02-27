'use client';

import { useRouter } from 'next/navigation';
import NewDocumentPage from '@shared/app/NewDocumentPage';

export default function Page() {
  const router = useRouter();
  return <NewDocumentPage onBack={() => router.push('/sign')} />;
}
