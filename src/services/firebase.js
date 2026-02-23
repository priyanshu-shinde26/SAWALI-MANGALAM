import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "missing-api-key",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "missing-auth-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "missing-project-id",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "missing-storage-bucket",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "missing-messaging-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "missing-app-id",
};

const envValueMap = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseMissingKeys = Object.entries(envValueMap)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigReady = firebaseMissingKeys.length === 0;

if (!firebaseConfigReady) {
  console.warn(
    `Firebase env is incomplete. Missing: ${firebaseMissingKeys.join(
      ", "
    )}. Add these in .env.`
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
