import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ADMIN_EMAIL, watchAuthState, logoutAdmin } from "../services/authService";

const AuthContext = createContext({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = watchAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (firebaseUser.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await logoutAdmin();
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
