import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Clock, Radio } from 'lucide-react';
import { fetchLiveSessions } from '../lib/db';

const STATUS_BADGE = {
  live:     { label: '🔴 En vivo ahora', className: 'badge badge-rose' },
  upcoming: { label: '📅 Próxima', className: 'badge badge-sky' },
  ended:    { label: '✔ Finalizada', className: 'badge badge-accent' },
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const LiveClasses = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="view active" style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>Cargando clases en vivo...</div>;
  }

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ marginBottom: '8px' }}><Radio size={22} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Clases en vivo</h1>
        <p style={{ color: 'var(--text2)' }}>Sesiones en vivo con tus instructores. Únete cuando estén activas.</p>
      </div>

      {sessions.length === 0 && (
        <div style={{ color: 'var(--text3)', padding: '30px', textAlign: 'center' }}>Todavía no hay clases en vivo programadas.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sessions.map((s) => {
          const status = STATUS_BADGE[s.status] || STATUS_BADGE.upcoming;
          return (
            <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <span className={status.className} style={{ marginBottom: '10px', display: 'inline-block' }}>{status.label}</span>
                <div style={{ fontWeight: 600, fontSize: '1.02rem', marginBottom: '4px' }}>{s.title}</div>
                <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '2px' }}>{s.courseTitle} · {s.instructor}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} /> {formatDate(s.startsAt)} · {s.durationMin} min
                </div>
              </div>
              <button
                className={`btn ${s.status === 'live' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                disabled={s.status === 'ended'}
                onClick={() => navigate(`/live/${s.id}`)}
              >
                <Video size={14} /> {s.status === 'live' ? 'Unirse ahora' : s.status === 'upcoming' ? 'Ver sala' : 'Finalizada'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveClasses;
