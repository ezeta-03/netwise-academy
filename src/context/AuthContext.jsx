import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth, googleProvider, githubProvider, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Mock Users Database
const MOCK_USERS = {
  'demo@netwise.com':  { uid: 'mock-1', email: 'demo@netwise.com', displayName: 'Ana Estudiante', role: 'student' },
  'profe@netwise.com': { uid: 'mock-2', email: 'profe@netwise.com', displayName: 'Carlos Profesor', role: 'teacher' },
  'admin@netwise.com': { uid: 'mock-3', email: 'admin@netwise.com', displayName: 'System Admin', role: 'admin' },
};

// Perfil real en Firestore (colección `users/{uid}`). Reemplaza el rol
// hardcodeado de MOCK_USERS cuando hay un proyecto Firebase real conectado:
// la primera vez que se ve un uid se crea el doc con role: 'student' por
// defecto; ascender a 'teacher'/'admin' es una acción manual desde el panel
// de Admin (ver AdminDashboard) o la consola de Firestore.
const ensureUserProfile = async (firebaseUser) => {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email,
    role: 'student',
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, profile);
  return profile;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if we are using the placeholder Firebase config
  const isMockEnv = auth.app.options.apiKey.includes('DummyKey');

  // UID de una cuenta que se está registrando en este momento. onAuthStateChanged
  // dispara casi de inmediato al crear la cuenta -- antes de que updateProfile()
  // y el setDoc() de register() terminen de escribir el nombre real -- así que
  // si lo dejamos correr, crea el perfil de Firestore con displayName = email
  // (carrera de datos) y currentUser se queda con el correo en vez del nombre
  // hasta el próximo refresh. Mientras este uid coincide, el listener no toca
  // currentUser: register() es quien lo fija, ya con el nombre correcto.
  const registeringUid = useRef(null);

  useEffect(() => {
    if (isMockEnv) {
      // Load mock session from localStorage
      const savedUser = localStorage.getItem('mock_user_session');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
      setLoading(false);
      return;
    }

    // Real Firebase Subscription
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      if (registeringUid.current === user.uid) {
        setLoading(false);
        return;
      }

      const profile = await ensureUserProfile(user);
      setCurrentUser({
        uid: user.uid,
        email: user.email,
        displayName: profile.displayName || user.displayName,
        role: profile.role,
      });
      setLoading(false);
    });

    return unsubscribe;
  }, [isMockEnv]);

  const login = async (email, password) => {
    if (isMockEnv) {
      // Mock Login Logic
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (MOCK_USERS[email] && password === '12345') {
            const user = MOCK_USERS[email];
            setCurrentUser(user);
            localStorage.setItem('mock_user_session', JSON.stringify(user));
            resolve(user);
          } else {
            reject(new Error("auth/wrong-password"));
          }
        }, 800); // simulate network
      });
    }
    
    // Proper Firebase Login
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, displayName) => {
    if (isMockEnv) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const newUser = { uid: `mock-${Date.now()}`, email, displayName, role: 'student' };
          MOCK_USERS[email] = newUser;
          setCurrentUser(newUser);
          localStorage.setItem('mock_user_session', JSON.stringify(newUser));
          resolve(newUser);
        }, 800);
      });
    }
    
    // Proper Firebase Register
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    registeringUid.current = credential.user.uid;
    try {
      if (displayName) {
        await updateProfile(credential.user, { displayName });
      }
      // Crea el perfil explícitamente (con el displayName ya definido) en vez de
      // depender del timing de onAuthStateChanged; role siempre 'student' al
      // auto-registrarse.
      const profile = {
        email,
        displayName: displayName || email,
        role: 'student',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', credential.user.uid), profile);
      setCurrentUser({ uid: credential.user.uid, email, displayName: profile.displayName, role: profile.role });
    } finally {
      registeringUid.current = null;
    }
    return credential;
  };

  const logout = () => {
    if (isMockEnv) {
      setCurrentUser(null);
      localStorage.removeItem('mock_user_session');
      return Promise.resolve();
    }
    return firebaseSignOut(auth);
  };

  const loginWithGoogle = () => {
    if (isMockEnv) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const user = { uid: 'mock-google', email: 'google@user.com', displayName: 'Google User', role: 'student' };
          setCurrentUser(user);
          localStorage.setItem('mock_user_session', JSON.stringify(user));
          resolve(user);
        }, 800);
      });
    }
    return signInWithPopup(auth, googleProvider);
  };

  const loginWithGithub = () => {
    if (isMockEnv) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const user = { uid: 'mock-github', email: 'github@user.com', displayName: 'GitHub User', role: 'student' };
          setCurrentUser(user);
          localStorage.setItem('mock_user_session', JSON.stringify(user));
          resolve(user);
        }, 800);
      });
    }
    return signInWithPopup(auth, githubProvider);
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    loginWithGoogle,
    loginWithGithub
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
