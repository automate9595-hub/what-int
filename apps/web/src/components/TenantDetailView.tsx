'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, Plan, TenantDetail } from '@/lib/api';
import { MODE, NUMBER_STATUS, ROLE_LABEL, SUB_STATUS } from '@/lib/labels';

const SUB_OPTIONS = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'];

export default function TenantDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [t, setT] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prof, setProf] = useState({ name: '', contactPhone: '', address: '', city: '', province: '', country: '', timezone: '' });
  const [sub, setSub] = useState({ planId: '', status: 'ACTIVE', end: '' });
  const [num, setNum] = useState({ phone: '', label: '', mode: 'PLATFORM' });
  const [pw, setPw] = useState<Record<string, string>>({});
  const [cf, setCf] = useState<{ id: string; phoneNumberId: string; wabaId: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const apply = (d: TenantDetail) => {
    setT(d);
    setProf({ name: d.name, contactPhone: d.contactPhone ?? '', address: d.address ?? '', city: d.city ?? '', province: d.province ?? '', country: d.country ?? '', timezone: d.timezone });
    setSub({ planId: d.subscription?.plan.id ?? '', status: d.subscription?.status ?? 'ACTIVE', end: d.subscription ? d.subscription.currentPeriodEnd.slice(0, 10) : '' });
  };

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api<TenantDetail>(`/admin/tenants/${id}`), api<Plan[]>('/admin/plans')]);
      setPlans(p);
      apply(d);
    } catch (e) { setError(errMsg(e)); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<TenantDetail | unknown>, done: string, isTenant = true) => {
    setError(null); setOk(null);
    try {
      const res = await fn();
      if (isTenant && res) apply(res as TenantDetail);
      setOk(done);
    } catch (e) { setError(errMsg(e)); }
  };

  if (!t) return <div className="card">{error ? <div className="msg err">{error}</div> : <p className="muted">Cargando…</p>}</div>;

  const saveProfile = () => {
    const { timezone, ...rest } = prof;
    return run(() => api(`/admin/tenants/${id}`, { method: 'PATCH', body: { ...rest, ...(timezone ? { timezone } : {}) } }), 'Datos guardados');
  };
  const saveSub = () => run(
    () => api(`/admin/tenants/${id}/subscription`, {
      method: 'PATCH',
      body: { planId: sub.planId || undefined, status: sub.status, currentPeriodEnd: sub.end ? new Date(`${sub.end}T23:59:00`).toISOString() : undefined },
    }),
    'Plan y suscripción guardados',
  );
  const toggle = () => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`¿${next === 'SUSPENDED' ? 'Suspender' : 'Reactivar'} la empresa "${t.name}"?`)) return;
    void run(() => api(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status: next } }), 'Estado actualizado');
  };
  const addNumber = () => run(async () => {
    const r = await api<TenantDetail>(`/admin/tenants/${id}/numbers`, { method: 'POST', body: { phone: num.phone, label: num.label || undefined, mode: num.mode } });
    setNum({ phone: '', label: '', mode: 'PLATFORM' });
    return r;
  }, 'Número agregado');
  const removeNumber = (nid: string, phone: string) => {
    if (!window.confirm(`¿Quitar el número ${phone}?`)) return;
    void run(() => api(`/admin/numbers/${nid}`, { method: 'DELETE' }), 'Número quitado');
  };
  const resetPw = (uid: string) => run(async () => {
    await api(`/admin/users/${uid}/password`, { method: 'POST', body: { password: pw[uid] } });
    setPw({ ...pw, [uid]: '' });
  }, 'Contraseña actualizada y sesiones cerradas', false);

  const connect = async () => {
    if (!cf) return;
    setError(null); setOk(null);
    try {
      const r = await api<{ webhookSubscribed: boolean; warning?: string }>(`/admin/numbers/${cf.id}/connect`, {
        method: 'POST',
        body: { phoneNumberId: cf.phoneNumberId.trim(), wabaId: cf.wabaId.trim() || undefined, accessToken: cf.token.trim() },
      });
      setCf(null);
      setOk(`Número conectado y verificado con Meta.${r.warning ? ` ${r.warning}` : ''}${r.webhookSubscribed ? '' : ' Recordá suscribir la app a los webhooks de la cuenta de WhatsApp en Meta.'}`);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };
  const disconnect = async (nid: string, phone: string) => {
    if (!window.confirm(`¿Desconectar el número ${phone}? Dejará de recibir y enviar mensajes.`)) return;
    setError(null); setOk(null);
    try { await api(`/admin/numbers/${nid}/disconnect`, { method: 'POST' }); setOk('Número desconectado'); await load(); } catch (e) { setError(errMsg(e)); }
  };

  const p = (k: keyof typeof prof) => (e: { target: { value: string } }) => setProf({ ...prof, [k]: e.target.value });

  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <button type="button" className="btn secondary small" onClick={onBack}>← Volver a empresas</button>
        <button type="button" className={`btn small ${t.status === 'ACTIVE' ? 'danger' : ''}`} onClick={toggle}>{t.status === 'ACTIVE' ? 'Suspender empresa' : 'Reactivar empresa'}</button>
      </div>
      {error && <div className="msg err">{error}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div className="card">
        <h2>{t.name} <span className={`badge ${t.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{t.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}</span></h2>
        <div className="grid">
          <div><label>Nombre</label><input value={prof.name} onChange={p('name')} /></div>
          <div><label>Teléfono de contacto</label><input value={prof.contactPhone} onChange={p('contactPhone')} /></div>
          <div><label>Dirección</label><input value={prof.address} onChange={p('address')} /></div>
          <div><label>Ciudad</label><input value={prof.city} onChange={p('city')} /></div>
          <div><label>Provincia</label><input value={prof.province} onChange={p('province')} /></div>
          <div><label>País</label><input value={prof.country} onChange={p('country')} /></div>
          <div><label>Zona horaria</label><input value={prof.timezone} onChange={p('timezone')} /></div>
        </div>
        <div style={{ marginTop: 14 }}><button type="button" className="btn" onClick={() => void saveProfile()}>Guardar datos</button></div>
      </div>

      <div className="card">
        <h2>Plan y suscripción</h2>
        <div className="grid">
          <div>
            <label>Plan</label>
            <select value={sub.planId} onChange={(e) => setSub({ ...sub, planId: e.target.value })}>
              {!sub.planId && <option value="">Elegí un plan</option>}
              {plans.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
            </select>
          </div>
          <div>
            <label>Estado</label>
            <select value={sub.status} onChange={(e) => setSub({ ...sub, status: e.target.value })}>
              {SUB_OPTIONS.map((s) => (<option key={s} value={s}>{SUB_STATUS[s]}</option>))}
            </select>
          </div>
          <div><label>Vence</label><input type="date" value={sub.end} onChange={(e) => setSub({ ...sub, end: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 14 }}><button type="button" className="btn" onClick={() => void saveSub()}>Guardar plan</button></div>
      </div>

      <div className="card">
        <h2>Números de WhatsApp</h2>
        {t.numbers.length === 0 && <p className="muted">Todavía no tiene números asignados.</p>}
        {t.numbers.map((n) => (
          <div className="item" key={n.id}>
            <div>
              <strong>{n.phone}</strong> {n.label && <span className="sub">· {n.label}</span>}
              <div className="sub">{MODE[n.mode]} · <span className={`badge ${n.status === 'CONNECTED' ? 'ok' : 'warn'}`}>{NUMBER_STATUS[n.status]}</span></div>
            </div>
            <div className="row">
              {n.status === 'CONNECTED'
                ? <button type="button" className="btn secondary small" onClick={() => void disconnect(n.id, n.phone)}>Desconectar</button>
                : <button type="button" className="btn small" onClick={() => setCf({ id: n.id, phoneNumberId: '', wabaId: '', token: '' })}>Conectar con Meta</button>}
              <button type="button" className="btn secondary small" onClick={() => removeNumber(n.id, n.phone)}>Quitar</button>
            </div>
            {cf?.id === n.id && (
              <div style={{ flexBasis: '100%' }}>
                <div className="grid">
                  <div><label>Phone Number ID</label><input inputMode="numeric" value={cf.phoneNumberId} onChange={(e) => setCf({ ...cf, phoneNumberId: e.target.value })} /></div>
                  <div><label>ID de la cuenta de WhatsApp (WABA)</label><input inputMode="numeric" value={cf.wabaId} onChange={(e) => setCf({ ...cf, wabaId: e.target.value })} /></div>
                  <div><label>Token de acceso permanente</label><input type="password" autoComplete="off" value={cf.token} onChange={(e) => setCf({ ...cf, token: e.target.value })} /></div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn small" disabled={!cf.phoneNumberId || cf.token.length < 20} onClick={() => void connect()}>Verificar y conectar</button>
                  <button type="button" className="btn secondary small" onClick={() => setCf(null)}>Cancelar</button>
                </div>
                <p className="muted">Se verifica con Meta antes de guardar. El token se guarda cifrado y nunca se vuelve a mostrar.</p>
              </div>
            )}
          </div>
        ))}
        <div className="grid" style={{ marginTop: 12 }}>
          <div><label>Número (con código de país)</label><input value={num.phone} onChange={(e) => setNum({ ...num, phone: e.target.value })} /></div>
          <div><label>Etiqueta (opcional)</label><input value={num.label} onChange={(e) => setNum({ ...num, label: e.target.value })} /></div>
          <div>
            <label>Tipo</label>
            <select value={num.mode} onChange={(e) => setNum({ ...num, mode: e.target.value })}>
              <option value="PLATFORM">De la plataforma</option>
              <option value="OWN">Propio del negocio</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><button type="button" className="btn" disabled={!num.phone} onClick={() => void addNumber()}>Agregar número</button></div>
        <p className="muted">Para conectar un número necesitás los datos de la app de Meta (guía en docs/WHATSAPP.md).</p>
      </div>

      <div className="card">
        <h2>Usuarios</h2>
        {t.users.map((u) => (
          <div className="item" key={u.id}>
            <div>
              <strong>{u.name}</strong> <span className="sub">· {u.email}</span>
              <div className="sub">{ROLE_LABEL[u.role]} · {u.isActive ? 'Activo' : 'Inactivo'}</div>
            </div>
            <div className="row">
              <input type="password" placeholder="Nueva contraseña (mín. 10)" autoComplete="new-password" style={{ width: 210 }} value={pw[u.id] ?? ''} onChange={(e) => setPw({ ...pw, [u.id]: e.target.value })} />
              <button type="button" className="btn secondary small" disabled={(pw[u.id] ?? '').length < 10} onClick={() => void resetPw(u.id)}>Cambiar contraseña</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
