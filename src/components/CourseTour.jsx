import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import ModalPortal from './ModalPortal';
import './CourseTour.css';

// Recorrido guiado: oscurece la pantalla, resalta el elemento marcado con
// `data-tour="<target>"` de cada paso y muestra una tarjeta que explica qué se
// hace ahí. `secondary` marca con un anillo un segundo elemento (ej. la opción
// del menú de la página que se está mostrando). Un paso sin `target` se
// muestra centrado. Esc omite; ← / → navegan.
//
// `onBeforeStep(step)` prepara la pantalla (navegar a la página del paso,
// abrir el menú lateral en el teléfono...). Como la página nueva carga sus
// datos, el elemento se espera hasta TARGET_WAIT_MS antes de darlo por ausente.
const PAD = 6;
const CARD_W = 340;
const GAP = 14;
const TARGET_WAIT_MS = 2500;

const find = (target) => (target ? document.querySelector(`[data-tour="${target}"]`) : null);

const measure = (target, pad = PAD) => {
  const el = find(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // Recortado a la ventana: una página larga no debe "salirse" del resaltado.
  const top = Math.max(r.top - pad, 4);
  const left = Math.max(r.left - pad, 4);
  const bottom = Math.min(r.bottom + pad, window.innerHeight - 4);
  const right = Math.min(r.right + pad, window.innerWidth - 4);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
};

// Tarjeta a la derecha del elemento si cabe (menú lateral); si no, debajo o
// encima. Si el elemento ocupa casi toda la pantalla (una página entera), la
// tarjeta flota en la esquina inferior derecha. Siempre dentro de la ventana.
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
  if (rect.top - GAP - cardH >= 12) {
    return { top: rect.top - GAP - cardH, left: clampLeft(rect.left + rect.width - CARD_W) };
  }
  return { top: vh - cardH - 20, left: vw - CARD_W - 24 };
};

const CourseTour = ({ steps, startIndex = 0, onClose, onBeforeStep }) => {
  const [index, setIndex] = useState(startIndex);
  const [rect, setRect] = useState(null);
  const [ring, setRing] = useState(null);
  const [pos, setPos] = useState(null);
  const [waiting, setWaiting] = useState(false);
  // Teléfono: la tarjeta va abajo, salvo que tape lo resaltado.
  const [cardOnTop, setCardOnTop] = useState(false);
  const cardRef = useRef(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const relayout = useCallback(() => {
    const r = measure(step.target);
    const cardH = cardRef.current?.offsetHeight || 220;
    setRect(r);
    setRing(step.secondary ? measure(step.secondary, 3) : null);
    setPos(cardPosition(r, cardH));
    setCardOnTop(!!r && r.height < window.innerHeight * 0.6 && r.top + r.height > window.innerHeight - cardH - 24);
  }, [step]);

  // Preparar la pantalla, esperar a que el elemento exista, llevarlo a la vista y medir.
  useLayoutEffect(() => {
    let cancelled = false;
    const timers = [];
    onBeforeStep?.(step);
    const started = Date.now();
    // También la opción del menú marcada con el anillo: el menú lateral tiene
    // su propio desplazamiento y las últimas opciones pueden quedar ocultas.
    // Desplazamiento instantáneo (el sitio usa scroll-behavior: smooth): la
    // suavidad la pone el resaltado, que se desliza con su propia transición.
    const bringIntoView = () => {
      find(step.secondary)?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
      find(step.target)?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    };

    const settle = () => {
      if (cancelled) return;
      const ready = !step.target || find(step.target);
      if (!ready && Date.now() - started < TARGET_WAIT_MS) {
        setWaiting(true);
        timers.push(setTimeout(settle, 80));
        return;
      }
      setWaiting(false);
      bringIntoView();
      relayout();
      // Siguiente frame: la tarjeta ya tiene el texto del paso nuevo, así que
      // su altura (y por lo tanto su posición) es la definitiva.
      const raf = requestAnimationFrame(() => { if (!cancelled) relayout(); });
      timers.push({ raf });
      // El menú lateral del teléfono se abre con una transición y la página
      // puede terminar de pintar datos: volver a ubicar y medir.
      timers.push(setTimeout(() => { if (!cancelled) { bringIntoView(); relayout(); } }, 340));
    };
    settle();
    return () => {
      cancelled = true;
      timers.forEach((t) => (typeof t === 'object' ? cancelAnimationFrame(t.raf) : clearTimeout(t)));
    };
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

  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, [index]);

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
        {ring && <div className="tour-ring" style={ring} aria-hidden="true" />}
        <div
          ref={cardRef}
          className={`tour-card ${pos ? '' : 'tour-card-centered'} ${cardOnTop ? 'tour-card-top' : ''}`}
          style={pos || undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          aria-busy={waiting}
          tabIndex={-1}
        >
          <div className="tour-card-head">
            <span className="tour-step-count">
              {step.section ? `${step.section} · ` : ''}{index + 1} de {steps.length}
            </span>
            <button type="button" className="tour-skip" onClick={() => onClose('skipped')}>
              Omitir tutorial <X size={14} />
            </button>
          </div>
          {/* key = paso: cada paso vuelve a animar su entrada. */}
          <div key={step.id} className="tour-card-content">
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
