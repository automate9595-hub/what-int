'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, AuditRow, errMsg, Plan, TenantSummary } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

type Tab = 'tenants' | 'plans' | 'audit';
type Draft = { name: string; priceCents: string; limits: string; isActive: boolean };
const dt = (d: string) => new Date(d).toLocaleString('es-AR');

export default function AdminPage() {
  const { me, error: authError } = useAuth('admin');
  const [tab, setTab] = useState<Tab>('tenants');
  const [tenants, setTenants] = useState<{ total: number; items: TenantSummary[] }>({ total: 0, items: [] });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setError(null);
    try {
      if (t === 'tenants') setTenants(await api('/admin/tenants?limit=100'));
      if (t === 'plans') {
        const p = await api<Plan[]>('/admin/plans');
        setPlans(p);
        setDrafts(Object.fromEntries(p.map((x) => [x.id, { name: x.name, priceCents: String(x.priceCents), limits: JSON.stringify(x.limits, null, 2), isActive: x.isActive }])));
      }
      if (t === 'audit') setAudit(await api('/admin/audit-logs?limit=100'));
    } catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => { if (me) void load(tab); }, [me, tab, load]);

  const setStatus = async (t: TenantSummary) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`${next === 'SUSPENDED' ? 'Suspender' : 'Reactivar'} la empresa "${t.name}"?`)) return;
    setOk(null); setError(null);
    try { await api(`/admin/tenants/${t.id}/status`, { method: 'PATCH', body: { status: next } }); setOk('Estado actualizado'); await load('tenants'); }
    catch (e) { setError(errMsg(e)); }
  };

  const savePlan = async (p: Plan) => {
    setOk(null); setError(null);
    const d = drafts[p.id];
    try {
      const limits = JSON.parse(d.limits) as Record<string, number>;
      if (Object.values(limits).some((v) => typeof v !== 'number')) throw new Error('Todos los límites deben ser números');
      const priceCents = Number(d.priceCents);
      if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('El precio debe ser un entero mayor o igual a 0 (en centavos)');
      await api(`/admin/plans/${p.id}`, { method: 'PATCH', body: { name: d.name, priceCents, limits, isActive: d.isActive } });
      setOk(`Plan "${d.name}" guardado`);
      await load('plans');
    } catch (e) { setError(e instanceof SyntaxError ? 'Los límites no son un JSON válido' : errMsg(e)); }
  };

  const upd = (id: string, patch: Partial<Draft>) => setDrafts({ ...drafts, [id]: { ...drafts[id], ...patch } });

  return (
    <Shell me={me} title="Panel del superadministrador">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <div className="tabs">
        {([['tenants', 'Empresas'], ['plans', 'Planes'], ['audit', 'Auditoría']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" className={`btn ${tab === k ? 'active' : ''}`} onClick={() => { setOk(null); setTab(k); }}>{label}</button>
        ))}
      </div>

      {tab === 'tenants' && (
        <div className="card">
          <h2>Empresas ({tenants.total})</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empresa</th><th>Estado</th><th>Plan</th><th>Usuarios</th><th>Creada</th><th></th></tr></thead>
              <tbody>
                {tenants.items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td><span className={`badge ${t.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{t.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}</span></td>
                    <td>{t.subscription ? `${t.subscription.plan.name} (${t.subscription.status})` : '—'}</td>
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
          <h2>{p.code}</h2>
          <label>Nombre</label>
          <input value={drafts[p.id].name} onChange={(e) => upd(p.id, { name: e.target.value })} />
          <label>Precio en centavos ({p.currency})</label>
          <input inputMode="numeric" value={drafts[p.id].priceCents} onChange={(e) => upd(p.id, { priceCents: e.target.value })} />
          <label>Límites (JSON)</label>
          <textarea value={drafts[p.id].limits} onChange={(e) => upd(p.id, { limits: e.target.value })} />
          <label><input type="checkbox" checked={drafts[p.id].isActive} onChange={(e) => upd(p.id, { isActive: e.target.checked })} /> Plan activo</label>
          <div style={{ marginTop: 12 }}><button type="button" className="btn" onClick={() => void savePlan(p)}>Guardar</button></div>
        </div>
      ))}

      {tab === 'audit' && (
        <div className="card">
          <h2>Últimos eventos</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>IP</th></tr></thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}><td>{dt(a.createdAt)}</td><td>{a.action}</td><td>{a.entity ?? '—'}</td><td>{a.ip ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
