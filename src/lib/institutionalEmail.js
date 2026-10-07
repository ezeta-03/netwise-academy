// Correo institucional (nombre@netwiseacademy.pe): la parte antes de la arroba
// que se le propone a cada persona a partir de su nombre. El admin puede
// corregirla antes de crear la cuenta (ver InstitutionalAccountModal).
export const INSTITUTIONAL_DOMAIN = 'netwiseacademy.pe';

// Misma regla que valida la Cloud Function provisionInstitutionalAccount.
const LOCAL_PART = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
export const isValidLocalPart = (value) => LOCAL_PART.test(value || '') && value.length <= 60;

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);

// "nombre.apellido" en minúsculas y sin tildes. Con tres palabras se asume
// nombre + dos apellidos; con cuatro o más, dos nombres + apellidos. Un perfil
// sin nombre muestra su correo: de ese se toma lo que va antes de la arroba.
export const suggestLocalPart = (fullName) => {
  const words = String(fullName || '').split('@')[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter((w) => w && !PARTICLES.has(w));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return `${words[0]}.${words[words.length >= 4 ? 2 : 1]}`;
};
