// Mensajes en español para los errores de Firebase Auth (antes se mostraba el
// texto crudo de Firebase, en inglés, o un mensaje genérico).
const MESSAGES = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es muy débil: usa al menos 8 caracteres.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos. Si ya tienes tu correo de la academia, entra con el botón "Ingresar con tu correo de la academia".',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/user-disabled': 'Tu cuenta está desactivada. Escríbenos a soporte si crees que es un error.',
  'app/account-disabled': 'Tu cuenta está desactivada. Escríbenos a soporte si crees que es un error.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  'auth/network-request-failed': 'No hay conexión. Revisa tu internet e intenta de nuevo.',
  'app/google-not-institutional': 'Ese botón es solo para tu correo de la academia (@netwiseacademy.pe). Si todavía no lo tienes, ingresa con tu correo y contraseña.',
  'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar. Intenta de nuevo.',
};

export const authErrorMessage = (error, fallback = 'No se pudo completar la operación. Intenta de nuevo.') => {
  const code = error?.code || error?.message?.match(/\(?(auth\/[a-z-]+|app\/[a-z-]+)\)?/)?.[1];
  return MESSAGES[code] || fallback;
};
