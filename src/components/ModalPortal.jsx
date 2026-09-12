import { createPortal } from 'react-dom';

// Escapa el árbol de la página: cada vista está envuelta en `.anim-fade-up`,
// cuya animación de entrada deja un `transform` aplicado para siempre (incluso
// en reposo, translateY(0) sigue siendo un transform), y eso convierte a esa
// vista en el "containing block" de cualquier hijo `position: fixed` --
// rompiendo el centrado en viewport de los modales. Montar el overlay
// directamente en <body> evita el problema de raíz para todos los modales.
const ModalPortal = ({ children }) => createPortal(children, document.body);

export default ModalPortal;
