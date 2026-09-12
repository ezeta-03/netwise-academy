import { Video, MessageSquare, FolderOpen, Target } from 'lucide-react';
import aprendeImg from '../assets/NETWISE ACADEMY WEB/aprende.webp';
import aplicaImg from '../assets/NETWISE ACADEMY WEB/aplica.webp';
import creceImg from '../assets/NETWISE ACADEMY WEB/crece.webp';

// Compartido entre Home (teaser) y Metodologia (página completa) para no
// mantener la misma copia en dos lugares.
export const METHOD_STEPS = [
  {
    id: 'aprende',
    title: 'Aprende',
    image: aprendeImg,
    desc: 'Conoce herramientas actuales en clases en vivo. Pregunta, comparte y aprende junto a personas que también quieren avanzar.',
    resultTitle: ['Entiende la herramienta.', 'Descubre lo que puedes hacer.'],
    resultDesc: 'Conoce conceptos y herramientas actuales en clases online en vivo. Pregunta, comparte ideas y conecta cada tema con una necesidad de tu proyecto.',
  },
  {
    id: 'aplica',
    title: 'Aplica',
    image: aplicaImg,
    desc: 'Trabaja sobre tu negocio, tu marca o una idea propia. Cada clase se convierte en un avance que recibe feedback.',
    resultTitle: ['Trabaja tu proyecto.', 'Convierte cada clase en un avance.'],
    resultDesc: 'Aplica lo aprendido sobre tu negocio, tu marca o una idea propia. Cada entrega recibe feedback real de tu docente para definir tu siguiente paso.',
  },
  {
    id: 'crece',
    title: 'Crece',
    image: creceImg,
    desc: 'Termina con un resultado que puedes mostrar y utilizar. Convierte lo aprendido en el siguiente paso de tu carrera o negocio.',
    resultTitle: ['Muestra tu resultado.', 'Da el siguiente paso.'],
    resultDesc: 'Termina el taller con un proyecto real que puedes mostrar y utilizar, listo para convertirse en el siguiente paso de tu carrera o negocio.',
  },
];

export const FEATURES = [
  { icon: Video, title: 'Clases en vivo', desc: 'Dos sesiones de 2 horas por semana, con espacio para preguntar y aprender junto al docente.', tag: '4 horas por semana' },
  { icon: MessageSquare, title: 'Feedback docente', desc: 'Revisión de tus entregables y comentarios concretos para mejorar cada avance.', tag: 'Acompañamiento' },
  { icon: FolderOpen, title: 'Recursos de consulta', desc: 'Materiales de apoyo para repasar lo trabajado y practicar entre sesiones.', tag: 'A tu propio ritmo' },
  { icon: Target, title: 'Proyecto aplicado', desc: 'Un entregable por módulo y un proyecto final desarrollado sobre tu marca, negocio o idea.', tag: 'Resultado final' },
];

export const METHOD_FAQ = [
  {
    q: '¿Necesito tener un negocio?',
    a: 'No. Puedes trabajar sobre una idea, una marca personal, un proyecto de tu trabajo o tu propio emprendimiento. Lo importante es contar con un caso en el que puedas aplicar lo aprendido.',
  },
  {
    q: '¿Necesito experiencia previa?',
    a: 'No es necesario. Cada taller parte de lo esencial y el docente ajusta el ritmo según tu nivel, seas principiante o ya tengas experiencia en el tema.',
  },
  {
    q: '¿Cómo organizo mi aprendizaje?',
    a: 'Tienes dos clases en vivo a la semana más un espacio de soporte práctico y asistente IA sin costo extra. Las clases quedan grabadas para que repases cuando lo necesites.',
  },
  {
    q: '¿Qué obtengo al finalizar?',
    a: 'Un proyecto propio aplicado a tu negocio, marca o idea, feedback directo de tu docente en cada entrega, y un certificado de finalización del taller.',
  },
];
