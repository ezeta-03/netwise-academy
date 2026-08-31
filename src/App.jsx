import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { ThemeProvider } from './context/ThemeContext';
import { CourseOfferingsProvider } from './context/CourseOfferingsContext';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Catalog from './pages/Catalog';
import CourseDetail from './pages/CourseDetail';
import Player from './pages/Player';
import MyLearning from './pages/MyLearning';
import LiveClasses from './pages/LiveClasses';
import LiveClassRoom from './pages/LiveClassRoom';

// Phase 3 Dashboards
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Profile from './pages/Profile';

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

// "/" es pública (como /catalog y /course/:id): un visitante sin sesión
// también puede ver el Inicio. Un docente o admin logueado no tiene nada
// que hacer ahí -- su propio panel ya vive en /teacher y /admin. Un
// estudiante (o nadie logueado) ve el Home normal.
const RoleHome = () => {
  const { currentUser } = useAuth();

  if (currentUser?.role === 'admin') return <Navigate to="/admin" replace />;
  if (currentUser?.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Home />;
};

function App() {
  return (
    <ThemeProvider>
    <CourseOfferingsProvider>
    <AuthProvider>
      <UIProvider>
        <BrowserRouter>
          {/* Navbar hides itself on login/player routes internally via useLocation */}
          <Navbar />
        <div className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleHome />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/course/:id" element={<CourseDetail />} />

          {/* Protected Routes */}
          <Route path="/player/:courseId/:lessonId" element={<ProtectedRoute><Player /></ProtectedRoute>} />
          <Route path="/my-learning" element={<ProtectedRoute><MyLearning /></ProtectedRoute>} />
          <Route path="/live" element={<ProtectedRoute><LiveClasses /></ProtectedRoute>} />
          <Route path="/live/:sessionId" element={<ProtectedRoute><LiveClassRoom /></ProtectedRoute>} />

          {/* Role-Specific Dashboards */}
          <Route path="/admin" element={<RoleRoute allowedRoles={['admin']}><AdminDashboard /></RoleRoute>} />
          <Route path="/teacher" element={<RoleRoute allowedRoles={['admin', 'teacher']}><TeacherDashboard /></RoleRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
        </BrowserRouter>
      </UIProvider>
    </AuthProvider>
    </CourseOfferingsProvider>
    </ThemeProvider>
  );
}

export default App;
