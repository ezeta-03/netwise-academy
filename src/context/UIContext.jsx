import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useCourseOfferings } from './CourseOfferingsContext';
import { fetchMyPreregistrations, fetchMyEnrollments, fetchLiveSessions } from '../lib/db';
import { buildStudentNotifications } from '../lib/notifications';

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());

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
  // vivo. Solo aplica a estudiantes: docentes y admin no tienen ninguna
  // promesa de "te avisaremos" pendiente en la app hoy.
  const loadNotifications = useCallback(() => {
    const isStudent = currentUser?.role === 'student';
    const uid = currentUser?.uid;
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

  return (
    <UIContext.Provider value={{
      addToast,
      isSidebarOpen,
      toggleSidebar,
      closeSidebar,
      notifications: notificationsWithRead,
      unreadCount,
      markAllRead
    }}>
      {children}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} anim-fade-up`}>
            {t.message}
            <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
          </div>
        ))}
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
              <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
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
    </UIContext.Provider>
  );
};
