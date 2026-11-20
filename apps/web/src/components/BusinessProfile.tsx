'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, errMsg, TenantInfo } from '@/lib/api';
import { MODE, NUMBER_STATUS } from '@/lib/labels';

export default function BusinessProfile({ info, isAdmin, onSaved }: { info: TenantInfo; isAdmin: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', contactPhone: '', address: '', city: '', province: '', country: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setF({ name: info.name, contactPhone: info.contactPhone ?? '', address: info.address ?? '', city: info.city ?? '', province: info.province ?? '', country: info.country ?? '' });
  }, [info]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api('/tenant/me', { method: 'PATCH', body: f }); onSaved(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <div className="card">
        <h2>Números de WhatsApp</h2>
        {info.numbers.length === 0 && <p className="muted">Todavía no tenés números asignados. Los asigna el administrador de la plataforma.</p>}
        {info.numbers.map((n) => (
          <div className="item" key={n.id}>
            <div><strong>{n.phone}</strong> {n.label && <span className="sub">· {n.label}</span>}<div className="sub">{MODE[n.mode]}</div></div>
            <span className={`badge ${n.status === 'CONNECTED' ? 'ok' : 'warn'}`}>{NUMBER_STATUS[n.status]}</span>
          </div>
        ))}
      </div>
      {isAdmin && (
        <form className="card" onSubmit={submit}>
          <h2>Datos del negocio</h2>
          {error && <div className="msg err">{error}</div>}
          <div className="grid">
            <div><label>Nombre</label><input required minLength={2} value={f.name} onChange={set('name')} /></div>
            <div><label>Teléfono de contacto</label><input value={f.contactPhone} onChange={set('contactPhone')} /></div>
            <div><label>Dirección</label><input value={f.address} onChange={set('address')} /></div>
            <div><label>Ciudad</label><input value={f.city} onChange={set('city')} /></div>
            <div><label>Provincia</label><input value={f.province} onChange={set('province')} /></div>
            <div><label>País</label><input value={f.country} onChange={set('country')} /></div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn">Guardar datos</button></div>
        </form>
      )}
    </>
  );
}
