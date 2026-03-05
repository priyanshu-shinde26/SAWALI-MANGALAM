const pickFirst = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (String(value || "").trim()) return value;
  }
  return "";
};

export default function handler(req, res) {
  const firebaseConfig = {
    apiKey: pickFirst("VITE_FIREBASE_API_KEY", "FIREBASE_API_KEY"),
    authDomain: pickFirst("VITE_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
    projectId: pickFirst("VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
    storageBucket: pickFirst(
      "VITE_FIREBASE_STORAGE_BUCKET",
      "FIREBASE_STORAGE_BUCKET"
    ),
    messagingSenderId: pickFirst(
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: pickFirst("VITE_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
    measurementId: pickFirst(
      "VITE_FIREBASE_MEASUREMENT_ID",
      "FIREBASE_MEASUREMENT_ID"
    ),
  };

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(firebaseConfig);
}
