// Import the functions you need from the SDKs you need
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Config real via variables de entorno (ver .env.example). Sin un .env.local,
// cae en el proyecto dummy y toda la app opera en modo mock/simulado.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKey-xxxxxxxxxxxxxxxxx",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "netwise-academy-dummy.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "netwise-academy-dummy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "netwise-academy-dummy.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:xxxxxxxxxxxxxxxxx"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
// Los correos que envía Firebase (definir o recuperar contraseña) salen en español.
auth.languageCode = "es";
export const db = getFirestore(app);
export const storage = getStorage(app);
// Misma región que las Cloud Functions (functions/index.js).
export const functions = getFunctions(app, "us-central1");

// Modo emulador (npm run dev:emu → .env.emulator): todo va a los Firebase
// Emulators locales (firebase emulators:start) y nunca toca producción.
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// Crea una cuenta de acceso SIN cerrar la sesión de quien la crea (el admin
// dando de alta a un docente). createUserWithEmailAndPassword inicia sesión
// con la cuenta nueva, así que se hace en una segunda instancia de la app que
// se descarta al terminar. Devuelve el uid de la cuenta creada.
export const createAccountKeepingSession = async (email, password, displayName) => {
  const secondary = initializeApp(firebaseConfig, `alta-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    if (import.meta.env.VITE_USE_EMULATORS === "true") connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    if (displayName) await updateProfile(credential.user, { displayName });
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondary).catch(() => {});
  }
};

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export default app;
