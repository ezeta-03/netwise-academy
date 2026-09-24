import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { LEGAL_PARTS, LEGAL_UPDATED_AT } from '../data/legalTerms';

const ListItem = ({ item }) => (typeof item === 'string'
  ? <li>{item}</li>
  : <li><strong>{item.term}:</strong> {item.text}</li>);

const Block = ({ block }) => {
  if (block.p) return <p>{block.p}</p>;
  if (block.ul) return <ul>{block.ul.map((item, i) => <ListItem key={i} item={item} />)}</ul>;
  if (block.table) {
    return (
      <div className="terms-table-wrap">
        <table className="terms-table">
          <thead><tr>{block.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {block.table.rows.map((row) => (
              <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
};

// Términos y Condiciones + Política de Privacidad (ver src/data/legalTerms.js).
// `initialTab`: 'terms' | 'privacy'. `onAccept` (opcional): se llama SOLO al
// pulsar "Entendido" -- lo usan los formularios para marcar su casilla de
// aceptación de Términos. Cerrar con la X, Esc o el fondo no acepta nada.
// Nunca usarlo para el consentimiento de marketing: ese va aparte y sin premarcar.
const TermsModal = ({ initialTab = 'terms', onClose, onAccept }) => {
  const [tab, setTab] = useState(initialTab);
  const bodyRef = useRef(null);
  const part = LEGAL_PARTS.find((p) => p.id === tab) || LEGAL_PARTS[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [tab]);

  return (
    <ModalPortal>
      <div className="admin-modal-overlay terms-modal-overlay" onClick={onClose}>
        <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" onClick={(e) => e.stopPropagation()}>
          <div className="terms-modal-head">
            <div>
              <h2 id="terms-modal-title" className="terms-modal-title">Términos y condiciones</h2>
              <p className="terms-modal-sub">Netwise Academy · Última actualización: {LEGAL_UPDATED_AT}</p>
            </div>
            <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <div className="terms-modal-tabs" role="tablist">
            {LEGAL_PARTS.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={tab === p.id}
                className={`terms-modal-tab${tab === p.id ? ' active' : ''}`} onClick={() => setTab(p.id)}>
                {p.tab}
              </button>
            ))}
          </div>
          <div className="terms-modal-body" ref={bodyRef}>
            <h3 className="terms-part-title">{part.title}</h3>
            {part.sections.map((s) => (
              <section key={s.title} className="terms-section">
                <h4>{s.title}</h4>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
          </div>
          <div className="terms-modal-foot">
            <button type="button" className="lead-submit-btn" onClick={() => { onAccept?.(); onClose(); }}>Entendido</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default TermsModal;
