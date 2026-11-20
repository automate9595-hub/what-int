'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadTokens } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace(loadTokens() ? '/dashboard/' : '/login/'); }, [router]);
  return <p className="container muted">Cargando…</p>;
}
