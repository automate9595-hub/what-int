'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface Contact { id: string; name: string; phone: string; email: string | null; notes: string | null }
const empty = { name: '', phone: '', email: '', notes: '' };

export default function ClientesPage() {
  const { me, error: authError } = useAuth('tenant');
  const [items, setItems] = useState<Contact[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    try { setItems(await api<Contact[]>(`/contacts?q=${encodeURIComponent(term)}`)); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => {
    if (!me) return;
    const t = setTimeout(() => { void load(q); }, 300);
    return () => clearTimeout(t);
  }, [me, q, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setOk(null);
    try {
      const body = { name: form.name, phone: form.phone, email: form.email || undefined, notes: form.notes || undefined };
      if (editing) await api(`/contacts/${editing}`, { method: 'PATCH', body });
      else await api('/contacts', { method: 'POST', body });
      setOk(editing ? 'Cliente actualizado' : 'Cliente creado');
      setForm(empty); setEditing(null);
      await load(q);
    } catch (err) { setError(errMsg(err)); }
  };
  const edit = (c: Contact) => {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email ?? '', notes: c.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Shell me={me} title="Clientes">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <form className="card" onSubmit={submit}>
        <h2>{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <div className="grid">
          <div><label>Nombre y apellido</label><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label>Teléfono (con código de país)</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label>Correo (opcional)</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <label>Notas (opcional)</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn">{editing ? 'Guardar cambios' : 'Crear cliente'}</button>
          {editing && <button type="button" className="btn secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}
        </div>
      </form>
      <div className="card">
        <h2>Clientes ({items.length})</h2>
        <input placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        {items.length === 0 && <p className="muted">No hay clientes para mostrar.</p>}
        {items.map((c) => (
          <div className="item" key={c.id}>
            <div><strong>{c.name}</strong><div className="sub">{c.phone}{c.email ? ` · ${c.email}` : ''}{c.notes ? ` · ${c.notes}` : ''}</div></div>
            <button type="button" className="btn secondary small" onClick={() => edit(c)}>Editar</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}
