'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { api, errMsg, saveTokens, Tokens } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ businessName: '', name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const t = await api<Tokens>('/auth/register', { method: 'POST', body: f, auth: false });
      saveTokens(t);
      router.replace('/dashboard/');
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="narrow">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>AI Business Assistant</strong><ThemeToggle />
      </div>
      <form className="card" onSubmit={submit}>
        <h2>Registrá tu empresa</h2>
        {error && <div className="msg err">{error}</div>}
        <label htmlFor="b">Nombre del negocio</label>
        <input id="b" required minLength={2} value={f.businessName} onChange={set('businessName')} />
        <label htmlFor="n">Tu nombre</label>
        <input id="n" required minLength={2} autoComplete="name" value={f.name} onChange={set('name')} />
        <label htmlFor="e">Correo</label>
        <input id="e" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        <label htmlFor="p">Contraseña (mínimo 10 caracteres)</label>
        <input id="p" type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={set('password')} />
        <div style={{ marginTop: 16 }}><button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button></div>
        <p className="muted">Incluye 14 días de prueba. ¿Ya tenés cuenta? <Link href="/login/">Iniciá sesión</Link></p>
      </form>
    </div>
  );
}
