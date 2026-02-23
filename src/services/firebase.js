import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-aR1qYUaey4CWSwvj9ZVzixNUcjMcQ1c",
  authDomain: "sawali-mangalam.firebaseapp.com",
  projectId: "sawali-mangalam",
  storageBucket: "sawali-mangalam.firebasestorage.app",
  messagingSenderId: "301604288489",
  appId: "1:301604288489:web:00f720571c38dc9f4a3d78",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK_FIREBASE_CONFIG.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    FALLBACK_FIREBASE_CONFIG.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_FIREBASE_CONFIG.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    FALLBACK_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    FALLBACK_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK_FIREBASE_CONFIG.appId,
};

const envValueMap = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

export const firebaseMissingKeys = Object.entries(envValueMap)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigReady = firebaseMissingKeys.length === 0;

if (!firebaseConfigReady) {
  console.warn(
    `Firebase env is incomplete. Missing: ${firebaseMissingKeys.join(
      ", "
    )}.`
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics is optional and should never block app rendering.
if (
  typeof window !== "undefined" &&
  firebaseConfigReady &&
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
) {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics errors in unsupported environments.
    });
}
