'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, AuditRow, errMsg, Plan, TenantSummary } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import NewTenantForm from '@/components/NewTenantForm';
import TenantDetailView from '@/components/TenantDetailView';

type Tab = 'tenants' | 'plans' | 'audit';
type Draft = { name: string; price: string; limits: Record<string, string>; isActive: boolean };

const LIMITS: [string, string][] = [
  ['users', 'Usuarios'],
  ['agents', 'Agentes de IA'],
  ['numbers', 'Números de WhatsApp'],
  ['conversations', 'Conversaciones por mes'],
  ['aiTokens', 'Tokens de IA por mes'],
  ['storageMb', 'Almacenamiento (MB)'],
];
const dt = (d: string) => new Date(d).toLocaleString('es-AR');
const ACTION: Record<string, string> = {
  'auth.register': 'Registro de empresa', 'auth.login': 'Inicio de sesión', 'auth.login_failed': 'Intento de acceso fallido',
  'auth.refresh_reuse_detected': 'Sesión sospechosa cerrada', 'admin.tenant_status': 'Cambio de estado de empresa',
  'admin.plan_update': 'Plan modificado', 'user.create': 'Usuario creado', 'user.update': 'Usuario modificado', 'tenant.rename': 'Empresa renombrada',
};

export default function AdminPage() {
  const { me, error: authError } = useAuth('admin');
  const [tab, setTab] = useState<Tab>('tenants');
  const [tenants, setTenants] = useState<{ total: number; items: TenantSummary[] }>({ total: 0, items: [] });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setError(null);
    try {
      if (t === 'tenants') setTenants(await api('/admin/tenants?limit=100'));
      if (t === 'plans') {
        const p = await api<Plan[]>('/admin/plans');
        setPlans(p);
        setDrafts(Object.fromEntries(p.map((x) => [x.id, {
          name: x.name,
          price: String(x.priceCents / 100),
          limits: Object.fromEntries(LIMITS.map(([k]) => [k, String(x.limits?.[k] ?? 0)])),
          isActive: x.isActive,
        }])));
      }
      if (t === 'audit') setAudit(await api('/admin/audit-logs?limit=100'));
    } catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => { if (me) void load(tab); }, [me, tab, load]);

  const setStatus = async (t: TenantSummary) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`¿${next === 'SUSPENDED' ? 'Suspender' : 'Reactivar'} la empresa "${t.name}"?`)) return;
    setOk(null); setError(null);
    try { await api(`/admin/tenants/${t.id}/status`, { method: 'PATCH', body: { status: next } }); setOk('Estado actualizado'); await load('tenants'); }
    catch (e) { setError(errMsg(e)); }
  };

  const savePlan = async (p: Plan) => {
    setOk(null); setError(null);
    const d = drafts[p.id];
    try {
      const pesos = Number(d.price.replace(',', '.'));
      if (!Number.isFinite(pesos) || pesos < 0) throw new Error('El precio no es válido');
      const limits: Record<string, number> = {};
      for (const [k, label] of LIMITS) {
        const n = Number(d.limits[k]);
        if (!Number.isInteger(n) || n < 0) throw new Error(`"${label}" debe ser un número entero, 0 o mayor`);
        limits[k] = n;
      }
      await api(`/admin/plans/${p.id}`, { method: 'PATCH', body: { name: d.name, priceCents: Math.round(pesos * 100), limits, isActive: d.isActive } });
      setOk(`Plan "${d.name}" guardado`);
      await load('plans');
    } catch (e) { setError(errMsg(e)); }
  };

  const upd = (id: string, patch: Partial<Draft>) => setDrafts({ ...drafts, [id]: { ...drafts[id], ...patch } });
  const updLimit = (id: string, k: string, v: string) => upd(id, { limits: { ...drafts[id].limits, [k]: v } });

  return (
    <Shell me={me} title="Panel del superadministrador">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <div className="tabs">
        {([['tenants', 'Empresas'], ['plans', 'Planes'], ['audit', 'Actividad']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" className={`btn ${tab === k ? 'active' : ''}`} onClick={() => { setOk(null); setSelected(null); setCreating(false); setTab(k); }}>{label}</button>
        ))}
      </div>

      {tab === 'tenants' && selected && <TenantDetailView id={selected} onBack={() => { setSelected(null); void load('tenants'); }} />}
      {tab === 'tenants' && !selected && creating && (
        <NewTenantForm onCancel={() => setCreating(false)} onDone={(id) => { setCreating(false); setSelected(id); }} />
      )}
      {tab === 'tenants' && !selected && !creating && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Empresas ({tenants.total})</h2>
            <button type="button" className="btn small" onClick={() => { setOk(null); setCreating(true); }}>+ Nueva empresa</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empresa</th><th>Estado</th><th>Plan</th><th>Usuarios</th><th>Creada</th><th></th></tr></thead>
              <tbody>
                {tenants.items.map((t) => (
                  <tr key={t.id}>
                    <td><button type="button" className="btn secondary small" onClick={() => setSelected(t.id)}>{t.name}</button></td>
                    <td><span className={`badge ${t.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{t.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}</span></td>
                    <td>{t.subscription ? t.subscription.plan.name : '—'}</td>
                    <td>{t.users}</td>
                    <td>{dt(t.createdAt)}</td>
                    <td><button type="button" className={`btn small ${t.status === 'ACTIVE' ? 'danger' : 'secondary'}`} onClick={() => void setStatus(t)}>{t.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && plans.map((p) => drafts[p.id] && (
        <div className="card" key={p.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{drafts[p.id].name}</h2>
            <label style={{ margin: 0 }}><input type="checkbox" checked={drafts[p.id].isActive} onChange={(e) => upd(p.id, { isActive: e.target.checked })} /> Disponible</label>
          </div>
          <div className="grid">
            <div><label>Nombre</label><input value={drafts[p.id].name} onChange={(e) => upd(p.id, { name: e.target.value })} /></div>
            <div><label>Precio mensual ({p.currency})</label><input inputMode="decimal" value={drafts[p.id].price} onChange={(e) => upd(p.id, { price: e.target.value })} /></div>
            {LIMITS.map(([k, label]) => (
              <div key={k}><label>{label}</label><input inputMode="numeric" value={drafts[p.id].limits[k]} onChange={(e) => updLimit(p.id, k, e.target.value)} /></div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}><button type="button" className="btn" onClick={() => void savePlan(p)}>Guardar plan</button></div>
        </div>
      ))}

      {tab === 'audit' && (
        <div className="card">
          <h2>Actividad reciente</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Qué pasó</th><th>IP</th></tr></thead>
              <tbody>
                {audit.map((a) => (<tr key={a.id}><td>{dt(a.createdAt)}</td><td>{ACTION[a.action] ?? a.action}</td><td>{a.ip ?? '—'}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
