'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearTokens, errMsg, loadTokens, Me } from './api';

export function useAuth(area: 'admin' | 'tenant') {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!loadTokens()) { router.replace('/login/'); return; }
    api<Me>('/auth/me')
      .then((u) => {
        if (cancelled) return;
        const isSuper = u.role === 'SUPER_ADMIN';
        if (area === 'admin' && !isSuper) router.replace('/dashboard/');
        else if (area === 'tenant' && isSuper) router.replace('/admin/');
        else setMe(u);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { clearTokens(); router.replace('/login/'); }
        else setError(errMsg(e));
      });
    return () => { cancelled = true; };
  }, [area, router]);

  return { me, error };
}
