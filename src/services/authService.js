import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigReady, firebaseMissingKeys } from "./firebase";

export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "").trim();
export const adminConfigReady = Boolean(ADMIN_EMAIL);
const normalizedAdminEmail = ADMIN_EMAIL.toLowerCase();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const isAuthorizedAdminEmail = (email) =>
  !adminConfigReady || normalizeEmail(email) === normalizedAdminEmail;

export const loginAdmin = async (email, password) => {
  if (!firebaseConfigReady || !auth || !db) {
    throw new Error(
      `Firebase is not configured. Missing .env keys: ${firebaseMissingKeys.join(
        ", "
      )}.`
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

  if (!isAuthorizedAdminEmail(credential.user.email)) {
    await signOut(auth);
    throw new Error("Unauthorized account for admin access.");
  }

  try {
    await setDoc(
      doc(db, "admins", credential.user.uid),
      {
        email: normalizedEmail,
        role: "admin",
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Admin profile sync should not block login.
    console.warn("Admin profile sync skipped:", error);
  }

  return credential;
};

export const logoutAdmin = () => (auth ? signOut(auth) : Promise.resolve());

export const watchAuthState = (callback) => {
  if (!firebaseConfigReady || !auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
};
