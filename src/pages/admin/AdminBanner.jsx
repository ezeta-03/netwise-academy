import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Eye, Bell, CalendarDays, Pencil, Upload, ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchCampusBanners, saveCampusBanner, uploadBannerImage } from '../../lib/db';
import { bannerState, activeBanner, bannerMissing, isExternalLink } from '../../lib/campusBanner';
import { toPeruIso, peruDateTimeParts } from '../../lib/liveScheduleGenerator';
import CampusBanner from '../../components/CampusBanner';
import ModalPortal from '../../components/ModalPortal';
import { useNow } from '../../hooks/useNow';

const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).replace('.', '');
const fmtFull = (iso) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).replace('.', '');
const STATE = { active: ['Activo', 'admin-status-green'], scheduled: ['Programado', 'admin-status-amber'], ended: ['Terminado', 'admin-status-gray'], removed: ['Quitado', 'admin-status-gray'] };

const ImagePick = ({ label, hint, value, onPick }) => {
  const ref = useRef(null);
  return (
    <div className="banner-drop" role="button" tabIndex={0} onClick={() => ref.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') ref.current?.click(); }}>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? <img src={value} alt={label} /> : <><Upload size={18} /><strong>{label}</strong><span>{hint}</span></>}
    </div>
  );
};

// Formulario para programar (o editar) un banner: dos imágenes obligatorias,
// título para la campana, link y fechas. Antes de guardar se ve la vista previa.
const BannerForm = ({ initial, onSaved, onCancel }) => {
  const { addToast } = useUI();
  const start = initial ? peruDateTimeParts(initial.startsAt) : { date: '', time: '08:00' };
  const end = initial ? peruDateTimeParts(initial.endsAt) : { date: '', time: '23:59' };
  const [form, setForm] = useState({
    desktopImage: initial?.desktopImage || '', mobileImage: initial?.mobileImage || '', title: initial?.title || '', link: initial?.link || '',
    startDate: start.date, startTime: start.time || '08:00', endDate: end.date, endTime: end.time || '23:59',
  });
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const startsAt = form.startDate ? toPeruIso(`${form.startDate}T${form.startTime}`) : '';
  const endsAt = form.endDate ? toPeruIso(`${form.endDate}T${form.endTime}`) : '';
  const missing = bannerMissing({ ...form, startsAt, endsAt });

  const upload = async (key, file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { addToast('Usa una imagen JPG o PNG.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { addToast('La imagen pesa más de 5 MB.', 'error'); return; }
    setUploading(true);
    try { set(key, await uploadBannerImage(file)); } catch { addToast('No se pudo subir la imagen.', 'error'); } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCampusBanner({ ...(initial?.id ? { id: initial.id } : {}), desktopImage: form.desktopImage, mobileImage: form.mobileImage, title: form.title.trim(), link: form.link.trim(), startsAt, endsAt });
      addToast(initial ? 'Banner actualizado.' : 'Banner programado. Reemplaza al activo en su fecha de inicio.', 'success');
      onSaved();
    } catch {
      addToast('No se pudo guardar el banner.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="banner-drops">
        <ImagePick label="Imagen para escritorio" hint="2160 × 480 px · JPG o PNG" value={form.desktopImage} onPick={(f) => upload('desktopImage', f)} />
        <ImagePick label="Imagen para celular" hint="686 × 400 px · JPG o PNG" value={form.mobileImage} onPick={(f) => upload('mobileImage', f)} />
      </div>
      <div className="admin-field-row">
        <div className="admin-field"><label>Título (se ve en la campana)</label><input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej.: Nueva guía gratuita" /></div>
        <div className="admin-field">
          <label>Link</label><input value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://..." />
          {isExternalLink(form.link) && <span className="admin-cell-sub" style={{ color: 'var(--accent)' }}>Se abre en otra pestaña</span>}
        </div>
      </div>
      <div className="admin-field-row">
        <div className="admin-field"><label>Desde</label><div style={{ display: 'flex', gap: 6 }}><input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /><input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></div></div>
        <div className="admin-field"><label>Hasta</label><div style={{ display: 'flex', gap: 6 }}><input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /><input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></div></div>
      </div>
      <div className="admin-modal-actions" style={{ alignItems: 'center' }}>
        {missing && <span className="admin-cell-sub" style={{ marginRight: 'auto', color: '#B45309' }}>{missing}</span>}
        {onCancel && <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>}
        <button className="admin-btn-ghost" disabled={!form.desktopImage} onClick={() => setPreview(true)}><Eye size={13} /> Vista previa</button>
        <button className="admin-btn-edit" disabled={!!missing || saving || uploading} onClick={save}>{saving ? 'Guardando...' : uploading ? 'Subiendo imagen...' : initial ? 'Guardar cambios' : 'Programar'}</button>
      </div>
      {preview && (
        <ModalPortal>
          <div className="admin-modal-overlay" onClick={() => setPreview(false)}>
            <div className="admin-modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-head"><div className="admin-modal-title">Vista previa</div><button className="admin-modal-close" onClick={() => setPreview(false)}><X size={18} /></button></div>
              <div className="submit-work-label">Escritorio</div>
              <CampusBanner banner={{ ...form, id: 'preview' }} preview />
              {form.mobileImage && <><div className="submit-work-label" style={{ marginTop: 14 }}>Celular</div><img src={form.mobileImage} alt="Celular" style={{ width: 280, borderRadius: 14 }} /></>}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

// Banner del campus (A7): ver el activo con sus clics, editarlo o quitarlo
// ya, programar el siguiente y ver los programados y los anteriores.
const AdminBanner = () => {
  const { addToast, confirmDialog } = useUI();
  const [banners, setBanners] = useState(null);
  const [editing, setEditing] = useState(null);
  const formRef = useRef(null);
  const now = useNow(60000);
  const load = useCallback(() => fetchCampusBanners().then(setBanners).catch(() => setBanners([])), []);
  useEffect(() => { load(); }, [load]);

  if (!banners) return <div className="admin-empty-hint">Cargando banner...</div>;
  const active = activeBanner(banners, now);
  const others = banners.filter((b) => b.id !== active?.id);

  const removeNow = async () => {
    if (!(await confirmDialog({ title: 'Quitar banner', message: `¿Quitar "${active.title}" ahora? El Inicio se verá sin banner hasta que empiece el siguiente.`, confirmLabel: 'Quitar ahora', danger: true }))) return;
    try {
      await saveCampusBanner({ id: active.id, removedAt: new Date().toISOString() });
      addToast('Banner quitado.', 'success');
      load();
    } catch {
      addToast('No se pudo quitar el banner.', 'error');
    }
  };

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Banner del campus</h1><p className="admin-page-sub">Una imagen con link, igual para todos los estudiantes. No se puede cerrar y también llega a la campana.</p></div>
        <button className="admin-btn-edit" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}><Plus size={14} /> Programar banner</button>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Banner activo</span></div>
        {!active ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>No hay banner activo: el Inicio del estudiante se ve sin banner.</p>
        ) : editing === active.id ? (
          <BannerForm initial={active} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
        ) : (
          <>
            <span className="admin-status admin-status-green">Activo · del {fmtDay(active.startsAt)} al {fmtDay(active.endsAt)}</span>
            <div className="banner-pair">
              <div><div className="work-section-label">Escritorio</div><img src={active.desktopImage} alt="Escritorio" /></div>
              <div><div className="work-section-label">Celular</div><img src={active.mobileImage} alt="Celular" /></div>
            </div>
            <div className="admin-field-row">
              <div className="admin-field"><label>Título (se ve en la campana)</label><div className="readonly-box">{active.title}</div></div>
              <div className="admin-field"><label>Link</label><div className="readonly-box"><ExternalLink size={12} /> {active.link}</div>{isExternalLink(active.link) && <span className="admin-cell-sub" style={{ color: 'var(--accent)' }}>Se abre en otra pestaña</span>}</div>
            </div>
            <div className="banner-stats">
              <span><Eye size={13} /> <strong>{active.clicks || 0} clics</strong></span>
              <span><Bell size={13} /> Enviado a la campana el {fmtDay(active.startsAt)}</span>
              <span><CalendarDays size={13} /> Se quita solo el {fmtFull(active.endsAt)}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="admin-btn-ghost" onClick={() => setEditing(active.id)}><Pencil size={13} /> Editar</button>
                <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={removeNow}>Quitar ahora</button>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }} ref={formRef}>
        <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Programar un banner nuevo</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Reemplaza al activo en la fecha de inicio.</p>
        <BannerForm key={banners.length} onSaved={load} />
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-panel-title">Programados y anteriores</span></div>
        {others.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no hay otros banners.</p> : others.map((b) => {
          const [label, cls] = STATE[bannerState(b, now)];
          return (
            <div key={b.id} className="dash-list-row">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <ImageIcon size={16} color="var(--accent)" />
                <div><div className="dash-list-row-title">{b.title}</div><div className="dash-list-row-sub">Del {fmtDay(b.startsAt)} al {fmtDay(b.endsAt)}{b.clicks ? ` · ${b.clicks} clics` : ''}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`admin-status ${cls}`}>{label}</span>
                <a className="admin-btn-ghost" href={b.desktopImage} target="_blank" rel="noreferrer">Ver</a>
                {bannerState(b, now) === 'scheduled' && <button className="admin-btn-ghost" onClick={() => setEditing(b.id)}>Editar</button>}
              </div>
            </div>
          );
        })}
        {editing && editing !== active?.id && (
          <div style={{ marginTop: 14, borderTop: '1px solid #ECEAF3', paddingTop: 14 }}>
            <BannerForm initial={banners.find((b) => b.id === editing)} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBanner;
