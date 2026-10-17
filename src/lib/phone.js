// Número listo para un enlace de WhatsApp (https://wa.me/<número>): solo
// dígitos, con código de país. Un celular peruano escrito sin código (9 dígitos
// que empiezan en 9) recibe el 51. Devuelve null si no parece un número válido.
export const toWhatsAppNumber = (phone, defaultCountry = '51') => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) return `${defaultCountry}${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

// Enlace de WhatsApp con el mensaje ya escrito. Sin un número válido abre
// WhatsApp para que quien envía elija el contacto.
export const whatsAppLink = (phone, message) => {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number || ''}?text=${encodeURIComponent(message)}`;
};

// Celular peruano: 9 dígitos que empiezan en 9, con o sin +51 delante.
// Devuelve los 9 dígitos, o null si no lo es.
export const toPeruMobile = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('51')) digits = digits.slice(2);
  return /^9\d{8}$/.test(digits) ? digits : null;
};

// Formato de correo: algo@dominio.ext, con una extensión de al menos 2 letras.
// (Que el dominio reciba correo lo comprueba la función sendProgramEmail.)
export const isEmailFormat = (email) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email || '').trim());
