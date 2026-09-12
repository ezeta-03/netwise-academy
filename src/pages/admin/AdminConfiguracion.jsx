import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchAcademySettings, saveAcademySettings, logChange } from '../../lib/db';

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
    </div>
  );
};

export default AdminConfiguracion;
