import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Loader2, AlertTriangle, Check } from 'lucide-react';
import { confirmProgramDownload } from '../lib/db';
import { downloadProgramPdf } from '../lib/programDownloads';
import { useCourseOfferings } from '../context/CourseOfferingsContext';

// Destino del botón "Descargar programa" del correo (ver sendProgramEmail).
// Abrirla confirma que el correo es real y descarga el PDF del curso; el
// enlace sigue sirviendo para volver a bajarlo. Va con la barra principal del
// sitio (Navbar), así que no lleva barra propia como /auth/accion.
const ProgramDownload = () => {
  const { token } = useParams();
  const { courses } = useCourseOfferings();
  const [stage, setStage] = useState('checking'); // 'checking' | 'ready' | 'invalid' | 'error'
  const [courseId, setCourseId] = useState(null);

  const course = courses.find((c) => String(c.id) === String(courseId));

  useEffect(() => {
    let cancelled = false;
    confirmProgramDownload(token)
      .then((data) => { if (!cancelled) { setCourseId(data.courseId); setStage('ready'); } })
      .catch((err) => { if (!cancelled) setStage(err?.code === 'functions/not-found' ? 'invalid' : 'error'); });
    return () => { cancelled = true; };
  }, [token]);

  // La descarga arranca sola solo la primera vez que se abre el enlace en este
  // navegador; al volver (o recargar) queda el botón para bajarlo a mano.
  const storageKey = `nw_program_downloaded_${token}`;
  const [firstVisit] = useState(() => {
    try { return !localStorage.getItem(storageKey); } catch { return true; }
  });
  useEffect(() => {
    if (stage !== 'ready' || !course || !firstVisit) return;
    try { localStorage.setItem(storageKey, new Date().toISOString()); } catch { /* sin almacenamiento: no se recuerda */ }
    downloadProgramPdf(course);
  }, [stage, course, firstVisit, storageKey]);

  return (
    <div className="view active auth-action">
      <div className="checkout-body">
        <div className="auth-action-card">
          {stage === 'checking' && (
            <div className="auth-action-center" role="status">
              <Loader2 size={28} className="spin" />
              <p className="auth-action-desc">Preparando tu programa...</p>
            </div>
          )}

          {stage === 'ready' && (
            <div className="auth-action-center">
              <div className="auth-action-icon auth-action-icon-ok"><Check size={26} /></div>
              <h1 className="auth-action-title">{firstVisit ? 'Tu programa se está descargando' : 'Tu programa del curso'}</h1>
              <p className="auth-action-desc">
                {course ? <>Programa de <strong>{course.title}</strong>: módulos, contenidos y entregables.</> : 'Programa del curso.'} {firstVisit ? 'Si no empezó la descarga, usa el botón.' : 'Descárgalo otra vez cuando quieras.'}
              </p>
              <button type="button" className="checkout-submit-btn" onClick={() => course && downloadProgramPdf(course)} disabled={!course}>
                <Download size={16} /> Descargar programa
              </button>
              {course && <Link to={`/course/${course.id}`} className="terms-link" style={{ marginTop: 16 }}>Ver horarios e inscribirme</Link>}
            </div>
          )}

          {(stage === 'invalid' || stage === 'error') && (
            <div className="auth-action-center">
              <div className="auth-action-icon auth-action-icon-warn"><AlertTriangle size={24} /></div>
              <h1 className="auth-action-title">{stage === 'invalid' ? 'Este enlace no es válido' : 'No pudimos abrir tu programa'}</h1>
              <p className="auth-action-desc">
                {stage === 'invalid'
                  ? 'Revisa que hayas abierto el botón del correo completo, o vuelve a pedir el programa desde la página del curso.'
                  : 'Revisa tu conexión e intenta de nuevo en unos minutos.'}
              </p>
              {stage === 'error' && <button type="button" className="checkout-submit-btn" onClick={() => window.location.reload()}>Intentar de nuevo</button>}
              <Link to="/cursos" className="terms-link" style={{ marginTop: 16 }}>Ver los cursos</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramDownload;
