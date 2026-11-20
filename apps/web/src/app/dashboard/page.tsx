'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg, Role, TenantInfo, UserRow } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import BusinessProfile from '@/components/BusinessProfile';

const fmt = (d: string) => new Date(d).toLocaleDateString('es-AR');
const SUB: Record<string, string> = { TRIALING: 'En prueba', ACTIVE: 'Activa', PAST_DUE: 'Pago vencido', SUSPENDED: 'Suspendida', CANCELED: 'Cancelada' };
const ROLE: Record<string, string> = { TENANT_ADMIN: 'Administrador', OPERATOR: 'Operador' };

export default function Dashboard() {
  const { me, error: authError } = useAuth('tenant');
  const isAdmin = me?.role === 'TENANT_ADMIN';
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nu, setNu] = useState<{ email: string; name: string; password: string; role: Role }>({ email: '', name: '', password: '', role: 'OPERATOR' });

  const load = useCallback(async () => {
    try {
      setInfo(await api<TenantInfo>('/tenant/me'));
      if (isAdmin) setUsers(await api<UserRow[]>('/users'));
    } catch (e) { setError(errMsg(e)); }
  }, [isAdmin]);

  useEffect(() => { if (me) void load(); }, [me, load]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError(null); setOk(null);
    try { await fn(); setOk(done); await load(); } catch (e) { setError(errMsg(e)); }
  };

  const createUser = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/users', { method: 'POST', body: nu });
      setNu({ email: '', name: '', password: '', role: 'OPERATOR' });
    }, 'Usuario creado');
  };
  const patch = (u: UserRow, body: object, done: string) => run(() => api(`/users/${u.id}`, { method: 'PATCH', body }), done);

  const limits = info?.subscription?.plan.limits ?? {};

  return (
    <Shell me={me} title={info?.name ?? 'Panel de la empresa'}>
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      {!me && !authError && <p className="muted">Cargando…</p>}

      {info && (
        <div className="card">
          <h2>Mi empresa</h2>
          <div className="grid">
            <div className="stat"><div className="k">Estado</div><div className="v">{info.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}</div></div>
            <div className="stat"><div className="k">Plan</div><div className="v">{info.subscription?.plan.name ?? 'Sin plan'}</div></div>
            <div className="stat"><div className="k">Suscripción</div><div className="v">{info.subscription ? SUB[info.subscription.status] ?? info.subscription.status : '—'}</div></div>
            <div className="stat"><div className="k">Vence</div><div className="v">{info.subscription ? fmt(info.subscription.currentPeriodEnd) : '—'}</div></div>
            <div className="stat"><div className="k">Usuarios</div><div className="v">{info.usage.users}{limits.users !== undefined ? ` / ${limits.users}` : ''}</div></div>
          </div>
        </div>
      )}

      {info && <BusinessProfile info={info} isAdmin={isAdmin} onSaved={() => { setOk('Datos guardados'); void load(); }} />}

      {isAdmin && (
        <>
          <div className="card">
            <h2>Usuarios</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td><td>{u.email}</td>
                      <td>
                        <select value={u.role} disabled={u.id === me?.id} onChange={(e) => void patch(u, { role: e.target.value }, 'Rol actualizado')}>
                          <option value="OPERATOR">Operador</option>
                          <option value="TENANT_ADMIN">Administrador</option>
                        </select>
                      </td>
                      <td><span className={`badge ${u.isActive ? 'ok' : 'bad'}`}>{u.isActive ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        {u.id !== me?.id && (
                          <button type="button" className="btn secondary small" onClick={() => void patch(u, { isActive: !u.isActive }, u.isActive ? 'Usuario desactivado' : 'Usuario activado')}>
                            {u.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form className="card" onSubmit={createUser}>
            <h2>Agregar usuario</h2>
            <label htmlFor="un">Nombre</label>
            <input id="un" required minLength={2} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
            <label htmlFor="ue">Correo</label>
            <input id="ue" type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <label htmlFor="up">Contraseña inicial (mínimo 10 caracteres)</label>
            <input id="up" type="password" required minLength={10} autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
            <label htmlFor="ur">Rol</label>
            <select id="ur" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              <option value="OPERATOR">{ROLE.OPERATOR}</option>
              <option value="TENANT_ADMIN">{ROLE.TENANT_ADMIN}</option>
            </select>
            <div style={{ marginTop: 16 }}><button className="btn">Crear usuario</button></div>
          </form>
        </>
      )}
    </Shell>
  );
}
