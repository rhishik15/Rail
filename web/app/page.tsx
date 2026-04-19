'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { isAuthenticated } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? '/inspections' : '/login');
  }, [router]);

  return <main style={{ padding: '2rem' }}>Loading...</main>;
}
