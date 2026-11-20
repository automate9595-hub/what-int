'use client';
import { useEffect } from 'react';

export default function ThemeToggle() {
  useEffect(() => {
    try {
      const t = window.localStorage.getItem('aiba.theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch { /* sin almacenamiento */ }
  }, []);

  const toggle = () => {
    const cur = document.documentElement.dataset.theme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem('aiba.theme', next); } catch { /* sin almacenamiento */ }
  };

  return <button type="button" className="btn secondary small" onClick={toggle}>Claro / Oscuro</button>;
}
