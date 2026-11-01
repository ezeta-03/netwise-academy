import { useEffect, useState } from 'react';

// Hora actual que se renueva sola (cada 30 s por defecto): así la tarjeta de
// clase pasa de "Programada" a "En vivo" y a "Terminada" sin recargar.
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};
