import React, { useEffect, useState } from 'react';
import { CreditCard, Smartphone, Landmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchAcademySettings, saveAcademySettings, logChange } from '../../lib/db';

const METHODS = [
  { id: 'yape', label: 'Yape Empresas / Plin Negocios', icon: Smartphone, manual: true },
  { id: 'card', label: 'Tarjeta de crédito/débito', icon: CreditCard, manual: false },
  { id: 'transfer', label: 'Transferencia bancaria', icon: Landmark, manual: true },
];

const AdminPagos = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  useEffect(() => { fetchAcademySettings().then(setSettings); }, []);

  const togglePayment = (id) => {
    setSettings((s) => ({
      ...s,
      paymentMethods: {
        ...s.paymentMethods,
        [id]: { ...s.paymentMethods?.[id], enabled: !s.paymentMethods?.[id]?.enabled },
      },
    }));
  };

  const updateInstructions = (id, text) => {
    setSettings((s) => ({
      ...s,
      paymentMethods: { ...s.paymentMethods, [id]: { ...s.paymentMethods?.[id], instructions: text } },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAcademySettings(settings);
      await logChange(adminName, 'Actualizó los métodos de pago.');
      addToast('Métodos de pago guardados.', 'success');
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="admin-empty-hint">Cargando métodos de pago...</div>;

  const enabledCount = METHODS.filter((m) => settings.paymentMethods?.[m.id]?.enabled).length;

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Métodos de pago</h1>
          <p className="admin-page-sub">Activa o desactiva cómo te pueden pagar tus alumnos en el checkout.</p>
        </div>
      </div>

      {enabledCount === 0 && (
        <div className="checkout-error" style={{ marginBottom: 16 }}>
          Ningún método está activo -- tus alumnos no podrán completar una compra. Activa al menos uno.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        {METHODS.map((m) => {
          const cfg = settings.paymentMethods?.[m.id] || { enabled: false };
          return (
            <div className="admin-panel" key={m.id}>
              <div className="admin-panel-head">
                <span className="admin-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <m.icon size={16} /> {m.label}
                </span>
                <label className="admin-toggle">
                  <input type="checkbox" checked={!!cfg.enabled} onChange={() => togglePayment(m.id)} />
                  <span className="admin-toggle-track"></span> {cfg.enabled ? 'Activo' : 'Inactivo'}
                </label>
              </div>
              {m.manual ? (
                cfg.enabled && (
                  <div className="admin-field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label>Instrucciones para el comprador</label>
                    <textarea
                      rows={3}
                      value={cfg.instructions || ''}
                      onChange={(e) => updateInstructions(m.id, e.target.value)}
                      placeholder="Ej. Yapea o plinea S/ [monto] al 987 654 321 - Netwise Academy SAC y envía tu comprobante por WhatsApp."
                    />
                  </div>
                )
              ) : (
                <p className="admin-panel-caption" style={{ marginTop: 8, marginBottom: 0 }}>
                  Muestra el formulario de tarjeta (aún sin pasarela de pago real conectada -- el cobro es simulado).
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="admin-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
        <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </div>
  );
};

export default AdminPagos;
