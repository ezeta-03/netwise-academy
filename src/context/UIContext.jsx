import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: '¡Bienvenido a Netwise Academy!', time: 'Hace 5 min', read: false },
    { id: 2, title: 'Nuevo mensaje de tu profesor', time: 'Hace 1 hora', read: true },
    { id: 3, title: 'Curso "React Pro" completado 🎉', time: 'Ayer', read: true },
  ]);

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

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <UIContext.Provider value={{
      addToast,
      isSidebarOpen,
      toggleSidebar,
      closeSidebar,
      notifications,
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
          <button className="btn-icon" onClick={closeSidebar}>×</button>
        </div>
        <div className="ns-actions">
          <button className="btn-ghost btn-sm" onClick={markAllRead}>Marcar todo como leído</button>
        </div>
        <div className="ns-content">
          {notifications.map(n => (
            <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
              <div className="notif-dot"></div>
              <div>
                <div className="notif-title">{n.title}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </UIContext.Provider>
  );
};
