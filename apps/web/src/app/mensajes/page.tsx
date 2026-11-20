'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface Conv {
  id: string; status: 'OPEN' | 'CLOSED'; aiPaused: boolean; needsHuman: boolean; unreadCount: number; assignedUserId: string | null;
  lastMessageAt: string; lastInboundAt: string | null; contact: { id: string; name: string; phone: string }; number: { phone: string; label: string | null };
  last?: { body: string | null; direction: 'IN' | 'OUT'; createdAt: string } | null;
}
interface Msg {
  id: string; direction: 'IN' | 'OUT'; sender: 'CONTACT' | 'HUMAN' | 'AGENT' | 'SYSTEM'; type: string; body: string | null;
  status: 'RECEIVED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'; error: string | null; createdAt: string;
}
interface Detail { conversation: Conv; messages: Msg[] }

const TICK: Record<string, string> = { SENT: '✓ enviado', DELIVERED: '✓✓ entregado', READ: '✓✓ leído', FAILED: '⚠ no enviado', RECEIVED: '' };
const SENDER: Record<string, string> = { HUMAN: 'Equipo', AGENT: 'Agente IA', SYSTEM: 'Sistema', CONTACT: '' };
const hm = (d: string) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

export default function MensajesPage() {
  const { me, error: authError } = useAuth('tenant');
  const [filter, setFilter] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [q, setQ] = useState('');
  const [list, setList] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try { setList(await api<Conv[]>(`/conversations?status=${filter}&q=${encodeURIComponent(q)}`)); } catch (e) { setError(errMsg(e)); }
  }, [filter, q]);
  const loadDetail = useCallback(async (id: string) => {
    try { setDetail(await api<Detail>(`/conversations/${id}`)); } catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => {
    if (!me) return;
    const t = setTimeout(() => { void loadList(); }, 250);
    const i = setInterval(() => { void loadList(); }, 15000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [me, loadList]);

  useEffect(() => {
    if (!me || !selected) { setDetail(null); return; }
    void loadDetail(selected);
    const i = setInterval(() => { void loadDetail(selected); }, 8000);
    return () => clearInterval(i);
  }, [me, selected, loadDetail]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [detail?.messages.length]);

  const patch = async (body: object) => {
    if (!selected) return;
    setError(null);
    try { await api(`/conversations/${selected}`, { method: 'PATCH', body }); await loadDetail(selected); await loadList(); } catch (e) { setError(errMsg(e)); }
  };

  const send = async () => {
    if (!selected || !text.trim()) return;
    setBusy(true); setError(null);
    try {
      await api(`/conversations/${selected}/messages`, { method: 'POST', body: { text } });
      setText('');
    } catch (e) { setError(errMsg(e)); }
    await loadDetail(selected); await loadList();
    setBusy(false);
  };

  const c = detail?.conversation;
  const windowClosed = !!c && (!c.lastInboundAt || Date.now() - new Date(c.lastInboundAt).getTime() > 24 * 3600 * 1000);

  return (
    <Shell me={me} title="Mensajes">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}

      {!selected && (
        <div className="card">
          <div className="tabs">
            <button type="button" className={`btn ${filter === 'OPEN' ? 'active' : ''}`} onClick={() => setFilter('OPEN')}>Abiertas</button>
            <button type="button" className={`btn ${filter === 'CLOSED' ? 'active' : ''}`} onClick={() => setFilter('CLOSED')}>Cerradas</button>
          </div>
          <input placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.length === 0 && <p className="muted">No hay conversaciones. Aparecen acá cuando un cliente escribe a un número conectado.</p>}
          {list.map((x) => (
            <div className="item clickable" key={x.id} onClick={() => setSelected(x.id)}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{x.contact.name}</strong> {x.needsHuman && <span className="badge warn">Importante</span>} {x.aiPaused && <span className="badge">IA en pausa</span>}
                <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {x.last ? `${x.last.direction === 'OUT' ? 'Vos: ' : ''}${x.last.body ?? ''}` : 'Sin mensajes'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {x.unreadCount > 0 && <span className="unread">{x.unreadCount}</span>}
                <div className="sub">{hm(x.lastMessageAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" className="btn secondary small" onClick={() => { setSelected(null); setDetail(null); void loadList(); }}>← Conversaciones</button>
            {c && <div className="sub">{c.contact.phone} · vía {c.number.label ?? c.number.phone}</div>}
          </div>
          {c && (
            <>
              <h2 style={{ marginBottom: 8 }}>{c.contact.name}</h2>
              <div className="row" style={{ marginBottom: 12 }}>
                <button type="button" className="btn secondary small" onClick={() => void patch({ aiPaused: !c.aiPaused })}>{c.aiPaused ? 'Reanudar IA' : 'Pausar IA'}</button>
                <button type="button" className="btn secondary small" onClick={() => void patch({ needsHuman: !c.needsHuman })}>{c.needsHuman ? 'Quitar importante' : 'Marcar importante'}</button>
                <button type="button" className="btn secondary small" onClick={() => void patch({ assignedUserId: c.assignedUserId === me?.id ? null : me?.id })}>{c.assignedUserId === me?.id ? 'Soltar' : 'Asignarme'}</button>
                <button type="button" className="btn secondary small" onClick={() => void patch({ status: c.status === 'OPEN' ? 'CLOSED' : 'OPEN' })}>{c.status === 'OPEN' ? 'Cerrar' : 'Reabrir'}</button>
              </div>
            </>
          )}
          <div className="thread">
            {detail?.messages.map((m) => (
              <div key={m.id} className={`bubble ${m.direction === 'IN' ? 'in' : 'out'}`}>
                {m.body}
                <div className="meta">{[SENDER[m.sender], hm(m.createdAt), m.direction === 'OUT' ? TICK[m.status] : ''].filter(Boolean).join(' · ')}{m.error ? ` · ${m.error}` : ''}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {windowClosed && <div className="msg err" style={{ marginTop: 12 }}>Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo permite escribirle con una plantilla aprobada (llega en una próxima etapa).</div>}
          <div style={{ marginTop: 12 }}>
            <textarea style={{ fontFamily: 'inherit', minHeight: 70 }} placeholder="Escribí tu respuesta…" disabled={windowClosed} value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ marginTop: 8 }}><button type="button" className="btn" disabled={busy || windowClosed || !text.trim()} onClick={() => void send()}>{busy ? 'Enviando…' : 'Enviar'}</button></div>
          </div>
        </div>
      )}
    </Shell>
  );
}
