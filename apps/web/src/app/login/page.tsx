'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { api, errMsg, saveTokens, Tokens } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const t = await api<Tokens>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
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
        <h2>Iniciar sesión</h2>
        {error && <div className="msg err">{error}</div>}
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ marginTop: 16 }}><button className="btn" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button></div>
        <p className="muted">¿No tenés cuenta? <Link href="/register/">Registrá tu empresa</Link></p>
      </form>
    </div>
  );
}
