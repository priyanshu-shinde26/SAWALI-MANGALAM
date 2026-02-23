import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigReady, firebaseMissingKeys } from "./firebase";

export const ADMIN_EMAIL = "sawali2026@gmail.com";
export const ADMIN_PASSWORD = "sawali2026";

export const loginAdmin = async (email, password) => {
  if (!firebaseConfigReady) {
    throw new Error(
      `Firebase is not configured. Missing .env keys: ${firebaseMissingKeys.join(
        ", "
      )}.`
    );
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (
    normalizedEmail !== ADMIN_EMAIL.toLowerCase() ||
    password !== ADMIN_PASSWORD
  ) {
    throw new Error("Invalid admin credentials.");
  }

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

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

export const logoutAdmin = () => signOut(auth);

export const watchAuthState = (callback) => {
  if (!firebaseConfigReady) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
};
