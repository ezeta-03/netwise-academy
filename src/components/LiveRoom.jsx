import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Plus, Clock3, Download, Trash2 } from 'lucide-react';
import { canJoinLiveSession, LIVE_JOIN_WINDOW_MIN } from '../lib/liveSessionStatus';
import { downloadBlob, listPendingRecordings, deletePendingRecording } from '../lib/sessionRecorder';
import { useUI } from '../context/UIContext';
import { fetchGroupClassLink, fetchGroups } from '../lib/db';

const fmtSize = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);
const isLink = (link) => /^https:\/\//.test(link || '');

// Sala de una clase en vivo: todas las clases se dan en la sala fija de Google
// Meet de su aula (`groups/{id}.classLink`, ver createMeetSpace), que se abre
// en otra pestaña -- Meet no se puede incrustar. Antes había una sala de Jitsi
// embebida aquí; se quitó al pasar todo a Meet.
//
// Una clase suelta antigua sin aula usa la sala del aula si el curso tiene
// una sola.
// `canRecord`: docente/admin -- ve las grabaciones que la sala anterior dejó
// guardadas en este navegador, para descargarlas.
const LiveRoom = ({ session, scheduleLine, lobbyHeadline, lobbyMeta, joinLabel, secondaryAction, canRecord = false }) => {
  const { confirmDialog } = useUI();
  const [now, setNow] = useState(() => Date.now());
  const [meetLink, setMeetLink] = useState(null);
  const [linkLoaded, setLinkLoaded] = useState(false);
  const [pendingRecs, setPendingRecs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const resolve = session?.groupId
      ? fetchGroupClassLink(session.groupId)
      : !session?.courseId ? Promise.resolve(null) : fetchGroups(session.courseId).then((list) => {
        const withLink = list.filter((g) => g.status !== 'closed' && isLink(g.classLink));
        return withLink.length === 1 ? withLink[0].classLink : null;
      });
    resolve
      .then((l) => { if (!cancelled) setMeetLink(isLink(l) ? l : null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLinkLoaded(true); });
    return () => { cancelled = true; };
  }, [session?.groupId, session?.courseId]);

  // Solo las clases programadas (con startsAt) tienen ventana de entrada. Se
  // refresca cada 15 s mientras se espera, para que el botón se habilite solo.
  const hasSchedule = !!session?.startsAt;
  const joinable = !hasSchedule || canJoinLiveSession(session);
  useEffect(() => {
    if (joinable) return undefined;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [joinable]);
  const minutesUntilOpen = hasSchedule
    ? Math.max(0, Math.ceil((new Date(session.startsAt).getTime() - LIVE_JOIN_WINDOW_MIN * 60000 - now) / 60000))
    : 0;

  const refreshPending = useCallback(() => {
    if (canRecord) listPendingRecordings().then(setPendingRecs).catch(() => {});
  }, [canRecord]);
  useEffect(() => { refreshPending(); }, [refreshPending]);

  return (
    <div className="live-lobby">
      <div className="live-lobby-glow"></div>
      <h1 className="live-lobby-title">{lobbyHeadline || 'Abre la sala cuando sea el momento.'}</h1>
      <p className="live-lobby-course">{lobbyMeta ?? session?.courseTitle}</p>
      {scheduleLine && <p className="live-lobby-schedule">{scheduleLine}</p>}
      {!joinable && (
        <p className="live-lobby-wait"><Clock3 size={14} /> Podrás entrar {minutesUntilOpen > 0 ? `en ${minutesUntilOpen} min` : 'en unos segundos'} (se habilita {LIVE_JOIN_WINDOW_MIN} min antes de la hora).</p>
      )}
      {canRecord && pendingRecs.length > 0 && (
        <div className="live-rec-pending">
          <p>Grabaciones guardadas en este navegador. Descárgalas y bórralas cuando las hayas subido:</p>
          {pendingRecs.map((r) => (
            <div key={r.name} className="live-rec-pending-row">
              <span title={r.name}>{r.name} · {fmtSize(r.size)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadBlob(r.blob, r.name)}><Download size={14} /> Descargar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                if (!(await confirmDialog({ title: 'Borrar grabación', message: '¿Borrar esta grabación del navegador? Hazlo solo si ya la descargaste.', confirmLabel: 'Borrar', danger: true }))) return;
                await deletePendingRecording(r.name);
                refreshPending();
              }}><Trash2 size={14} /> Borrar</button>
            </div>
          ))}
        </div>
      )}
      <div className="live-lobby-controls">
        {meetLink ? (
          <a
            className={`btn btn-primary btn-lg ${joinable ? '' : 'disabled'}`}
            href={joinable ? meetLink : undefined}
            target="_blank" rel="noreferrer"
            aria-disabled={!joinable}
            onClick={(e) => { if (!joinable) e.preventDefault(); }}
            title={joinable ? 'Se abre en una pestaña nueva' : `Disponible ${LIVE_JOIN_WINDOW_MIN} min antes de la clase`}
          >
            {joinable ? <><ExternalLink size={16} /> {joinLabel || 'Entrar a la clase en Google Meet'}</> : 'Todavía no disponible'}
          </a>
        ) : linkLoaded && (
          <p className="live-lobby-wait">Esta clase todavía no tiene sala de Google Meet. Avísale a la academia.</p>
        )}
        {secondaryAction && <button className="btn btn-ghost btn-lg" onClick={secondaryAction.onClick}><Plus size={16} /> {secondaryAction.label}</button>}
      </div>
      {meetLink && joinable && <p className="live-lobby-schedule">Entra con tu correo de la academia (@netwiseacademy.pe).</p>}
    </div>
  );
};

export default LiveRoom;
