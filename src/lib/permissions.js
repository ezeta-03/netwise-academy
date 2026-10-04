// Funciones del panel docente que el admin puede activar o quitar a cada
// docente (Admin > Docentes > Registrar/Editar). Se guardan en
// `users/{uid}.permissions` como { clave: true|false }.
//
// Un docente sin el campo (cuentas creadas antes de esto) tiene TODO permitido:
// así nada cambia para quien ya venía trabajando. El admin siempre puede todo.
export const TEACHER_PERMISSIONS = [
  { key: 'editContent', label: 'Editar módulos y lecciones' },
  { key: 'scheduleClasses', label: 'Programar clases en vivo' },
  { key: 'uploadMaterials', label: 'Subir materiales' },
  { key: 'grade', label: 'Ver fichas y calificar entregas' },
  { key: 'announce', label: 'Publicar anuncios' },
  { key: 'support', label: 'Responder soporte' },
];

export const allPermissions = () => Object.fromEntries(TEACHER_PERMISSIONS.map((p) => [p.key, true]));

// Permisos completos de un perfil: lo guardado, y `true` en lo que falte.
export const resolvePermissions = (stored) => ({ ...allPermissions(), ...(stored || {}) });

// ¿Puede este usuario usar esa función del panel docente?
export const can = (user, key) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions?.[key] !== false;
};
