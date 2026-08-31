// Miniatura real por curso (id -> imagen). Reusa las fotos cuadradas que
// quedaron libres desde que el hero de Inicio pasó a usar fotos panorámicas
// (ver src/assets/hero). Si en el futuro se agregan cursos sin foto propia
// todavía, los componentes deben usar el emoji/gradiente como respaldo.
import course1 from '../assets/carousel/carousel-desktop/desktop-1.webp';
import course2 from '../assets/carousel/carousel-desktop/desktop-2.webp';
import course3 from '../assets/carousel/carousel-desktop/desktop-3.webp';
import course4 from '../assets/carousel/carousel-desktop/desktop-4.webp';

export const COURSE_THUMBNAILS = {
  1: course1,
  2: course2,
  3: course3,
  4: course4,
};
