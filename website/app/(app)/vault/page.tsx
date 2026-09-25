import { redirect } from 'next/navigation';

// The signature vault was a stale fork of bit-sign. It now lives at bit-sign.online.
export default function Page() {
  redirect('https://bit-sign.online');
}
