'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, errMsg, Plan } from '@/lib/api';

const initial = {
  name: '', planCode: '', trialDays: '14', contactPhone: '', address: '', city: '', province: '', country: 'Argentina',
  adminName: '', adminEmail: '', adminPassword: '', numbers: '', mode: 'PLATFORM',
};

export default function NewTenantForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Plan[]>('/admin/plans')
      .then((p) => {
        const active = p.filter((x) => x.isActive);
        setPlans(active);
        if (active[0]) setF((s) => ({ ...s, planCode: s.planCode || active[0].code }));
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const set = (k: keyof typeof initial) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const numbers = f.numbers.split('\n').map((x) => x.trim()).filter(Boolean).map((phone) => ({ phone, mode: f.mode }));
      const trial = Number(f.trialDays);
      const body = {
        name: f.name, planCode: f.planCode, trialDays: trial > 0 ? trial : undefined,
        contactPhone: f.contactPhone || undefined, address: f.address || undefined, city: f.city || undefined,
        province: f.province || undefined, country: f.country || undefined,
        admin: { name: f.adminName, email: f.adminEmail, password: f.adminPassword },
        numbers: numbers.length ? numbers : undefined,
      };
      const t = await api<{ id: string }>('/admin/tenants', { method: 'POST', body });
      onDone(t.id);
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Nueva empresa</h2>
      {error && <div className="msg err">{error}</div>}
      <div className="grid">
        <div><label>Nombre de la empresa</label><input required minLength={2} value={f.name} onChange={set('name')} /></div>
        <div>
          <label>Plan</label>
          <select required value={f.planCode} onChange={set('planCode')}>
            {plans.map((p) => (<option key={p.id} value={p.code}>{p.name}</option>))}
          </select>
        </div>
        <div><label>Días de prueba (0 = suscripción activa por 30 días)</label><input inputMode="numeric" value={f.trialDays} onChange={set('trialDays')} /></div>
        <div><label>Teléfono de contacto</label><input value={f.contactPhone} onChange={set('contactPhone')} /></div>
        <div><label>Dirección</label><input value={f.address} onChange={set('address')} /></div>
        <div><label>Ciudad</label><input value={f.city} onChange={set('city')} /></div>
        <div><label>Provincia</label><input value={f.province} onChange={set('province')} /></div>
        <div><label>País</label><input value={f.country} onChange={set('country')} /></div>
      </div>
      <h2 style={{ marginTop: 18 }}>Administrador de la empresa</h2>
      <div className="grid">
        <div><label>Nombre</label><input required minLength={2} value={f.adminName} onChange={set('adminName')} /></div>
        <div><label>Correo</label><input type="email" required value={f.adminEmail} onChange={set('adminEmail')} /></div>
        <div><label>Contraseña inicial (mínimo 10)</label><input type="password" required minLength={10} autoComplete="new-password" value={f.adminPassword} onChange={set('adminPassword')} /></div>
      </div>
      <h2 style={{ marginTop: 18 }}>Números de WhatsApp (opcional)</h2>
      <label>Un número por línea, con código de país (ej. +5491155550000)</label>
      <textarea style={{ fontFamily: 'inherit' }} value={f.numbers} onChange={set('numbers')} />
      <label>Tipo de número</label>
      <select value={f.mode} onChange={set('mode')}>
        <option value="PLATFORM">Administrado por la plataforma</option>
        <option value="OWN">Propio del negocio</option>
      </select>
      <p className="muted">Los números quedan registrados como “Pendiente de conexión”. La conexión real con WhatsApp se hace en la Etapa 4.</p>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear empresa'}</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
