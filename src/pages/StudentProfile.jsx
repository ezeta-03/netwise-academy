import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Palette, Check } from 'lucide-react';

const StudentProfile = () => {
  const { currentUser } = useAuth();
  const [activeTheme, setActiveTheme] = useState('dark');
  const [interests, setInterests] = useState(['Desarrollo Web', 'React']);
  
  const ALL_INTERESTS = ['Desarrollo Web', 'Diseño UX/UI', 'Marketing Digital', 'Data Science', 'React', 'NodeJS', 'Python'];

  const toggleInterest = (interest) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const changeTheme = (themeType) => {
    setActiveTheme(themeType);
    const root = document.documentElement;
    if (themeType === 'dark') {
      root.style.setProperty('--bg', '#0B0D17');
      root.style.setProperty('--surface', '#131627');
      root.style.setProperty('--border', 'rgba(255,255,255,0.08)');
      root.style.setProperty('--text', '#f8fafc');
      root.style.setProperty('--text2', '#94a3b8');
      root.style.setProperty('--accent', '#673de6'); // default brand
    } else if (themeType === 'light') {
      root.style.setProperty('--bg', '#f8fafc');
      root.style.setProperty('--surface', '#ffffff');
      root.style.setProperty('--border', 'rgba(0,0,0,0.1)');
      root.style.setProperty('--text', '#0f172a');
      root.style.setProperty('--text2', '#475569');
      root.style.setProperty('--accent', '#4f46e5'); // indigo for light mode
    } else if (themeType === 'neon') {
      root.style.setProperty('--bg', '#050510');
      root.style.setProperty('--surface', '#0a0a1a');
      root.style.setProperty('--border', 'rgba(203, 255, 46, 0.2)');
      root.style.setProperty('--text', '#ffffff');
      root.style.setProperty('--text2', '#a0a0b0');
      root.style.setProperty('--accent', '#cbff2e'); // green accent
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

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Personalized Greeting */}
      <h1 className="anim-fade-up d1" style={{ fontFamily: 'var(--ff-display)', fontSize: '2.2rem', marginBottom: '8px' }}>
        ¡Hola, {currentUser?.displayName ? currentUser.displayName.split(' ')[0] : 'Estudiante'}! 👋
      </h1>
      <p className="anim-fade-up d1" style={{ color: 'var(--text2)', marginBottom: '40px', fontSize: '1.05rem' }}>Te damos la bienvenida a tu espacio personalizado de aprendizaje.</p>

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
            <h2 style={{ marginBottom: '4px' }}>{currentUser?.displayName || 'Estudiante'}</h2>
            <p style={{ color: 'var(--text2)' }}>{currentUser?.email}</p>
            <span className="badge badge-sky" style={{ marginTop: '8px', display: 'inline-block' }}>Rol: {currentUser?.role || 'student'}</span>
          </div>
        </div>
      </div>
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
            )
          })}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '24px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Palette size={20} color="var(--accent)" />
          <h3>Personalizar Entorno Visual</h3>
        </div>
        <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginBottom: '20px' }}>Ponte cómodo. Cambia los colores de tu interfaz Netwise Academy.</p>
        
        <div className="my-learning-tabs" style={{ borderBottom: 'none' }}>
          <button className={`ml-tab ${activeTheme === 'dark' ? 'active' : ''}`} onClick={() => changeTheme('dark')}>🌙 Tema Oscuro (Por defecto)</button>
          <button className={`ml-tab ${activeTheme === 'light' ? 'active' : ''}`} onClick={() => changeTheme('light')}>☀️ Tema Claro</button>
          <button className={`ml-tab ${activeTheme === 'neon' ? 'active' : ''}`} onClick={() => changeTheme('neon')}>⚡ Tema Hacker</button>
        </div>
      </div>

    </div>
  );
};

export default StudentProfile;
