'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface Appt { id: string; startsAt: string; endsAt: string; status: string; notes: string | null; contact: { id: string; name: string; phone: string }; service: { id: string; name: string; durationMin: number } }
interface Opt { id: string; name: string; isActive?: boolean }
interface Slot { startsAt: string; label: string }

const ST: Record<string, string> = { PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CANCELED: 'Cancelada', COMPLETED: 'Completada', NO_SHOW: 'No asistió' };
const BADGE: Record<string, string> = { PENDING: 'warn', CONFIRMED: 'ok', CANCELED: 'bad', COMPLETED: 'ok', NO_SHOW: 'bad' };
const today = () => new Date().toLocaleDateString('en-CA');
const hm = (d: string) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function AgendaPage() {
  const { me, error: authError } = useAuth('tenant');
  const [date, setDate] = useState(today());
  const [appts, setAppts] = useState<Appt[]>([]);
  const [contacts, setContacts] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);
  const [contactId, setContactId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    try { setAppts(await api<Appt[]>(`/appointments?from=${date}&to=${date}`)); } catch (e) { setError(errMsg(e)); }
  }, [date]);

  useEffect(() => { if (me) void loadDay(); }, [me, loadDay]);
  useEffect(() => {
    if (!me) return;
    Promise.all([api<Opt[]>('/contacts'), api<Opt[]>('/services')])
      .then(([c, s]) => { setContacts(c); setServices(s.filter((x) => x.isActive !== false)); })
      .catch((e) => setError(errMsg(e)));
  }, [me]);
  useEffect(() => { setSlots(null); }, [date, serviceId]);

  const shift = (n: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDate(d.toLocaleDateString('en-CA'));
  };

  const findSlots = async () => {
    setError(null); setOk(null);
    if (!serviceId) { setError('Elegí un servicio'); return; }
    try { setSlots((await api<{ slots: Slot[] }>(`/schedule/availability?date=${date}&serviceId=${serviceId}`)).slots); } catch (e) { setError(errMsg(e)); }
  };

  const book = async (slot: Slot) => {
    setError(null); setOk(null);
    if (!contactId) { setError('Elegí un cliente'); return; }
    try {
      await api('/appointments', { method: 'POST', body: { contactId, serviceId, startsAt: slot.startsAt } });
      setOk(`Reserva creada para las ${slot.label}`);
      setSlots(null);
      await loadDay();
    } catch (e) { setError(errMsg(e)); await findSlots(); }
  };

  const setStatus = async (a: Appt, status: string) => {
    if (status === 'CANCELED' && !window.confirm('¿Cancelar esta reserva?')) return;
    setError(null); setOk(null);
    try { await api(`/appointments/${a.id}`, { method: 'PATCH', body: { status } }); setOk('Reserva actualizada'); await loadDay(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <Shell me={me} title="Agenda">
      {(authError || error) && <div className="msg err">{authError ?? error}</div>}
      {ok && <div className="msg ok">{ok}</div>}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn secondary small" onClick={() => shift(-1)}>← Anterior</button>
          <input type="date" style={{ width: 170 }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="btn secondary small" onClick={() => shift(1)}>Siguiente →</button>
        </div>
      </div>

      <div className="card">
        <h2>Reservas del día ({appts.length})</h2>
        {appts.length === 0 && <p className="muted">No hay reservas para esta fecha.</p>}
        {appts.map((a) => (
          <div className="item" key={a.id}>
            <div>
              <strong>{hm(a.startsAt)} – {hm(a.endsAt)}</strong> <span className={`badge ${BADGE[a.status]}`}>{ST[a.status]}</span>
              <div className="sub">{a.contact.name} · {a.contact.phone} · {a.service.name}{a.notes ? ` · ${a.notes}` : ''}</div>
            </div>
            {a.status !== 'CANCELED' && (
              <div className="row">
                {a.status === 'PENDING' && <button type="button" className="btn small" onClick={() => void setStatus(a, 'CONFIRMED')}>Confirmar</button>}
                {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                  <>
                    <button type="button" className="btn secondary small" onClick={() => void setStatus(a, 'COMPLETED')}>Completada</button>
                    <button type="button" className="btn secondary small" onClick={() => void setStatus(a, 'NO_SHOW')}>No asistió</button>
                    <button type="button" className="btn danger small" onClick={() => void setStatus(a, 'CANCELED')}>Cancelar</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Nueva reserva para el {new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {contacts.length === 0 && <p className="muted">Primero cargá un cliente en la sección Clientes.</p>}
        {services.length === 0 && <p className="muted">Primero cargá un servicio en la sección Servicios (y los horarios de atención en Horarios).</p>}
        <div className="grid">
          <div>
            <label>Cliente</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Elegí un cliente</option>
              {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label>Servicio</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Elegí un servicio</option>
              {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><button type="button" className="btn" onClick={() => void findSlots()}>Ver horarios libres</button></div>
        {slots && slots.length === 0 && <p className="muted">No hay horarios libres ese día para ese servicio.</p>}
        {slots && slots.length > 0 && (
          <>
            <p className="muted">Tocá un horario para reservarlo.</p>
            <div className="slots">{slots.map((s) => (<button key={s.startsAt} type="button" className="btn secondary small" onClick={() => void book(s)}>{s.label}</button>))}</div>
          </>
        )}
      </div>
    </Shell>
  );
}
