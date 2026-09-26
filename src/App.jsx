import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { CourseOfferingsProvider } from './context/CourseOfferingsContext';
import { StudentTourProvider } from './context/StudentTourContext';

// Pages
import Home from './pages/Home';
import Metodologia from './pages/Metodologia';
import Masterclass from './pages/Masterclass';
import Catalog from './pages/Catalog';
import CourseDetail from './pages/CourseDetail';
import Checkout from './pages/Checkout';
import Player from './pages/Player';
import BackGuard from './components/BackGuard';
import LiveClassRoom from './pages/LiveClassRoom';

// Alumno (panel propio con su sidebar, ver src/pages/student/StudentLayout.jsx)
import StudentLayout from './pages/student/StudentLayout';
import StudentInicio from './pages/student/StudentInicio';
import StudentAgenda from './pages/student/StudentAgenda';
import StudentCursos from './pages/student/StudentCursos';
import StudentEntregas from './pages/student/StudentEntregas';
import StudentSoporte from './pages/student/StudentSoporte';
import StudentCourseLayout from './pages/student/StudentCourseLayout';
import StudentCourseContenido from './pages/student/StudentCourseContenido';
import StudentCourseSala from './pages/student/StudentCourseSala';
import StudentCourseMateriales from './pages/student/StudentCourseMateriales';
import StudentCourseProyecto from './pages/student/StudentCourseProyecto';
import StudentCourseEvaluacion from './pages/student/StudentCourseEvaluacion';
import StudentCourseComunidad from './pages/student/StudentCourseComunidad';
import StudentCourseGrupos from './pages/student/StudentCourseGrupos';
import StudentCourseIA from './pages/student/StudentCourseIA';

// Phase 3 Dashboards
// Docente (panel propio con su sidebar, ver src/pages/teacher/TeacherLayout.jsx)
import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherInicio from './pages/teacher/TeacherInicio';
import TeacherAgenda from './pages/teacher/TeacherAgenda';
import TeacherCursos from './pages/teacher/TeacherCursos';
import TeacherSoporte from './pages/teacher/TeacherSoporte';
import TeacherCourseLayout from './pages/teacher/TeacherCourseLayout';
import TeacherCourseContenido from './pages/teacher/TeacherCourseContenido';
import TeacherCourseRubrica from './pages/teacher/TeacherCourseRubrica';
import TeacherCourseCronograma from './pages/teacher/TeacherCourseCronograma';
import TeacherCourseSala from './pages/teacher/TeacherCourseSala';
import TeacherCourseMateriales from './pages/teacher/TeacherCourseMateriales';
import TeacherCourseProyecto from './pages/teacher/TeacherCourseProyecto';
import TeacherCourseEvaluacion from './pages/teacher/TeacherCourseEvaluacion';
import TeacherCourseComunidad from './pages/teacher/TeacherCourseComunidad';
import TeacherCourseGrupos from './pages/teacher/TeacherCourseGrupos';
import TeacherCourseIA from './pages/teacher/TeacherCourseIA';
import Profile from './pages/Profile';

// Admin (panel propio con su sidebar, ver src/pages/admin/AdminLayout.jsx)
import AdminLayout from './pages/admin/AdminLayout';
import AdminResumen from './pages/admin/AdminResumen';
import AdminCursos from './pages/admin/AdminCursos';
import AdminPromociones from './pages/admin/AdminPromociones';
import AdminGrupos from './pages/admin/AdminGrupos';
import AdminAlumnos from './pages/admin/AdminAlumnos';
import AdminVentas from './pages/admin/AdminVentas';
import AdminPagos from './pages/admin/AdminPagos';
import AdminSoporte from './pages/admin/AdminSoporte';
import AdminEquipo from './pages/admin/AdminEquipo';
import AdminHistorial from './pages/admin/AdminHistorial';
import AdminConfiguracion from './pages/admin/AdminConfiguracion';

// Sin sesión, mandamos a "/" (Inicio público) y no a "/login": así el
// usuario cae en una página navegable con un botón bien visible para
// iniciar sesión, en vez de un formulario a la fuerza -- y de paso evita
// una carrera de redirecciones contradictorias justo al cerrar sesión
// desde una ruta protegida (ver handleLogout en Navbar.jsx).
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/" replace />;
  return children;
};

// Role-based Route protection
const RoleRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(currentUser.role)) return <Navigate to="/" replace />;

  return children;
};

// Al navegar a una ruta nueva (ej. click en una tarjeta de curso), el
// router no reinicia el scroll por su cuenta -- sin esto la página de
// destino queda con el scroll heredado de la anterior. Se salta cuando
// viene un scrollTo explícito (ver Home.jsx) para no pelear con ese scroll.
const ScrollToTop = () => {
  const { pathname, state } = useLocation();

  useEffect(() => {
    if (state?.scrollTo) return;
    window.scrollTo(0, 0);
  }, [pathname, state]);

  return null;
};

// "/" es pública (como /catalog y /course/:id): un visitante sin sesión
// también puede ver el Inicio. Un docente o admin logueado no tiene nada
// que hacer ahí -- su propio panel ya vive en /teacher y /admin. Un
// estudiante (o nadie logueado) ve el Home normal.
const RoleHome = () => {
  const { currentUser } = useAuth();

  if (currentUser?.role === 'admin') return <Navigate to="/admin" replace />;
  if (currentUser?.role === 'teacher') return <Navigate to="/teacher" replace />;
  if (currentUser?.role === 'student') return <Navigate to="/student" replace />;
  return <Home />;
};

function App() {
  return (
    <BrowserRouter>
    <CourseOfferingsProvider>
    <AuthProvider>
      <UIProvider>
      <StudentTourProvider>
          <ScrollToTop />
          {/* Navbar hides itself on login/player routes internally via useLocation */}
          <Navbar />
          <WhatsAppButton />
          <BackGuard />
        <div className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RoleHome />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/metodologia" element={<Metodologia />} />
          <Route path="/masterclass" element={<Masterclass />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/checkout/:courseId" element={<Checkout />} />

          {/* Protected Routes */}
          <Route path="/player/:courseId/:lessonId" element={<ProtectedRoute><Player /></ProtectedRoute>} />
          {/* /live era el listado antiguo de clases: cada rol tiene su Agenda, así que se redirige a su panel. */}
          <Route path="/live" element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
          <Route path="/live/:sessionId" element={<ProtectedRoute><LiveClassRoom /></ProtectedRoute>} />

          {/* Role-Specific Dashboards */}
          <Route path="/admin" element={<RoleRoute allowedRoles={['admin']}><AdminLayout /></RoleRoute>}>
            <Route index element={<Navigate to="resumen" replace />} />
            <Route path="resumen" element={<AdminResumen />} />
            <Route path="cursos" element={<AdminCursos />} />
            <Route path="promociones" element={<AdminPromociones />} />
            <Route path="grupos" element={<AdminGrupos />} />
            <Route path="alumnos" element={<AdminAlumnos />} />
            <Route path="ventas" element={<AdminVentas />} />
            <Route path="pagos" element={<AdminPagos />} />
            <Route path="soporte" element={<AdminSoporte />} />
            <Route path="equipo" element={<AdminEquipo />} />
            <Route path="historial" element={<AdminHistorial />} />
            <Route path="configuracion" element={<AdminConfiguracion />} />
          </Route>
          <Route path="/teacher" element={<RoleRoute allowedRoles={['admin', 'teacher']}><TeacherLayout /></RoleRoute>}>
            <Route index element={<Navigate to="inicio" replace />} />
            <Route path="inicio" element={<TeacherInicio />} />
            <Route path="agenda" element={<TeacherAgenda />} />
            <Route path="cursos" element={<TeacherCursos />} />
            <Route path="soporte" element={<TeacherSoporte />} />
          </Route>
          <Route path="/teacher/curso/:courseId" element={<RoleRoute allowedRoles={['admin', 'teacher']}><TeacherCourseLayout /></RoleRoute>}>
            <Route index element={<Navigate to="contenido" replace />} />
            <Route path="contenido" element={<TeacherCourseContenido />} />
            <Route path="rubrica" element={<TeacherCourseRubrica />} />
            <Route path="cronograma" element={<TeacherCourseCronograma />} />
            <Route path="sala" element={<TeacherCourseSala />} />
            <Route path="materiales" element={<TeacherCourseMateriales />} />
            <Route path="proyecto" element={<TeacherCourseProyecto />} />
            <Route path="evaluacion" element={<TeacherCourseEvaluacion />} />
            <Route path="comunidad" element={<TeacherCourseComunidad />} />
            <Route path="grupos" element={<TeacherCourseGrupos />} />
            <Route path="ia" element={<TeacherCourseIA />} />
          </Route>
          <Route path="/student" element={<RoleRoute allowedRoles={['student']}><StudentLayout /></RoleRoute>}>
            <Route index element={<Navigate to="inicio" replace />} />
            <Route path="inicio" element={<StudentInicio />} />
            <Route path="agenda" element={<StudentAgenda />} />
            <Route path="cursos" element={<StudentCursos />} />
            <Route path="entregas" element={<StudentEntregas />} />
            <Route path="soporte" element={<StudentSoporte />} />
          </Route>
          <Route path="/student/curso/:courseId" element={<RoleRoute allowedRoles={['student']}><StudentCourseLayout /></RoleRoute>}>
            <Route index element={<Navigate to="contenido" replace />} />
            <Route path="contenido" element={<StudentCourseContenido />} />
            <Route path="sala" element={<StudentCourseSala />} />
            <Route path="materiales" element={<StudentCourseMateriales />} />
            <Route path="proyecto" element={<StudentCourseProyecto />} />
            <Route path="evaluacion" element={<StudentCourseEvaluacion />} />
            <Route path="comunidad" element={<StudentCourseComunidad />} />
            <Route path="grupos" element={<StudentCourseGrupos />} />
            <Route path="ia" element={<StudentCourseIA />} />
          </Route>
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </StudentTourProvider>
      </UIProvider>
    </AuthProvider>
    </CourseOfferingsProvider>
    </BrowserRouter>
  );
}

export default App;
