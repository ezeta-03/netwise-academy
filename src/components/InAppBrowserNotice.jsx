import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

// Navegadores dentro de otras apps (WhatsApp, Instagram, Facebook, TikTok...):
// Google bloquea ahí su inicio de sesión (403 disallowed_useragent) y suelen
// impedir la ventana emergente. `; wv)` marca cualquier WebView de Android; en
// iOS, un WebView no anuncia "Safari/" (salvo la PWA instalada, que sí sirve).
const IN_APP_UA = /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|BytedanceWebview|TikTok|LinkedInApp|Line\/|; wv\)/i;

const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (IN_APP_UA.test(ua)) return true;
  const standalone = navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches;
  return /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !standalone;
};

const isAndroid = () => /Android/i.test(navigator.userAgent || '');

const InAppBrowserNotice = ({ tone = 'dark' }) => {
  const [copied, setCopied] = useState(false);
  if (!isInAppBrowser()) return null;

  const url = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copia este enlace y pégalo en tu navegador:', url);
    }
    setCopied(true);
  };
  // En Android, un intent abre la misma página directo en Chrome.
  const chromeIntent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;

  return (
    <div className={`inapp-notice inapp-notice--${tone}`}>
      <p>
        <strong>Estás dentro de otra app.</strong> Para entrar con tu correo de la academia, abre esta página en {isAndroid() ? 'Chrome' : 'Safari'}: Google no permite iniciar sesión desde aquí.
      </p>
      <div className="inapp-notice-actions">
        {isAndroid() && <a href={chromeIntent} className="inapp-notice-btn"><ExternalLink size={14} /> Abrir en Chrome</a>}
        <button type="button" className="inapp-notice-btn" onClick={copy}>
          {copied ? <><Check size={14} /> Enlace copiado</> : <><Copy size={14} /> Copiar enlace</>}
        </button>
      </div>
      {!isAndroid() && <p className="inapp-notice-hint">También puedes tocar ⋯ o el ícono de compartir y elegir "Abrir en el navegador".</p>}
    </div>
  );
};

export default InAppBrowserNotice;
