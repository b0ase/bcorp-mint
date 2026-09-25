import { redirect } from 'next/navigation';

// Phone-capture sessions are handled by bit-sign.online.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`https://bit-sign.online/capture/${encodeURIComponent(token)}`);
}
