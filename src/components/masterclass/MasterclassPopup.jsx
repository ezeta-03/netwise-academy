import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import ModalPortal from '../ModalPortal';
import { MASTERCLASSES, MASTERCLASS_TIME, MASTERCLASS_PLATFORM, MASTERCLASS_DATES_LABEL, isMasterclassCampaignActive } from '../../data/masterclasses';
import logo from '../../assets/masterclass/logo.svg';
import photo from '../../assets/masterclass/hero-branding.webp';
import './masterclassPopup.css';

const OPEN_DELAY_MS = 5000;
const AUTO_CLOSE_MS = 5000;
const SEEN_KEY = 'nw_masterclass_popup_seen';

const alreadySeen = () => {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* sin storage: puede volver a salir */ }
};

// Popup de las masterclass en el Inicio: aparece a los 5 s y se cierra solo
// 5 s después, salvo que la persona interactúe (pasa el mouse, toca o enfoca
// algo dentro), en cuyo caso se queda hasta que lo cierre. Una vez por sesión
// y solo mientras dure la campaña (ver MASTERCLASS_CAMPAIGN_ENDS).
const MasterclassPopup = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const closeTimer = useRef(null);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!isMasterclassCampaignActive() || alreadySeen()) return undefined;
    const t = setTimeout(() => {
      // No encima de otro modal (login, términos...).
      if (document.querySelector('[aria-modal="true"], .admin-modal-overlay')) return;
      markSeen();
      setOpen(true);
      window.dataLayer?.push({ event: 'masterclass_popup_view' });
    }, OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open || held) return undefined;
    closeTimer.current = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(closeTimer.current);
  }, [open, held, close]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const hold = () => { if (!held) { clearTimeout(closeTimer.current); setHeld(true); } };

  const goToLanding = () => {
    window.dataLayer?.push({ event: 'masterclass_popup_click' });
    close();
    navigate('/masterclass');
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="mcp-overlay" onClick={close}>
        <div className="mcp" role="dialog" aria-modal="true" aria-labelledby="mcp-title"
          onClick={(e) => e.stopPropagation()} onPointerEnter={hold} onPointerDown={hold} onFocusCapture={hold}>
          <button type="button" className="mcp-close" onClick={close} aria-label="Cerrar"><X size={16} /></button>

          <div className="mcp-media">
            <img className="mcp-photo" src={photo} alt="" />
            <img className="mcp-logo" src={logo} alt="Netwise Academy" />
            <span className="mcp-live"><i /> EN VIVO · 100% GRATIS</span>
          </div>

          <div className="mcp-body">
            <span className="mcp-tag">MASTERCLASS GRATUITAS <ArrowUpRight size={16} /></span>
            <h2 id="mcp-title" className="mcp-title">3 masterclass <span>gratis en octubre</span></h2>
            <p className="mcp-desc">Clases prácticas en vivo para llevar tu marca y tu negocio al siguiente nivel.</p>
            <ul className="mcp-list">
              {MASTERCLASSES.map((m) => (
                <li key={m.id}>
                  <span className="mcp-date"><b>{m.day}</b><small>{m.month}</small></span>
                  <span><b>{m.title}</b><small>{m.weekday} · {MASTERCLASS_TIME} · {MASTERCLASS_PLATFORM}</small></span>
                </li>
              ))}
            </ul>
            <div className="mcp-cta-row">
              <button type="button" className="mcp-cta" onClick={goToLanding}>Reservar mi cupo gratis <ArrowRight size={18} /></button>
              <small className="mcp-note"><span className="mcp-note-desktop">Cupos limitados</span><span className="mcp-note-mobile">Cupos limitados · {MASTERCLASS_DATES_LABEL}</span></small>
            </div>
          </div>

          {!held && <div className="mcp-timer" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} aria-hidden="true" />}
        </div>
      </div>
    </ModalPortal>
  );
};

export default MasterclassPopup;
