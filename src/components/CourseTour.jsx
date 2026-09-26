import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import ModalPortal from './ModalPortal';
import './CourseTour.css';

// Recorrido guiado: oscurece la pantalla, resalta el elemento marcado con
// `data-tour="<target>"` de cada paso y muestra una tarjeta que explica qué se
// hace ahí. Un paso sin `target` (o cuyo elemento no está en pantalla) se
// muestra centrado. Esc omite; ← / → navegan.
//
// `onBeforeStep(step)` deja que el layout prepare la pantalla (ej. abrir el
// menú lateral en el teléfono) antes de medir el elemento.
const PAD = 6;
const CARD_W = 340;
const GAP = 14;

const measure = (target) => {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
};

// Tarjeta a la derecha del elemento si cabe (menú lateral); si no, debajo o
// encima. Siempre dentro de la ventana.
const cardPosition = (rect, cardH) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || vw <= 640) return null; // centrada / anclada abajo por CSS
  const clampTop = (t) => Math.max(12, Math.min(t, vh - cardH - 12));
  const clampLeft = (l) => Math.max(12, Math.min(l, vw - CARD_W - 12));
  if (rect.left + rect.width + GAP + CARD_W <= vw - 12) {
    return { top: clampTop(rect.top), left: rect.left + rect.width + GAP };
  }
  if (rect.top + rect.height + GAP + cardH <= vh - 12) {
    return { top: rect.top + rect.height + GAP, left: clampLeft(rect.left + rect.width - CARD_W) };
  }
  return { top: clampTop(rect.top - GAP - cardH), left: clampLeft(rect.left + rect.width - CARD_W) };
};

const CourseTour = ({ steps, onClose, onBeforeStep }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  // Teléfono: la tarjeta va abajo, salvo que tape lo resaltado.
  const [cardOnTop, setCardOnTop] = useState(false);
  const cardRef = useRef(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const relayout = useCallback(() => {
    const r = measure(step.target);
    const cardH = cardRef.current?.offsetHeight || 220;
    setRect(r);
    setPos(cardPosition(r, cardH));
    setCardOnTop(!!r && r.top + r.height > window.innerHeight - cardH - 24);
  }, [step]);

  // Preparar la pantalla, llevar el elemento a la vista y medir.
  useLayoutEffect(() => {
    onBeforeStep?.(step);
    const bringIntoView = () => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      el?.scrollIntoView?.({ block: 'nearest' });
    };
    bringIntoView();
    relayout();
    // El menú lateral del teléfono se abre con una transición: volver a
    // ubicar y medir al terminar.
    const t = setTimeout(() => { bringIntoView(); relayout(); }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    window.addEventListener('resize', relayout);
    window.addEventListener('scroll', relayout, true);
    return () => {
      window.removeEventListener('resize', relayout);
      window.removeEventListener('scroll', relayout, true);
    };
  }, [relayout]);

  useEffect(() => { cardRef.current?.focus(); }, [index]);

  const next = useCallback(() => (isLast ? onClose('done') : setIndex((i) => i + 1)), [isLast, onClose]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose('skipped'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const Icon = step.icon;

  return (
    <ModalPortal>
      <div className="tour-root">
        {/* Captura los clics fuera de la tarjeta: el recorrido se cierra solo con "Omitir" o al terminar. */}
        <div className={`tour-backdrop ${rect ? '' : 'tour-backdrop-dim'}`} />
        {rect && <div className="tour-spotlight" style={rect} aria-hidden="true" />}
        <div
          ref={cardRef}
          className={`tour-card ${pos ? '' : 'tour-card-centered'} ${cardOnTop ? 'tour-card-top' : ''}`}
          style={pos || undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          tabIndex={-1}
        >
          <div className="tour-card-head">
            <span className="tour-step-count">Paso {index + 1} de {steps.length}</span>
            <button type="button" className="tour-skip" onClick={() => onClose('skipped')}>
              Omitir tutorial <X size={14} />
            </button>
          </div>
          <div className="tour-title-row">
            {Icon && <span className="tour-icon"><Icon size={18} /></span>}
            <h2 id="tour-title" className="tour-title">{step.title}</h2>
          </div>
          <div id="tour-body" className="tour-body">
            <p>{step.body}</p>
            {step.bullets?.length > 0 && (
              <ul>{step.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            )}
          </div>
          <div className="tour-progress" aria-hidden="true">
            {steps.map((s, i) => <span key={s.id} className={i === index ? 'active' : i < index ? 'done' : ''} />)}
          </div>
          <div className="tour-actions">
            {index > 0 ? (
              <button type="button" className="tour-btn-ghost" onClick={prev}><ArrowLeft size={14} /> Anterior</button>
            ) : <span />}
            <button type="button" className="tour-btn-primary" onClick={next}>
              {isLast ? '¡Empezar!' : index === 0 ? 'Comenzar recorrido' : 'Siguiente'} {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CourseTour;
