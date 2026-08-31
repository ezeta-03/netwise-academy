// Los 4 talleres del Pitch Deck (Propuesta de Valor). El conteo de cursos
// por categoría se calcula en Catalog.jsx a partir de COURSES, no aquí.
export const CATEGORIES = [
  { id:'redes-ia',       label:'📱 Redes Sociales & IA' },
  { id:'branding',       label:'🎨 Branding & Marca' },
  { id:'marketing',      label:'📈 Marketing Digital' },
  { id:'emprendimiento', label:'🚀 Emprendimiento Digital' },
];

// Los 4 talleres reales del Pitch Deck. "price" y "duration" quedan en null
// (aún no definidos) hasta que se confirme el precio y el cronograma de cada
// cohorte; la UI muestra "por confirmar" en su lugar.
export const COURSES = [
  {
    id: 1,
    title: 'Redes Sociales & IA',
    cat: 'redes-ia',
    emoji: '📱',
    color: '#1a1035,#0d1628',
    instructor: 'Netwise Agencia',
    summary: 'Del contenido manual a la creación asistida por Inteligencia Artificial para multiplicar la productividad de marca.',
    description: 'Aprende a planificar, crear y optimizar contenido usando las últimas herramientas de Inteligencia Artificial sin perder la identidad de tu marca.',
    highlights: [
      'Estrategia y prompts: flujo continuo de copys y gráficos',
      'Automatización de publicación y respuesta en redes',
      'Proyecto final: calendario de 30 días activado con IA',
    ],
    badge: 'Nuevo',
    price: null,
    duration: null,
  },
  {
    id: 2,
    title: 'Branding & Marca',
    cat: 'branding',
    emoji: '🎨',
    color: '#1a0d28,#28103a',
    instructor: 'Netwise Agencia',
    summary: 'Construcción de identidad de marca sólida: desde el propósito hasta el manual de aplicación para canales digitales.',
    description: 'Construye una identidad de marca sólida y coherente en todos tus canales digitales, desde el propósito hasta las aplicaciones visuales.',
    highlights: [
      'Propósito y territorio de marca',
      'Identidad visual y tono de comunicación',
      'Manual de marca para canales digitales',
    ],
    badge: 'Nuevo',
    price: null,
    duration: null,
  },
  {
    id: 3,
    title: 'Marketing Digital',
    cat: 'marketing',
    emoji: '📈',
    color: '#0d1a10,#102015',
    instructor: 'Netwise Agencia',
    summary: 'Estrategia y ejecución integral: Meta/Google Ads, SEO, automatizaciones y analítica para generar resultados.',
    description: 'Estrategia y ejecución integral de marketing digital: pauta en Meta y Google Ads, SEO, automatizaciones y analítica orientada a resultados.',
    highlights: [
      'Meta Ads y Google Ads de principio a fin',
      'SEO y automatizaciones de marketing',
      'Analítica y reportes con KPIs medibles',
    ],
    badge: 'Nuevo',
    price: null,
    duration: null,
  },
  {
    id: 4,
    title: 'Emprendimiento Digital',
    cat: 'emprendimiento',
    emoji: '🚀',
    color: '#28100d,#3a1a10',
    instructor: 'Netwise Agencia',
    summary: 'De la idea al negocio validado: modelo Canvas, Producto Mínimo Viable (MVP) y plan de lanzamiento a 90 días.',
    description: 'Lleva tu idea a un negocio validado: modelo Canvas, Producto Mínimo Viable (MVP) y un plan de lanzamiento a 90 días.',
    highlights: [
      'Modelo de negocio Canvas',
      'Producto Mínimo Viable (MVP) validado en mercado',
      'Plan de lanzamiento a 90 días',
    ],
    badge: 'Nuevo',
    price: null,
    duration: null,
  },
];

// Clases en vivo: se programan desde el panel de Docente (ver
// scheduleLiveSession en lib/db.js). En producción cada doc vive en la
// colección Firestore `liveSessions`.
export const LIVE_SESSIONS = [];
