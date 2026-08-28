export const CATEGORIES = [
  { id:'web',    label:'🌐 Desarrollo Web',       count:140 },
  { id:'data',   label:'📊 Data Science',          count:85  },
  { id:'design', label:'🎨 Diseño UX/UI',          count:72  },
  { id:'mobile', label:'📱 Mobile Dev',            count:60  },
  { id:'cloud',  label:'☁️ Cloud & DevOps',        count:54  },
  { id:'ai',     label:'🤖 IA & Machine Learning', count:98  },
  { id:'biz',    label:'💼 Negocios',              count:66  },
  { id:'cyber',  label:'🔐 Ciberseguridad',        count:41  },
];

export const COURSES = [
  { id:1,  title:'React Avanzado: Hooks, Context y Patrones',  cat:'web',    emoji:'⚛️', color:'#1a1035,#0d1628', instructor:'Carlos Mendoza',  rating:4.9, students:12540, price:29.99, oldPrice:89.99,  duration:'24h', level:'intermedio',   enrolled:true,  progress:65, badge:'Más vendido',  video:'https://www.youtube.com/embed/TNhaISOUy6Q?autoplay=1' },
  { id:2,  title:'Python para Data Science & Machine Learning', cat:'data',   emoji:'🐍', color:'#1a2810,#0d1a0d', instructor:'Laura Jiménez',   rating:4.8, students:9820,  price:24.99, oldPrice:79.99,  duration:'36h', level:'principiante', enrolled:true,  progress:32, badge:'Nuevo',        video:'https://www.youtube.com/embed/LHBE0uHiMZo?autoplay=1' },
  { id:3,  title:'UI/UX Design con Figma: De cero a experto',  cat:'design', emoji:'🎨', color:'#1a0d28,#28103a', instructor:'Sofía Torres',    rating:4.7, students:7340,  price:0,     oldPrice:0,      duration:'18h', level:'principiante', enrolled:false, progress:0,  badge:'Gratis',       video:'https://www.youtube.com/embed/FTFaQWZBqQ8?autoplay=1' },
  { id:4,  title:'Node.js & Express: APIs REST Profesionales', cat:'web',    emoji:'🟩', color:'#0d1a10,#102015', instructor:'Miguel Santos',   rating:4.9, students:15200, price:34.99, oldPrice:99.99,  duration:'28h', level:'intermedio',   enrolled:true,  progress:18, badge:'Bestseller',   video:'https://www.youtube.com/embed/Oe421EPjeBE?autoplay=1' },
  { id:5,  title:'Flutter: Apps Móviles iOS & Android',        cat:'mobile', emoji:'💙', color:'#0d1428,#0d1a35', instructor:'Ana Gómez',       rating:4.6, students:5680,  price:19.99, oldPrice:59.99,  duration:'22h', level:'intermedio',   enrolled:false, progress:0,  badge:'',             video:'https://www.youtube.com/embed/VPvVD8t02U8?autoplay=1' },
  { id:6,  title:'Machine Learning con TensorFlow & PyTorch',  cat:'ai',     emoji:'🧠', color:'#28100d,#3a1a10', instructor:'Roberto Kim',     rating:4.8, students:8900,  price:39.99, oldPrice:119.99, duration:'40h', level:'avanzado',     enrolled:false, progress:0,  badge:'Premium',      video:'https://www.youtube.com/embed/tPYj3fFJGjk?autoplay=1' },
  { id:7,  title:'AWS Cloud Practitioner: Certificación',      cat:'cloud',  emoji:'☁️', color:'#1a1010,#281510', instructor:'Diana Ruiz',      rating:4.7, students:11200, price:29.99, oldPrice:89.99,  duration:'32h', level:'principiante', enrolled:true,  progress:75, badge:'Certificación', video:'https://www.youtube.com/embed/3hLmDS179YE?autoplay=1' },
  { id:8,  title:'TypeScript Completo: De JS a TS Profesional',cat:'web',    emoji:'🔷', color:'#0d1428,#102040', instructor:'Andrés Vargas',   rating:4.8, students:6700,  price:0,     oldPrice:0,      duration:'15h', level:'intermedio',   enrolled:false, progress:0,  badge:'Gratis',       video:'https://www.youtube.com/embed/BwuLxPH8IDs?autoplay=1' },
  { id:9,  title:'SQL & PostgreSQL: Bases de Datos Pro',       cat:'data',   emoji:'🐘', color:'#0d1828,#102030', instructor:'Marta León',      rating:4.6, students:4520,  price:22.99, oldPrice:69.99,  duration:'20h', level:'principiante', enrolled:false, progress:0,  badge:'',             video:'https://www.youtube.com/embed/qw--VYLpxG4?autoplay=1' },
  { id:10, title:'Ciberseguridad: Ethical Hacking',            cat:'cyber',  emoji:'🔐', color:'#0d1a10,#0f200f', instructor:'Pedro Castillo',  rating:4.9, students:3200,  price:49.99, oldPrice:149.99, duration:'45h', level:'avanzado',     enrolled:false, progress:0,  badge:'Hot 🔥',       video:'https://www.youtube.com/embed/3Kq1MIfTWCE?autoplay=1' },
  { id:11, title:'Marketing Digital & Growth Hacking',         cat:'biz',    emoji:'📈', color:'#1a1420,#201528', instructor:'Valeria Moreno',  rating:4.5, students:8900,  price:0,     oldPrice:0,      duration:'14h', level:'principiante', enrolled:false, progress:0,  badge:'Gratis',       video:'https://www.youtube.com/embed/bixR-KIJKYM?autoplay=1' },
  { id:12, title:'Docker & Kubernetes: DevOps Moderno',        cat:'cloud',  emoji:'🐳', color:'#0d1a28,#102035', instructor:'Luis Chen',       rating:4.8, students:7100,  price:34.99, oldPrice:109.99, duration:'30h', level:'avanzado',     enrolled:false, progress:0,  badge:'',             video:'https://www.youtube.com/embed/3c-iBn73dDE?autoplay=1' },
];

export const CURRICULUM_DATA = [
  { module:'Módulo 1: Fundamentos de React', lessons:[
    {title:'Configuración del entorno',      dur:'12m', type:'video', done:true},
    {title:'JSX y componentes funcionales',  dur:'18m', type:'video', done:true},
    {title:'Props y desestructuración',      dur:'22m', type:'video', done:true},
    {title:'Quiz: Fundamentos',              dur:'10m', type:'quiz',  done:true},
  ]},
  { module:'Módulo 2: Hooks Básicos', lessons:[
    {title:'useState en profundidad',        dur:'25m', type:'video', done:true},
    {title:'useEffect y su ciclo de vida',   dur:'30m', type:'video', done:true},
    {title:'useRef y DOM manipulation',      dur:'20m', type:'video', done:true},
    {title:'Proyecto: Todo App con Hooks',   dur:'45m', type:'doc',   done:true},
  ]},
  { module:'Módulo 3: Optimización', lessons:[
    {title:'useCallback: cuándo y cómo',     dur:'22m', type:'video', done:true},
    {title:'useMemo y React.memo',           dur:'18m', type:'video', done:false, current:true},
    {title:'Profiling con React DevTools',   dur:'20m', type:'video', done:false},
    {title:'Code splitting y lazy loading',  dur:'25m', type:'video', done:false},
  ]},
  { module:'Módulo 4: Context y Estado Global', lessons:[
    {title:'useContext: el patrón Provider', dur:'28m', type:'video', done:false, locked:true},
    {title:'useReducer + Context',           dur:'35m', type:'video', done:false, locked:true},
    {title:'Zustand como alternativa ligera',dur:'22m', type:'video', done:false, locked:true},
  ]},
  { module:'Módulo 5: Patrones Avanzados', lessons:[
    {title:'Compound Components',            dur:'30m', type:'video', done:false, locked:true},
    {title:'Render Props pattern',           dur:'25m', type:'video', done:false, locked:true},
    {title:'Custom Hooks: patrones reales',  dur:'40m', type:'video', done:false, locked:true},
    {title:'Proyecto Final: Dashboard React',dur:'90m', type:'doc',   done:false, locked:true},
  ]},
];

// Clases en vivo (mock). En producción cada doc vive en la colección Firestore `liveSessions`.
export const LIVE_SESSIONS = [
  { id:'ls1', courseId:1, courseTitle:'React Avanzado: Hooks, Context y Patrones', title:'Sesión en vivo: Q&A de Hooks avanzados', instructor:'Carlos Mendoza', startsAt:'2026-08-28T18:00:00', durationMin:60, roomName:'netwise-academy-react-avanzado-q1', status:'upcoming' },
  { id:'ls2', courseId:2, courseTitle:'Python para Data Science & Machine Learning', title:'Taller en vivo: Limpieza de datos con Pandas', instructor:'Laura Jiménez', startsAt:'2026-08-27T20:00:00', durationMin:90, roomName:'netwise-academy-python-ds-w1', status:'live' },
  { id:'ls3', courseId:7, courseTitle:'AWS Cloud Practitioner: Certificación', title:'Repaso en vivo antes del examen de certificación', instructor:'Diana Ruiz', startsAt:'2026-08-20T17:00:00', durationMin:45, roomName:'netwise-academy-aws-repaso', status:'ended', recordingUrl:'' },
];

export const REVIEWS = [
  { name:'María G.', stars:5, date:'hace 2 días',    text:'El mejor curso de React que he tomado. Carlos explica con una claridad increíble y los proyectos son muy prácticos.' },
  { name:'Juan P.',  stars:5, date:'hace 1 semana',  text:'Increíble. Después de este curso conseguí trabajo como Frontend Developer. Vale cada centavo.' },
  { name:'Sara M.',  stars:4, date:'hace 2 semanas', text:'Muy completo. Algunos videos podrían ser más cortos, pero el contenido es excelente y está muy actualizado.' },
];
