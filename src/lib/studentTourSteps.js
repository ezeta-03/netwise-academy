import {
  BookOpen, Video, FolderOpen, Target, ClipboardCheck, Users, UsersRound, Sparkles, Bell, HelpCircle,
  GraduationCap, Home, Calendar, CheckSquare, Headphones, BarChart3, ListChecks, PieChart, DoorOpen,
} from 'lucide-react';

// Pasos del recorrido del estudiante (CourseTour + StudentTourContext).
// - `route`: página a la que se navega antes de mostrar el paso (el tutorial
//   "hace clic" en cada sección para que se vea lo que tiene).
// - `target` / `secondary`: atributos data-tour del elemento resaltado y del
//   que se marca con un anillo (la opción del menú de esa página).
// - `inSidebar`: en el teléfono hay que abrir el menú lateral para verlo.
export const STUDENT_TOUR_KEY = 'student';

// Primer paso del bloque del aula: "Ver tutorial" dentro de un curso arranca aquí.
export const COURSE_TOUR_START = 'aula';

const generalSteps = () => [
  {
    id: 'welcome',
    route: '/student/inicio',
    icon: GraduationCap,
    title: '¡Te damos la bienvenida a Netwise Academy!',
    body: 'En un par de minutos recorremos juntos la plataforma: vamos a abrir cada sección para que veas qué encuentras en ella.',
    bullets: ['Avanza con los botones o con las flechas del teclado.', 'Puedes omitirlo cuando quieras y volver a verlo desde "Ver tutorial".'],
  },
  {
    id: 'inicio',
    section: 'Inicio',
    route: '/student/inicio',
    target: 'page',
    secondary: 'nav-/student/inicio',
    icon: Home,
    title: 'Inicio: tu semana de un vistazo',
    body: 'Cada vez que entres, empieza aquí:',
    bullets: ['Tus próximas clases en vivo.', 'Las entregas que tienes pendientes.', 'Tu avance general y acceso directo a tus cursos.'],
  },
  {
    id: 'agenda',
    section: 'Agenda',
    route: '/student/agenda',
    target: 'page',
    secondary: 'nav-/student/agenda',
    icon: Calendar,
    title: 'Agenda',
    body: 'Todas tus clases y reuniones en un calendario, con la hora de Perú. Desde aquí también puedes entrar a la clase cuando empiece.',
  },
  {
    id: 'cursos',
    section: 'Cursos',
    route: '/student/cursos',
    target: 'page',
    secondary: 'nav-/student/cursos',
    icon: BookOpen,
    title: 'Mis cursos',
    body: 'Los cursos en los que estás matriculado, con tu avance. Toca un curso para entrar a su aula. Si acabas de pagar, aquí verás "En validación" hasta que confirmemos tu pago.',
  },
  {
    id: 'entregas',
    section: 'Mis entregas',
    route: '/student/entregas',
    target: 'page',
    secondary: 'nav-/student/entregas',
    icon: CheckSquare,
    title: 'Mis entregas',
    body: 'Tus trabajos de todos los cursos, ordenados en Pendientes, En revisión y Calificadas, con sus fechas límite y los comentarios de tu docente.',
  },
  {
    id: 'soporte',
    section: 'Soporte',
    route: '/student/soporte',
    target: 'page',
    secondary: 'nav-/student/soporte',
    icon: Headphones,
    title: 'Soporte y tutorías',
    body: '¿Algo no funciona o necesitas ayuda con un tema? Envía una solicitud o reserva una tutoría y sigue su estado aquí.',
  },
  {
    id: 'notificaciones',
    route: '/student/inicio',
    target: 'notifications',
    icon: Bell,
    title: 'Notificaciones',
    body: 'La campana te avisa de clases próximas, notas nuevas y anuncios de tu docente.',
  },
];

const courseSteps = (course) => {
  const base = `/student/curso/${course.id}`;
  return [
    {
      id: COURSE_TOUR_START,
      section: 'Aula',
      route: `${base}/contenido`,
      target: 'course-context',
      inSidebar: true,
      icon: DoorOpen,
      title: `Tu aula de ${course.title}`,
      body: 'Al entrar a un curso, el menú cambia a las secciones de ese curso. Arriba ves tu grupo y tu avance: la barra sube a medida que completas las clases.',
    },
    {
      id: 'contenido',
      section: 'Contenido',
      route: `${base}/contenido`,
      target: 'page',
      secondary: 'nav-contenido',
      icon: BookOpen,
      title: 'Contenido: tu ruta de clases',
      body: 'El curso está organizado en módulos. En cada uno encuentras:',
      bullets: ['El objetivo y los temas del módulo.', 'Las sesiones en vivo: fecha, qué aprenderás y qué harás en clase.', 'Las grabaciones, para repasar cuando quieras.'],
    },
    {
      id: 'sala',
      section: 'Sala de reuniones',
      route: `${base}/sala`,
      target: 'page',
      secondary: 'nav-sala',
      icon: Video,
      title: 'Sala de reuniones',
      body: 'Entra aquí a tus clases en vivo a la hora programada. También puedes crear una sala privada para estudiar con tus compañeros.',
    },
    {
      id: 'materiales',
      section: 'Materiales',
      route: `${base}/materiales`,
      target: 'page',
      secondary: 'nav-materiales',
      icon: FolderOpen,
      title: 'Materiales',
      body: 'Lecturas, plantillas y presentaciones de cada clase. Descárgalas y vuelve a ellas cuando las necesites.',
    },
    {
      id: 'proyecto',
      section: 'Mi proyecto',
      route: `${base}/proyecto`,
      target: 'page',
      secondary: 'nav-proyecto',
      icon: Target,
      title: 'Mi proyecto',
      body: 'Durante todo el curso trabajas sobre una misma empresa, marca o idea. Defínela aquí una sola vez, marca los avances que aplicas en cada módulo y presenta tus avances.',
    },
    {
      id: 'evaluacion',
      section: 'Mis evaluaciones',
      route: `${base}/evaluacion?vista=entregas`,
      target: 'eval-nav',
      secondary: 'nav-evaluacion',
      icon: ClipboardCheck,
      title: 'Mis evaluaciones',
      body: 'Todo lo que cuenta para tu nota. Este panel tiene tres vistas; veamos cada una.',
    },
    {
      id: 'eval-entregas',
      section: 'Mis evaluaciones',
      route: `${base}/evaluacion?vista=entregas`,
      target: 'eval-main',
      secondary: 'eval-entregas',
      icon: ListChecks,
      title: 'Entregas y notas',
      body: 'Un bloque por módulo con lo que debes entregar:',
      bullets: [
        '"Presentar entrega": sube un archivo o pega un link.',
        '"Reemplazar entrega" si mejoras tu trabajo (tu docente vuelve a revisarlo).',
        'Tu nota sobre 20 y la retroalimentación de tu docente.',
      ],
    },
    {
      id: 'eval-notas',
      section: 'Mis evaluaciones',
      route: `${base}/evaluacion?vista=notas`,
      target: 'eval-main',
      secondary: 'eval-notas',
      icon: BarChart3,
      title: 'Mis notas',
      body: 'Cómo se calcula tu promedio: el peso de cada evaluación en la nota final y los requisitos para aprobar, con lo que ya cumples y lo que te falta.',
    },
    {
      id: 'eval-asistencia',
      section: 'Mis evaluaciones',
      route: `${base}/evaluacion?vista=asistencia`,
      target: 'eval-main',
      secondary: 'eval-asistencia',
      icon: UsersRound,
      title: 'Mi asistencia',
      body: 'Tu registro sesión por sesión: presente o falta. Necesitas el mínimo de asistencia para obtener la constancia.',
    },
    {
      id: 'eval-resumen',
      section: 'Mis evaluaciones',
      route: `${base}/evaluacion?vista=asistencia`,
      target: 'eval-resumen',
      icon: PieChart,
      title: 'Mi resumen',
      body: 'Tu promedio parcial, tu asistencia y tu estado en el curso (En curso, Aprobado o Sustitutoria), siempre a la vista.',
    },
    {
      id: 'comunidad',
      section: 'Comunidad',
      route: `${base}/comunidad`,
      target: 'page',
      secondary: 'nav-comunidad',
      icon: Users,
      title: 'Comunidad',
      body: 'Los anuncios de tu docente para el curso. Coméntalos para resolver dudas junto con tu grupo.',
    },
    {
      id: 'grupos',
      section: 'Grupos de trabajo',
      route: `${base}/grupos`,
      target: 'page',
      secondary: 'nav-grupos',
      icon: UsersRound,
      title: 'Grupos de trabajo',
      body: 'Arma tu equipo, invita a tus compañeros y reúnanse en una sala privada para avanzar juntos.',
    },
    {
      id: 'ia',
      section: 'Asistente IA',
      route: `${base}/ia`,
      target: 'page',
      secondary: 'nav-ia',
      icon: Sparkles,
      title: 'Asistente IA',
      body: 'Pregúntale cuando te trabes: te ayuda a repasar conceptos y a pensar tu siguiente paso. Tu criterio sigue siendo lo más importante.',
    },
  ];
};

// `course` = curso activo del alumno (null si todavía no tiene matrícula).
export const buildStudentTourSteps = (course) => [
  ...generalSteps(),
  ...(course ? courseSteps(course) : [{
    id: 'sin-curso',
    route: '/student/cursos',
    target: 'page',
    secondary: 'nav-/student/cursos',
    icon: BookOpen,
    title: 'Tu aula te espera',
    body: 'Cuando se confirme tu matrícula, tu curso aparecerá en "Mis cursos". Al entrar verás su aula: contenido, clases en vivo, materiales, proyecto y evaluaciones.',
  }]),
  {
    id: 'ayuda',
    route: course ? `/student/curso/${course.id}/contenido` : '/student/inicio',
    target: 'tour-help',
    icon: HelpCircle,
    title: '¿Quieres volver a verlo?',
    body: 'Este botón abre el tutorial cuando lo necesites, desde Inicio o desde cualquier curso. ¡Éxitos!',
  },
];
