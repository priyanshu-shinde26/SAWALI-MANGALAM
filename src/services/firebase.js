import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const runtimeFirebaseConfig =
  (typeof window !== "undefined" && window.__RUNTIME_FIREBASE_CONFIG__) ||
  (typeof globalThis !== "undefined" &&
    globalThis.__FIREBASE_DEFAULTS__ &&
    globalThis.__FIREBASE_DEFAULTS__.config) ||
  {};

const firebaseEnvMap = {
  VITE_FIREBASE_API_KEY:
    import.meta.env.VITE_FIREBASE_API_KEY || runtimeFirebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || runtimeFirebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || runtimeFirebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || runtimeFirebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    runtimeFirebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID:
    import.meta.env.VITE_FIREBASE_APP_ID || runtimeFirebaseConfig.appId,
};

const firebaseConfig = {
  apiKey: firebaseEnvMap.VITE_FIREBASE_API_KEY,
  authDomain: firebaseEnvMap.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseEnvMap.VITE_FIREBASE_PROJECT_ID,
  storageBucket: firebaseEnvMap.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseEnvMap.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseEnvMap.VITE_FIREBASE_APP_ID,
};

export const firebaseMissingKeys = Object.entries(firebaseEnvMap)
  .filter(([, value]) => !String(value || "").trim())
  .map(([key]) => key);

export const firebaseConfigReady = firebaseMissingKeys.length === 0;

if (!firebaseConfigReady) {
  console.warn(
    `Firebase env is incomplete. Missing: ${firebaseMissingKeys.join(
      ", "
    )}.`
  );
}

const app = firebaseConfigReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

const measurementId =
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || runtimeFirebaseConfig.measurementId;

// Analytics is optional and should never block app rendering.
if (app && typeof window !== "undefined" && measurementId) {
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
