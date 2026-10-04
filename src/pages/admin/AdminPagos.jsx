import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchAcademySettings, saveAcademySettings, uploadPaymentQr, logChange } from '../../lib/db';
import { PAYMENT_METHODS as METHODS } from '../../lib/paymentMethods';

const QR_MAX_MB = 2;

// "Sube tu QR": arrastrar o elegir la imagen del código QR del método. Se sube
// al momento y queda en la configuración al guardar los cambios.
const QrUpload = ({ methodId, url, onChange }) => {
  const { addToast } = useUI();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const take = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { addToast('Usa una imagen JPG, PNG o WebP.', 'error'); return; }
    if (file.size > QR_MAX_MB * 1024 * 1024) { addToast(`La imagen supera los ${QR_MAX_MB} MB.`, 'error'); return; }
    setUploading(true);
    try {
      onChange(await uploadPaymentQr(methodId, file));
      addToast('QR cargado. Guarda los cambios para publicarlo.', 'success');
    } catch {
      addToast('No se pudo subir el QR. Intenta de nuevo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-field">
      <label>Sube tu QR</label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      {url ? (
        <div className="qr-upload-preview">
          <img src={url} alt="Código QR cargado" />
          <div>
            <button type="button" className="admin-btn-ghost" onClick={() => inputRef.current?.click()} disabled={uploading}><Upload size={13} /> {uploading ? 'Subiendo...' : 'Cambiar QR'}</button>
            <button type="button" className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => onChange(null)}><Trash2 size={13} /> Quitar</button>
            <span className="admin-cell-sub">Sin QR propio, el checkout muestra el QR por defecto de la academia.</span>
          </div>
        </div>
      ) : (
        <div
          className={`qr-upload-drop ${over ? 'over' : ''}`} role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
        >
          <Upload size={20} />
          <span>{uploading ? 'Subiendo...' : <>Arrastra y suelta o <u>elige el archivo</u> a subir.</>}</span>
          <span className="admin-cell-sub">Formato de archivo: JPG, PNG. Máx {QR_MAX_MB}.0MB</span>
        </div>
      )}
    </div>
  );
};

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

  const updateField = (id, field, value) => {
    setSettings((s) => ({
      ...s,
      paymentMethods: { ...s.paymentMethods, [id]: { ...s.paymentMethods?.[id], [field]: value } },
    }));
  };

  const handleSave = async () => {
    // Con un QR subido se puede pagar sin número: no se exige.
    const missing = METHODS.filter((m) => m.manual && settings.paymentMethods?.[m.id]?.enabled && !settings.paymentMethods[m.id]?.noNumber && !settings.paymentMethods[m.id]?.qrUrl && !settings.paymentMethods[m.id]?.number?.trim());
    if (missing.length > 0) {
      addToast(`Falta el número de ${missing.map((m) => m.label).join(' y ')} para poder activarlo.`, 'error');
      return;
    }
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
          <p className="admin-page-sub">Activa o desactiva cómo te pueden pagar tus alumnos, y con qué número y nombre.</p>
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
                  <>
                    <label className="admin-field-checkbox" style={{ marginBottom: 10 }}>
                      <input
                        type="checkbox" checked={!!cfg.noNumber}
                        onChange={(e) => updateField(m.id, 'noNumber', e.target.checked)}
                      /> No tiene número · solo código QR
                    </label>
                    <div className="admin-field-row">
                      {!cfg.noNumber && (
                        <div className="admin-field">
                          <label>{m.numberLabel}</label>
                          <input value={cfg.number || ''} onChange={(e) => updateField(m.id, 'number', e.target.value)} placeholder={m.numberPlaceholder} />
                        </div>
                      )}
                      <div className="admin-field">
                        <label>Nombre del titular</label>
                        <input value={cfg.accountName || ''} onChange={(e) => updateField(m.id, 'accountName', e.target.value)} placeholder="Ej. Netwise Academy SAC" />
                      </div>
                    </div>
                    {m.id === 'yape' && <QrUpload methodId={m.id} url={cfg.qrUrl || null} onChange={(url) => updateField(m.id, 'qrUrl', url)} />}
                    <div className="admin-field" style={{ marginBottom: 0 }}>
                      <label>Nota adicional · opcional</label>
                      <input value={cfg.note || ''} onChange={(e) => updateField(m.id, 'note', e.target.value)} placeholder={m.notePlaceholder} />
                    </div>
                    <p className="admin-panel-caption" style={{ marginBottom: 0 }}>
                      El comprador verá: {cfg.noNumber
                        ? `"${m.verb} [monto] escaneando el código QR${cfg.accountName ? ` (${cfg.accountName})` : ''}".`
                        : `"${m.verb} [monto] al ${cfg.number || '...'}${cfg.accountName ? ` (${cfg.accountName})` : ''}".`}
                    </p>
                  </>
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
