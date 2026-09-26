import { BookOpen, Video, FolderOpen, Target, ClipboardCheck, Users, UsersRound, Sparkles, Bell, HelpCircle, GraduationCap, TrendingUp } from 'lucide-react';

// Pasos del recorrido del aula del estudiante (CourseTour). `target` apunta
// al atributo data-tour del elemento que se resalta (StudentCourseLayout);
// `inSidebar` indica que en el teléfono hay que abrir el menú lateral.
export const COURSE_TOUR_KEY = 'studentCourse';

export const buildCourseTourSteps = (course) => [
  {
    id: 'welcome',
    icon: GraduationCap,
    title: '¡Te damos la bienvenida a tu aula!',
    body: `Este es tu espacio de ${course.title}. En un minuto te mostramos dónde está cada cosa y qué puedes hacer en cada sección.`,
    bullets: ['Usa las flechas del teclado o los botones para avanzar.', 'Puedes omitirlo cuando quieras y volver a verlo desde "Ver tutorial".'],
  },
  {
    id: 'context',
    target: 'course-context',
    inSidebar: true,
    icon: TrendingUp,
    title: 'Tu curso y tu avance',
    body: 'Aquí ves el curso en el que estás, tu grupo y tu avance. La barra sube a medida que completas las clases.',
  },
  {
    id: 'contenido',
    target: 'nav-contenido',
    inSidebar: true,
    icon: BookOpen,
    title: 'Contenido: tu ruta de clases',
    body: 'El curso está organizado en módulos. En cada uno encuentras:',
    bullets: ['El objetivo y los temas del módulo.', 'Las sesiones en vivo: fecha, qué aprenderás y qué harás en clase.', 'Las grabaciones, para repasar cuando quieras.'],
  },
  {
    id: 'sala',
    target: 'nav-sala',
    inSidebar: true,
    icon: Video,
    title: 'Sala de reuniones',
    body: 'Entra aquí a tus clases en vivo a la hora programada. También puedes crear una sala privada para estudiar con tus compañeros.',
  },
  {
    id: 'materiales',
    target: 'nav-materiales',
    inSidebar: true,
    icon: FolderOpen,
    title: 'Materiales',
    body: 'Lecturas, plantillas y presentaciones de cada clase. Descárgalas y vuelve a ellas cuando las necesites.',
  },
  {
    id: 'proyecto',
    target: 'nav-proyecto',
    inSidebar: true,
    icon: Target,
    title: 'Mi proyecto',
    body: 'Durante todo el curso trabajas sobre una misma empresa, marca o idea. Defínela aquí una sola vez y ve marcando los avances que aplicas en cada módulo.',
  },
  {
    id: 'evaluacion',
    target: 'nav-evaluacion',
    inSidebar: true,
    icon: ClipboardCheck,
    title: 'Mis evaluaciones',
    body: 'Todo lo que cuenta para tu nota está aquí:',
    bullets: [
      'Presenta la entrega de cada módulo (archivo o link) y reemplázala si mejoras tu trabajo.',
      'Revisa tu nota y los comentarios de tu docente.',
      'Sigue tu promedio, tu asistencia y lo que te falta para aprobar.',
    ],
  },
  {
    id: 'comunidad',
    target: 'nav-comunidad',
    inSidebar: true,
    icon: Users,
    title: 'Comunidad',
    body: 'Los anuncios de tu docente para el curso. Coméntalos para resolver dudas junto con tu grupo.',
  },
  {
    id: 'grupos',
    target: 'nav-grupos',
    inSidebar: true,
    icon: UsersRound,
    title: 'Grupos de trabajo',
    body: 'Arma tu equipo, invita a tus compañeros y reúnanse en una sala privada para avanzar juntos.',
  },
  {
    id: 'ia',
    target: 'nav-ia',
    inSidebar: true,
    icon: Sparkles,
    title: 'Asistente IA',
    body: 'Pregúntale cuando te trabes: te ayuda a repasar conceptos y a pensar tu siguiente paso. Tu criterio sigue siendo lo más importante.',
  },
  {
    id: 'notificaciones',
    target: 'notifications',
    icon: Bell,
    title: 'Notificaciones',
    body: 'La campana te avisa de clases próximas, notas nuevas y anuncios de tu docente.',
  },
  {
    id: 'ayuda',
    target: 'tour-help',
    icon: HelpCircle,
    title: '¿Quieres volver a verlo?',
    body: 'Este botón abre el tutorial cuando lo necesites. ¡Éxitos en el curso!',
  },
];
