import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, githubProvider } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Mock Users Database
const MOCK_USERS = {
  'demo@netwise.com':  { uid: 'mock-1', email: 'demo@netwise.com', displayName: 'Ana Estudiante', role: 'student' },
  'profe@netwise.com': { uid: 'mock-2', email: 'profe@netwise.com', displayName: 'Carlos Profesor', role: 'teacher' },
  'admin@netwise.com': { uid: 'mock-3', email: 'admin@netwise.com', displayName: 'System Admin', role: 'admin' },
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if we are using the placeholder Firebase config
  const isMockEnv = auth.app.options.apiKey.includes('DummyKey');

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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
    // Note: In a real app you'd update profile with displayName here
    return createUserWithEmailAndPassword(auth, email, password);
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
