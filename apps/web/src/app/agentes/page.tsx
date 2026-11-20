'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface Agent { id: string; name: string; description: string | null; personality: string | null; instructions: string | null; language: string; isActive: boolean }
const empty = { name: '', description: '', personality: '', instructions: '', language: 'es' };

export default function AgentesPage() {
  const { me, error: authError } = useAuth('tenant');
  const isAdmin = me?.role === 'TENANT_ADMIN';
  const [items, setItems] = useState<Agent[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await api<Agent[]>('/agents')); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { if (me) void load(); }, [me, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setOk(null);
    try {
      const body = { name: form.name, description: form.description, personality: form.personality, instructions: form.instructions, language: form.language };
      if (editing) await api(`/agents/${editing}`, { method: 'PATCH', body });
      else await api('/agents', { method: 'POST', body });
      setOk(editing ? 'Agente actualizado' : 'Agente creado');
      setForm(empty); setEditing(null);
      await load();
    } catch (err) { setError(errMsg(err)); }
  };
  const toggle = async (a: Agent) => {
    try { await api(`/agents/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } }); await load(); } catch (e) { setError(errMsg(e)); }
  };
  const edit = (a: Agent) => {
    setEditing(a.id);
    setForm({ name: a.name, description: a.description ?? '', personality: a.personality ?? '', instructions: a.instructions ?? '', language: a.language });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Shell me={me} title="Agentes de IA">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <div className="msg ok" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        Por ahora podés definir cómo va a ser cada agente. Responder mensajes de WhatsApp con IA se activa en las próximas etapas.
      </div>
      {isAdmin && (
        <form className="card" onSubmit={submit}>
          <h2>{editing ? 'Editar agente' : 'Nuevo agente'}</h2>
          <div className="grid">
            <div><label>Nombre</label><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label>Idioma</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="es">Español</option><option value="en">Inglés</option><option value="pt">Portugués</option>
              </select>
            </div>
          </div>
          <label>Descripción (qué hace)</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Personalidad (cómo habla)</label>
          <input value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} />
          <label>Instrucciones</label>
          <textarea style={{ fontFamily: 'inherit' }} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn">{editing ? 'Guardar cambios' : 'Crear agente'}</button>
            {editing && <button type="button" className="btn secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      )}
      <div className="card">
        <h2>Agentes ({items.length})</h2>
        {items.length === 0 && <p className="muted">Todavía no hay agentes.</p>}
        {items.map((a) => (
          <div className="item" key={a.id}>
            <div>
              <strong>{a.name}</strong> {!a.isActive && <span className="badge bad">Inactivo</span>}
              <div className="sub">{a.description ?? 'Sin descripción'}</div>
            </div>
            {isAdmin && (
              <div className="row">
                <button type="button" className="btn secondary small" onClick={() => edit(a)}>Editar</button>
                <button type="button" className="btn secondary small" onClick={() => void toggle(a)}>{a.isActive ? 'Desactivar' : 'Activar'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
