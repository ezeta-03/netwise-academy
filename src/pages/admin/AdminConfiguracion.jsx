import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Database, Trash2, Loader2 } from 'lucide-react';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAcademySettings, saveAcademySettings, logChange } from '../../lib/db';
import { DEMO_SIZES } from '../../lib/demoData';
import { seedDemoData, clearDemoData, countDemoData } from '../../lib/demoSeed';

// "Datos de ejemplo": llena la academia con alumnos, aulas, pedidos, entregas y
// asistencia ficticios para ver cómo se comporta con mucha gente, y los quita
// con un clic. Solo toca documentos marcados como ejemplo.
const DemoDataPanel = ({ adminName }) => {
  const { addToast, confirmDialog, refreshNotifications } = useUI();
  const { courses } = useCourseOfferings();
  const [size, setSize] = useState(DEMO_SIZES[0].value);
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(null); // 'seed' | 'clear'
  const [progress, setProgress] = useState('');

  const refresh = () => countDemoData().then(setCounts).catch(() => setCounts({ enrollments: 0, groups: 0, orders: 0, total: 0 }));
  useEffect(() => { refresh(); }, []);

  const hasDemo = (counts?.total || 0) > 0;
  const onProgress = (done, total) => setProgress(`${done} de ${total}`);

  const handleSeed = async () => {
    const label = DEMO_SIZES.find((s) => s.value === size)?.label || `${size} alumnos`;
    if (!(await confirmDialog({
      title: 'Poblar con datos de ejemplo',
      message: `Se crearán alumnos, matrículas, pedidos, aulas con su calendario, entregas y asistencia ficticios (${label}).\n\nAparecerán mezclados con los datos reales en todo el panel, marcados como "ejemplo", y los montos de Ventas subirán. Puedes quitarlos cuando quieras con "Eliminar datos de ejemplo".`,
      confirmLabel: 'Poblar',
    }))) return;
    setBusy('seed'); setProgress('');
    try {
      const summary = await seedDemoData({ courses, size, onProgress });
      await logChange(adminName, `Pobló la academia con datos de ejemplo: ${summary.students} alumnos, ${summary.enrollments} matrículas, ${summary.groups} aulas.`);
      addToast(`Listo: ${summary.students} alumnos, ${summary.enrollments} matrículas (${summary.unassigned} sin aula) y ${summary.groups} aulas de ejemplo.`, 'success');
      refreshNotifications();
    } catch {
      addToast('No se pudieron crear todos los datos de ejemplo. Usa "Eliminar datos de ejemplo" y vuelve a intentar.', 'error');
    } finally {
      setBusy(null); setProgress('');
      refresh();
    }
  };

  const handleClear = async () => {
    if (!(await confirmDialog({
      title: 'Eliminar datos de ejemplo',
      message: `Se borrarán los ${counts?.total || 0} registros marcados como ejemplo: sus matrículas, pedidos, aulas, clases, entregas y asistencia.\n\nLos datos reales no se tocan. Si asignaste alumnos reales a un aula de ejemplo, quedarán sin aula.`,
      confirmLabel: 'Eliminar', danger: true,
    }))) return;
    setBusy('clear'); setProgress('');
    try {
      const removed = await clearDemoData({ onProgress });
      await logChange(adminName, `Eliminó los datos de ejemplo (${removed} registros).`);
      addToast(`Se eliminaron ${removed} registros de ejemplo.`, 'success');
      refreshNotifications();
    } catch {
      addToast('No se pudo eliminar todo. Vuelve a intentar: lo que falte se borra en la siguiente pasada.', 'error');
    } finally {
      setBusy(null); setProgress('');
      refresh();
    }
  };

  return (
    <div className="admin-panel" style={{ maxWidth: 520, marginTop: 20 }}>
      <div className="admin-panel-head"><span className="admin-panel-title"><Database size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Datos de ejemplo</span></div>
      <p className="admin-cell-sub" style={{ marginBottom: 14 }}>Llena la academia con alumnos, aulas, pedidos, entregas y asistencia ficticios para ver cómo se comporta con mucha gente. Los alumnos de ejemplo no tienen cuenta: no pueden iniciar sesión.</p>
      <p className="dash-notice" style={{ marginTop: 0 }} role="status">
        {counts === null ? 'Revisando si hay datos de ejemplo...'
          : hasDemo ? `Hay datos de ejemplo cargados: ${counts.enrollments} matrículas, ${counts.groups} aulas y ${counts.orders} pedidos (${counts.total} registros en total).`
            : 'No hay datos de ejemplo cargados.'}
      </p>
      <div className="admin-field">
        <label htmlFor="demo-size">Tamaño</label>
        <select id="demo-size" value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={!!busy || hasDemo}>
          {DEMO_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {hasDemo && <span className="admin-cell-sub">Para cargar otro tamaño, primero elimina los que hay.</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="admin-btn-edit" onClick={handleSeed} disabled={!!busy || hasDemo || counts === null}>
          {busy === 'seed' ? <Loader2 size={14} className="spin" /> : <Database size={14} />} {busy === 'seed' ? `Poblando... ${progress}` : 'Poblar con datos de ejemplo'}
        </button>
        <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={handleClear} disabled={!!busy || !hasDemo}>
          {busy === 'clear' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} {busy === 'clear' ? `Eliminando... ${progress}` : 'Eliminar datos de ejemplo'}
        </button>
      </div>
    </div>
  );
};

const AdminConfiguracion = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  useEffect(() => { fetchAcademySettings().then(setSettings); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAcademySettings(settings);
      await logChange(adminName, 'Actualizó la configuración de la academia.');
      addToast('Configuración guardada.', 'success');
    } catch {
      addToast('No se pudo guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="admin-empty-hint">Cargando configuración...</div>;

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Configuración</h1>
          <p className="admin-page-sub">Datos generales de tu academia.</p>
        </div>
      </div>

      <div className="admin-panel" style={{ maxWidth: 520 }}>
        <div className="admin-field">
          <label>Nombre de la academia</label>
          <input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
        </div>
        <div className="admin-field">
          <label>Correo de soporte</label>
          <input type="email" value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Moneda</label>
            <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
              <option value="PEN">PEN · Soles peruanos</option>
              <option value="USD">USD · Dólares</option>
            </select>
          </div>
          <div className="admin-field">
            <label>Zona horaria</label>
            <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
              <option value="America/Lima">Hora de Perú (Lima)</option>
              <option value="America/Bogota">Hora de Colombia (Bogotá)</option>
              <option value="America/Mexico_City">Hora de México (CDMX)</option>
            </select>
          </div>
        </div>

        <div className="admin-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>

      <DemoDataPanel adminName={adminName} />
    </div>
  );
};

export default AdminConfiguracion;
