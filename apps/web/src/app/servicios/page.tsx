'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { money } from '@/lib/labels';
import { useAuth } from '@/lib/useAuth';

interface Svc { id: string; name: string; description: string | null; durationMin: number; priceCents: number | null; isActive: boolean }
const empty = { name: '', description: '', durationMin: '30', price: '' };

export default function ServiciosPage() {
  const { me, error: authError } = useAuth('tenant');
  const isAdmin = me?.role === 'TENANT_ADMIN';
  const [items, setItems] = useState<Svc[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await api<Svc[]>('/services')); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { if (me) void load(); }, [me, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setOk(null);
    try {
      const pesos = form.price.trim() === '' ? null : Number(form.price.replace(',', '.'));
      if (pesos !== null && (!Number.isFinite(pesos) || pesos < 0)) throw new Error('El precio no es válido');
      const body: Record<string, unknown> = { name: form.name, durationMin: Number(form.durationMin), description: form.description || undefined };
      if (pesos !== null) body.priceCents = Math.round(pesos * 100);
      if (editing) await api(`/services/${editing}`, { method: 'PATCH', body });
      else await api('/services', { method: 'POST', body });
      setOk(editing ? 'Servicio actualizado' : 'Servicio creado');
      setForm(empty); setEditing(null);
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggle = async (s: Svc) => {
    setError(null); setOk(null);
    try { await api(`/services/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } }); await load(); } catch (err) { setError(errMsg(err)); }
  };
  const edit = (s: Svc) => {
    setEditing(s.id);
    setForm({ name: s.name, description: s.description ?? '', durationMin: String(s.durationMin), price: s.priceCents === null ? '' : String(s.priceCents / 100) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Shell me={me} title="Servicios">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      {isAdmin && (
        <form className="card" onSubmit={submit}>
          <h2>{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <div className="grid">
            <div><label>Nombre</label><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Duración (minutos)</label><input required inputMode="numeric" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></div>
            <div><label>Precio en pesos (opcional)</label><input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <label>Descripción (opcional)</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn">{editing ? 'Guardar cambios' : 'Crear servicio'}</button>
            {editing && <button type="button" className="btn secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      )}
      <div className="card">
        <h2>Servicios ({items.length})</h2>
        {items.length === 0 && <p className="muted">Todavía no hay servicios.</p>}
        {items.map((s) => (
          <div className="item" key={s.id}>
            <div>
              <strong>{s.name}</strong> {!s.isActive && <span className="badge bad">Inactivo</span>}
              <div className="sub">{s.durationMin} min · {money(s.priceCents)}{s.description ? ` · ${s.description}` : ''}</div>
            </div>
            {isAdmin && (
              <div className="row">
                <button type="button" className="btn secondary small" onClick={() => edit(s)}>Editar</button>
                <button type="button" className="btn secondary small" onClick={() => void toggle(s)}>{s.isActive ? 'Desactivar' : 'Activar'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
