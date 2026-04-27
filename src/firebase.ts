import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const getEnvVar = (key: string) => {
  // Try import.meta.env first (Vite standard)
  if (import.meta.env[key]) return import.meta.env[key];
  // Try process.env (Vite define)
  if (typeof process !== 'undefined' && process.env && (process.env as any)[key]) return (process.env as any)[key];
  return undefined;
};

const finalConfig = {
  ...firebaseConfig,
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || firebaseConfig.apiKey,
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfig.authDomain,
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || firebaseConfig.projectId,
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfig.storageBucket,
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfig.messagingSenderId,
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || firebaseConfig.appId,
};

const app = initializeApp(finalConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut };

