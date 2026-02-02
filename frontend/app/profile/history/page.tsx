'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HistoryRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/profile/reading-history');
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      <p className="text-gray-400 mt-4">Mengalihkan...</p>
    </div>
  );
}
