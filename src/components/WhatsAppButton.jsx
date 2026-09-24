import React from 'react';
import { useLocation } from 'react-router-dom';

const PHONE = '51923681807';
const MASTERCLASS_MESSAGE = '¡Hola! 👋 Quiero información sobre las masterclass gratuitas de octubre de Netwise Academy.';
const MESSAGE = '¡Hola! 👋 Quiero conocer más sobre los talleres de IA, marketing y negocios digitales de Netwise Academy y cómo empezar a aplicarlos en mi propio proyecto 🚀';

// Botón flotante site-wide, con el mismo criterio de rutas "internas" que ya
// usa Navbar.jsx para ocultarse (player, live, los 3 paneles con su propio
// layout, y checkout) -- ahí no aporta y compite con la UI del propio panel.
const WhatsAppButton = () => {
  const location = useLocation();

  if (
    location.pathname.startsWith('/player') ||
    location.pathname.startsWith('/live/') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/teacher') ||
    location.pathname.startsWith('/student') ||
    location.pathname.startsWith('/checkout')
  ) {
    return null;
  }

  const text = location.pathname === '/masterclass' ? MASTERCLASS_MESSAGE : MESSAGE;
  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;

  return (
    <a className="whatsapp-float" href={href} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="#fff" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 4.99L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.23 0 4.32.87 5.89 2.44a8.27 8.27 0 0 1 2.44 5.8c0 4.55-3.7 8.25-8.26 8.25a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.55 3.71-8.25 8.18-8.25Zm-4.42 4.72c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.73 4.2 3.72 2.08.82 2.5.66 2.95.62.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.71-1.68-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.78.95-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.96-1.21-.72-.65-1.22-1.44-1.36-1.68-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47Z" />
      </svg>
    </a>
  );
};

export default WhatsAppButton;
