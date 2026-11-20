'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

const DAYS: [number, string][] = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
type Win = { start: string; end: string };
interface Block { id: string; startsAt: string; endsAt: string; reason: string | null }
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dt = (d: string) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

export default function HorariosPage() {
  const { me, error: authError } = useAuth('tenant');
  const isAdmin = me?.role === 'TENANT_ADMIN';
  const [week, setWeek] = useState<Record<number, Win[]>>({});
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [bf, setBf] = useState({ start: '', end: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await api<{ dayOfWeek: number; startMin: number; endMin: number }[]>('/schedule/hours');
      const w: Record<number, Win[]> = {};
      rows.forEach((r) => { (w[r.dayOfWeek] ??= []).push({ start: toTime(r.startMin), end: toTime(r.endMin) }); });
      setWeek(w);
      setBlocks(await api<Block[]>('/schedule/blocks'));
    } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { if (me) void load(); }, [me, load]);

  const setWin = (day: number, i: number, patch: Partial<Win>) =>
    setWeek({ ...week, [day]: (week[day] ?? []).map((w, idx) => (idx === i ? { ...w, ...patch } : w)) });
  const addWin = (day: number) => setWeek({ ...week, [day]: [...(week[day] ?? []), { start: '09:00', end: '18:00' }] });
  const delWin = (day: number, i: number) => setWeek({ ...week, [day]: (week[day] ?? []).filter((_, idx) => idx !== i) });

  const save = async () => {
    setError(null); setOk(null);
    try {
      const hours: { dayOfWeek: number; startMin: number; endMin: number }[] = [];
      for (const [day, name] of DAYS) {
        for (const w of week[day] ?? []) {
          if (!w.start || !w.end || toMin(w.start) >= toMin(w.end)) throw new Error(`Revisá los horarios del ${name.toLowerCase()}: cada tramo debe terminar después de empezar`);
          hours.push({ dayOfWeek: day, startMin: toMin(w.start), endMin: toMin(w.end) });
        }
      }
      await api('/schedule/hours', { method: 'PUT', body: { hours } });
      setOk('Horarios guardados'); await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const addBlock = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setOk(null);
    try {
      await api('/schedule/blocks', { method: 'POST', body: { startsAt: new Date(bf.start).toISOString(), endsAt: new Date(bf.end).toISOString(), reason: bf.reason || undefined } });
      setBf({ start: '', end: '', reason: '' }); setOk('Bloqueo creado'); await load();
    } catch (err) { setError(errMsg(err)); }
  };
  const delBlock = async (id: string) => {
    try { await api(`/schedule/blocks/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <Shell me={me} title="Horarios de atención">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}
      <div className="card">
        <h2>Horario semanal</h2>
        {DAYS.map(([day, name]) => (
          <div className="item" key={day} style={{ alignItems: 'flex-start' }}>
            <strong style={{ minWidth: 90 }}>{name}</strong>
            <div style={{ flex: 1, minWidth: 220 }}>
              {(week[day] ?? []).length === 0 && <span className="sub">Cerrado</span>}
              {(week[day] ?? []).map((w, i) => (
                <div className="row" key={i} style={{ marginBottom: 6 }}>
                  <input type="time" style={{ width: 120 }} disabled={!isAdmin} value={w.start} onChange={(e) => setWin(day, i, { start: e.target.value })} />
                  <span>a</span>
                  <input type="time" style={{ width: 120 }} disabled={!isAdmin} value={w.end} onChange={(e) => setWin(day, i, { end: e.target.value })} />
                  {isAdmin && <button type="button" className="btn secondary small" onClick={() => delWin(day, i)}>Quitar</button>}
                </div>
              ))}
              {isAdmin && <button type="button" className="btn secondary small" onClick={() => addWin(day)}>+ Agregar tramo</button>}
            </div>
          </div>
        ))}
        {isAdmin && <div style={{ marginTop: 14 }}><button type="button" className="btn" onClick={() => void save()}>Guardar horarios</button></div>}
      </div>

      <form className="card" onSubmit={addBlock}>
        <h2>Bloquear fechas u horarios</h2>
        <p className="muted">Por ejemplo vacaciones, feriados o un trámite. Los horarios bloqueados no se ofrecen para reservas.</p>
        <div className="grid">
          <div><label>Desde</label><input type="datetime-local" required value={bf.start} onChange={(e) => setBf({ ...bf, start: e.target.value })} /></div>
          <div><label>Hasta</label><input type="datetime-local" required value={bf.end} onChange={(e) => setBf({ ...bf, end: e.target.value })} /></div>
          <div><label>Motivo (opcional)</label><input value={bf.reason} onChange={(e) => setBf({ ...bf, reason: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn">Crear bloqueo</button></div>
        {blocks.map((b) => (
          <div className="item" key={b.id}>
            <div>{dt(b.startsAt)} → {dt(b.endsAt)}{b.reason ? <span className="sub"> · {b.reason}</span> : null}</div>
            <button type="button" className="btn secondary small" onClick={() => void delBlock(b.id)}>Quitar</button>
          </div>
        ))}
      </form>
    </Shell>
  );
}
