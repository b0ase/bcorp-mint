import { redirect } from 'next/navigation';

// Identity verification happens in bChat (bit-sign.online).
export default function Page() {
  redirect('https://bit-sign.online');
}
