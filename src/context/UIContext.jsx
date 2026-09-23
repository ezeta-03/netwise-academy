import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useCourseOfferings } from './CourseOfferingsContext';
import { fetchMyPreregistrations, fetchMyEnrollments, fetchLiveSessions, fetchOrders } from '../lib/db';
import { buildStudentNotifications, buildAdminNotifications } from '../lib/notifications';
import LoginModal from '../components/LoginModal';

// Un ícono y color por tipo de toast -- 'info' es el default (comunicados),
// el resto son semánticos (éxito/error/advertencia). Ver .toast-* en index.css.
const TOAST_ICON = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

// Cada cuánto se revisa si hay pedidos nuevos por validar mientras el admin
// tiene la app abierta -- no hay backend con Cloud Functions en este
// proyecto para avisar por push real, así que esto es lo más cercano a
// "tiempo real" sin agregar esa infraestructura (y su costo).
const ADMIN_POLL_MS = 45000;

const UIContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components -- hook junto a su Provider (patrón de contexto)
export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const readStorageKey = currentUser ? `netwise_notifications_read_${currentUser.uid}` : null;

  useEffect(() => {
    let next = new Set();
    if (readStorageKey) {
      try {
        const raw = localStorage.getItem(readStorageKey);
        next = new Set(raw ? JSON.parse(raw) : []);
      } catch {
        next = new Set();
      }
    }
    Promise.resolve().then(() => setReadIds(next));
  }, [readStorageKey]);

  // Notificaciones reales derivadas del estado del alumno (cohortes
  // abiertas, clases en vivo próximas/activas/canceladas) -- se recalculan
  // en vez de guardarse en Firestore, igual que el estado de una clase en
  // vivo. El admin ve una versión propia (pedidos pendientes de validar,
  // ver buildAdminNotifications); los docentes no tienen ninguna promesa
  // de "te avisaremos" pendiente en la app hoy.
  const loadNotifications = useCallback(() => {
    const isStudent = currentUser?.role === 'student';
    const isAdmin = currentUser?.role === 'admin';
    const uid = currentUser?.uid;

    if (isAdmin) {
      fetchOrders().then((orders) => setNotifications(buildAdminNotifications({ orders }))).catch(() => {});
      return;
    }

    Promise.all([
      isStudent ? fetchMyPreregistrations(uid) : Promise.resolve([]),
      isStudent ? fetchMyEnrollments(uid) : Promise.resolve({}),
      isStudent ? fetchLiveSessions() : Promise.resolve([]),
    ]).then(([preregisteredIds, enrollments, liveSessions]) => {
      if (!isStudent) { setNotifications([]); return; }
      setNotifications(buildStudentNotifications({
        courses,
        preregisteredIds,
        enrolledCourseIds: Object.keys(enrollments).map(Number),
        liveSessions,
      }));
    });
  }, [currentUser, courses]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Sondeo mientras el admin tiene la app abierta, para que el aviso de un
  // pedido nuevo le llegue sin tener que reabrir la campanita a mano.
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    const id = setInterval(loadNotifications, ADMIN_POLL_MS);
    return () => clearInterval(id);
  }, [currentUser, loadNotifications]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto remove after 3.5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
    loadNotifications(); // refresca al abrir/cerrar -- barato, mantiene los datos al día
  };
  const closeSidebar = () => setIsSidebarOpen(false);

  const markAllRead = () => {
    const updated = new Set(readIds);
    notifications.forEach((n) => updated.add(n.id));
    setReadIds(updated);
    if (readStorageKey) localStorage.setItem(readStorageKey, JSON.stringify([...updated]));
  };

  const notificationsWithRead = notifications.map((n) => ({ ...n, read: readIds.has(n.id) }));
  const unreadCount = notificationsWithRead.filter((n) => !n.read).length;

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  return (
    <UIContext.Provider value={{
      addToast,
      isSidebarOpen,
      toggleSidebar,
      closeSidebar,
      notifications: notificationsWithRead,
      unreadCount,
      markAllRead,
      refreshNotifications: loadNotifications,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
    }}>
      {children}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => {
          const Icon = TOAST_ICON[t.type] || TOAST_ICON.info;
          return (
            <div key={t.id} className={`toast toast-${t.type} anim-fade-up`}>
              <Icon size={18} className="toast-icon" />
              <span className="toast-msg">{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
            </div>
          );
        })}
      </div>

      {/* Notification Sidebar */}
      <div className={`overlay ${isSidebarOpen ? 'active' : ''}`} onClick={closeSidebar}></div>
      <div className={`notification-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="ns-header">
          <h3>Notificaciones</h3>
          <button className="btn-icon" onClick={closeSidebar} aria-label="Cerrar">×</button>
        </div>
        {notificationsWithRead.length > 0 && (
          <div className="ns-actions">
            <button className="btn-ghost btn-sm" onClick={markAllRead}>Marcar todo como leído</button>
          </div>
        )}
        <div className="ns-content">
          {notificationsWithRead.length === 0 ? (
            <div className="notif-empty">
              <p>No tienes notificaciones nuevas.</p>
            </div>
          ) : (
            notificationsWithRead.map(n => (
              <div
                key={n.id}
                className={`notif-item ${n.read ? 'read' : 'unread'}`}
                style={n.to ? { cursor: 'pointer' } : undefined}
                onClick={n.to ? () => { closeSidebar(); navigate(n.to); } : undefined}
              >
                <div className="notif-dot"></div>
                <div>
                  <div className="notif-title">{n.title}</div>
                  {n.detail && <div className="notif-time">{n.detail}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {loginModalOpen && <LoginModal onClose={closeLoginModal} />}
    </UIContext.Provider>
  );
};
