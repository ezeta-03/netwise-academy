import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Check } from 'lucide-react';

const ROLE_WELCOME = {
  student: 'Te damos la bienvenida a tu espacio personalizado de aprendizaje.',
  teacher: 'Te damos la bienvenida a tu espacio de docente.',
  admin: 'Te damos la bienvenida a tu espacio de administración.',
};

const Profile = () => {
  const { currentUser, updateDisplayName } = useAuth();
  const { addToast } = useUI();
  const { theme, toggleTheme } = useTheme();
  const [interests, setInterests] = useState(['Desarrollo Web', 'React']);
  const [nameInput, setNameInput] = useState(currentUser?.displayName || '');
  const [savingName, setSavingName] = useState(false);

  const ALL_INTERESTS = ['Desarrollo Web', 'Diseño UX/UI', 'Marketing Digital', 'Data Science', 'React', 'NodeJS', 'Python'];

  const toggleInterest = (interest) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleFileUpload = (type) => {
    // Simulated File Upload mechanism
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        alert(`¡${type} simulado subido correctamente: ${file.name}! En producción, la imagen será guardada.`);
      }
    };
    input.click();
  };

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

      {/* User Profile Info & Uploads */}
      <div className="anim-fade-up d2" style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)', marginBottom: '30px', position: 'relative', overflow: 'hidden' }}>
        {/* Mock background cover */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100px', background: 'linear-gradient(135deg, var(--accent-bg), var(--surface2))', zIndex: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => handleFileUpload('Fondo de perfil')} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff' }}>Cambiar Portada</button>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', gap: '20px', marginTop: '40px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--sky))', border: '4px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>
              {currentUser?.displayName ? currentUser.displayName[0] : 'U'}
            </div>
            <button className="btn-icon" onClick={() => handleFileUpload('Avatar')} style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, padding: 0, borderRadius: '50%', background: 'var(--bg)', color: 'var(--text)' }}>📷</button>
          </div>
          <div style={{ paddingBottom: '10px' }}>
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

      {role === 'student' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)', marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '16px' }}>Mis Intereses de Estudio</h3>
          <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginBottom: '20px' }}>Selecciona los temas que deseas ver en tus recomendaciones.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {ALL_INTERESTS.map(int => {
              const isSelected = interests.includes(int);
              return (
                <button
                  key={int}
                  className="btn btn-sm"
                  style={{
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '100px'
                  }}
                  onClick={() => toggleInterest(int)}
                >
                  {isSelected && <Check size={14} style={{ marginRight: '6px' }} />}
                  {int}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
