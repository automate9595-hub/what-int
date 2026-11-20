'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { logout, Me } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

const ROLE: Record<string, string> = { SUPER_ADMIN: 'Superadministrador', TENANT_ADMIN: 'Administrador', OPERATOR: 'Operador' };

export default function Shell({ me, title, children }: { me: Me | null; title: string; children: ReactNode }) {
  const router = useRouter();
  const out = async () => { await logout(); router.replace('/login/'); };
  return (
    <>
      <header className="header">
        <div>
          <h1>{title}</h1>
          {me && <div className="who">{me.name} · {ROLE[me.role] ?? me.role}</div>}
        </div>
        <div className="row">
          <ThemeToggle />
          {me && <button type="button" className="btn secondary small" onClick={out}>Salir</button>}
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
