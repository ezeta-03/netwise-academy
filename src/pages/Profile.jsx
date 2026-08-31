import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ROLE_WELCOME = {
  student: 'Te damos la bienvenida a tu espacio personalizado de aprendizaje.',
  teacher: 'Te damos la bienvenida a tu espacio de docente.',
  admin: 'Te damos la bienvenida a tu espacio de administración.',
};

const Profile = () => {
  const { currentUser, updateDisplayName } = useAuth();
  const { addToast } = useUI();
  const { theme, toggleTheme } = useTheme();
  const [nameInput, setNameInput] = useState(currentUser?.displayName || '');
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return addToast('El nombre no puede estar vacío.', 'error');
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      addToast('Nombre actualizado. Así te saludará el sistema de ahora en adelante.', 'success');
    } catch {
      addToast('No se pudo actualizar el nombre. Intenta de nuevo.', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const role = currentUser?.role || 'student';

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>

      {/* Personalized Greeting */}
      <h1 className="anim-fade-up d1" style={{ fontFamily: 'var(--ff-display)', fontSize: '2.2rem', marginBottom: '8px' }}>
        ¡Hola, {currentUser?.displayName ? currentUser.displayName.split(' ')[0] : 'Usuario'}! 👋
      </h1>
      <p className="anim-fade-up d1" style={{ color: 'var(--text2)', marginBottom: '40px', fontSize: '1.05rem' }}>{ROLE_WELCOME[role]}</p>

      {/* User Profile Info */}
      <div className="anim-fade-up d2" style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--sky))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {currentUser?.displayName ? currentUser.displayName[0] : 'U'}
          </div>
          <div>
            <h2 style={{ marginBottom: '4px' }}>{currentUser?.displayName || 'Usuario'}</h2>
            <p style={{ color: 'var(--text2)' }}>{currentUser?.email}</p>
            <span className="badge badge-sky" style={{ marginTop: '8px', display: 'inline-block' }}>Rol: {role}</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)', marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '8px' }}>Mi nombre</h3>
        <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginBottom: '16px' }}>Así te saludará el sistema en todo Netwise Academy.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Tu nombre completo"
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveName}
            disabled={savingName || nameInput.trim() === currentUser?.displayName}
          >
            {savingName ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          {theme === 'dark' ? <Moon size={20} color="var(--accent)" /> : <Sun size={20} color="var(--accent)" />}
          <h3>Apariencia</h3>
        </div>
        <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginBottom: '20px' }}>Ponte cómodo. Este mismo interruptor está disponible en la barra de navegación.</p>

        <div className="my-learning-tabs" style={{ borderBottom: 'none' }}>
          <button className={`ml-tab ${theme === 'dark' ? 'active' : ''}`} onClick={() => theme !== 'dark' && toggleTheme()}>🌙 Tema Oscuro</button>
          <button className={`ml-tab ${theme === 'light' ? 'active' : ''}`} onClick={() => theme !== 'light' && toggleTheme()}>☀️ Tema Claro</button>
        </div>
      </div>

    </div>
  );
};

export default Profile;
