import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const getEnvVar = (key: string) => {
  // Use Vite's import.meta.env for VITE_ prefixed variables
  // We explicitly check the keys for production build reliability
  const env = (import.meta as any).env;
  if (key === 'VITE_FIREBASE_API_KEY') return env.VITE_FIREBASE_API_KEY;
  if (key === 'VITE_FIREBASE_AUTH_DOMAIN') return env.VITE_FIREBASE_AUTH_DOMAIN;
  if (key === 'VITE_FIREBASE_PROJECT_ID') return env.VITE_FIREBASE_PROJECT_ID;
  if (key === 'VITE_FIREBASE_STORAGE_BUCKET') return env.VITE_FIREBASE_STORAGE_BUCKET;
  if (key === 'VITE_FIREBASE_MESSAGING_SENDER_ID') return env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  if (key === 'VITE_FIREBASE_APP_ID') return env.VITE_FIREBASE_APP_ID;
  
  if (env[key]) return env[key];
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
export const db = getFirestore(app, finalConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut };

