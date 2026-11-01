import React, { useState } from 'react';
import { Copy, Check, Info } from 'lucide-react';
import { meetShort } from '../lib/workGroups';

// Link de la sala con su ícono de copiar: al tocarlo se copia al instante.
export const CopyLink = ({ link, dark = false }) => {
  const [copied, setCopied] = useState(false);
  if (!link) return <span className={`copy-link ${dark ? 'is-dark' : ''}`} style={{ opacity: 0.7 }}>Creando la sala de Meet…</span>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin portapapeles */ }
  };
  return (
    <button type="button" className={`copy-link ${dark ? 'is-dark' : ''}`} onClick={copy} title="Copiar el link">
      {meetShort(link)} {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied && <span className="copy-link-done">Copiado</span>}
    </button>
  );
};

export const HowItWorks = ({ children }) => (
  <div className="admin-panel">
    <div className="admin-panel-head"><span className="admin-panel-title">Cómo funciona</span></div>
    <div className="cert-note" style={{ marginTop: 0 }}><Info size={14} /> {children}</div>
  </div>
);
