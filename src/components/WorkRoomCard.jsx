import React from 'react';
import { ExternalLink, Users } from 'lucide-react';

// Sala de trabajo del aula: una segunda sala fija de Google Meet que se crea
// junto con el aula (`groups/{id}.workLink`, ver createMeetSpace). Está siempre
// abierta para que alumnos y docente se reúnan fuera de clase (sin grabación).
// Reemplaza a las antiguas "salas privadas" de Jitsi.
const WorkRoomCard = ({ group, sub }) => {
  const link = /^https:\/\//.test(group?.workLink || '') ? group.workLink : null;
  return (
    <div className="admin-panel" style={{ marginBottom: 24 }}>
      <div className="dash-list-row" style={{ borderBottom: 0, padding: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={16} /></div>
          <div>
            <div className="dash-list-row-title">Sala de trabajo{group?.name ? ` · Aula ${group.name}` : ''}</div>
            <div className="dash-list-row-sub">
              {link
                ? (sub || 'Abierta siempre para reunirse con el aula fuera de clase. Entra con tu correo de la academia.')
                : (group ? 'Esta aula todavía no tiene sala de trabajo. Avísale a la academia.' : 'Aún no tienes un aula asignada.')}
            </div>
          </div>
        </div>
        {link && (
          <a className="admin-btn-edit" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }} href={link} target="_blank" rel="noreferrer" title="Se abre en Google Meet, en una pestaña nueva">
            <ExternalLink size={13} /> Entrar
          </a>
        )}
      </div>
    </div>
  );
};

export default WorkRoomCard;
