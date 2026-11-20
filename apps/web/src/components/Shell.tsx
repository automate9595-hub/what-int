'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { logout, Me } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/labels';
import ThemeToggle from './ThemeToggle';

const NAV: [string, string][] = [
  ['/dashboard/', 'Resumen'], ['/mensajes/', 'Mensajes'], ['/agenda/', 'Agenda'], ['/clientes/', 'Clientes'],
  ['/servicios/', 'Servicios'], ['/horarios/', 'Horarios'], ['/agentes/', 'Agentes'],
];

export default function Shell({ me, title, children }: { me: Me | null; title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const out = async () => { await logout(); router.replace('/login/'); };
  return (
    <>
      <header className="header">
        <div>
          <h1>{title}</h1>
          {me && <div className="who">{me.name} · {ROLE_LABEL[me.role] ?? me.role}</div>}
        </div>
        <div className="row">
          <ThemeToggle />
          {me && <button type="button" className="btn secondary small" onClick={out}>Salir</button>}
        </div>
      </header>
      {me && me.role !== 'SUPER_ADMIN' && (
        <nav className="nav">
          {NAV.map(([href, label]) => (<Link key={href} href={href} className={pathname === href ? 'active' : ''}>{label}</Link>))}
        </nav>
      )}
      <main className="container">{children}</main>
    </>
  );
}
