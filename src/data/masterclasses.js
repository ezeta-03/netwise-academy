// Masterclass gratuitas de octubre 2026 -- una sola fuente para la landing
// (/masterclass), su formulario y el popup del Inicio. Si cambian fechas o
// textos, se cambian solo aquí.
import heroBranding from '../assets/masterclass/hero-branding.webp';
import heroMarketing from '../assets/masterclass/hero-marketing.webp';
import heroNegocios from '../assets/masterclass/hero-negocios.webp';
import heroRedes from '../assets/masterclass/hero-redes.webp';
import cardMarketing from '../assets/masterclass/card-marketing.webp';

export const MASTERCLASS_TIME = '8:00 p.m.';
export const MASTERCLASS_PLATFORM = 'Google Meet';
export const MASTERCLASS_DATES_LABEL = '6, 7, 14 y 15 de octubre';

export const MASTERCLASSES = [
  {
    id: 'branding',
    title: 'Branding y Gestión de Marca',
    titleTop: 'Branding y',
    titleAccent: 'Gestión de Marca',
    subtitle: 'Aprende a construir una marca que se recuerda y se vende.',
    // Inicio de la sesión en hora de Perú (UTC-5).
    startsAt: '2026-10-06T20:00:00-05:00',
    weekday: 'Martes',
    day: '06',
    month: 'OCT',
    dateLong: '06 de octubre',
    heroImage: heroBranding,
    cardImage: heroBranding,
    learn: [
      'Definir propósito, posicionamiento y público de tu marca.',
      'Construir una identidad visual y verbal coherente.',
      'Gestionar tu marca en redes y en cada punto de contacto.',
      'Evitar los errores que hacen que una marca no se recuerde.',
    ],
    forWho: 'Emprendedores, diseñadores y equipos que quieren una marca clara y rentable.',
  },
  {
    id: 'marketing',
    title: 'Marketing Digital',
    titleTop: 'Marketing',
    titleAccent: 'Digital',
    subtitle: 'Convierte cada campaña en clientes reales.',
    startsAt: '2026-10-07T20:00:00-05:00',
    weekday: 'Miércoles',
    day: '07',
    month: 'OCT',
    dateLong: '07 de octubre',
    heroImage: heroMarketing,
    cardImage: cardMarketing,
    cardImageWide: true,
    learn: [
      'Armar un embudo simple: de visitante a cliente.',
      'Elegir canales y formatos según tu objetivo.',
      'Leer las métricas que importan.',
      'Estructurar tu primera campaña con presupuesto controlado.',
    ],
    forWho: 'Negocios y profesionales que invierten en redes y quieren resultados medibles.',
  },
  {
    id: 'negocios',
    title: 'Creación de Negocios Digitales',
    titleTop: 'Creación de',
    titleAccent: 'Negocios digitales',
    subtitle: 'De la idea a un negocio digital funcionando.',
    startsAt: '2026-10-14T20:00:00-05:00',
    weekday: 'Miércoles',
    day: '14',
    month: 'OCT',
    dateLong: '14 de octubre',
    heroImage: heroNegocios,
    cardImage: heroBranding,
    learn: [
      'Validar tu idea antes de invertir tiempo y dinero.',
      'Definir modelo de negocio y propuesta de valor.',
      'Herramientas para lanzar: web, pagos y automatizaciones.',
      'Los primeros pasos para conseguir tus primeros clientes.',
    ],
    forWho: 'Personas con una idea o un negocio físico que quieren llevarlo a digital.',
  },
  {
    id: 'redes',
    title: 'Estrategia de Redes Sociales',
    titleTop: 'Estrategia de',
    titleAccent: 'Redes Sociales',
    subtitle: 'El algoritmo no te compara contra otras marcas, te compara contra el celular de tu cliente.',
    startsAt: '2026-10-15T20:00:00-05:00',
    weekday: 'Jueves',
    day: '15',
    month: 'OCT',
    dateLong: '15 de octubre',
    heroImage: heroRedes,
    cardImage: heroRedes,
    learn: [
      'Definir objetivos y elegir las redes donde está tu cliente.',
      'Crear contenido que detenga el scroll.',
      'Planificar un calendario de publicaciones sostenible.',
      'Medir resultados y ajustar tu estrategia con datos.',
    ],
    forWho: 'Emprendedores, community managers y negocios que quieren crecer en redes con un plan claro.',
  },
];

// Fin de la última sesión (2 h): después de esto el popup del Inicio deja de salir.
export const MASTERCLASS_CAMPAIGN_ENDS = '2026-10-15T22:00:00-05:00';
export const isMasterclassCampaignActive = (now = Date.now()) => now < new Date(MASTERCLASS_CAMPAIGN_ENDS).getTime();
