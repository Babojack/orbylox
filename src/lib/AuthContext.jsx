import React, { createContext, useState, useContext, useEffect } from "react";
import {
  auth,
  hasFirebaseConfig,
  onAuthStateChanged,
  firebaseSignOut,
  mapFirebaseUser,
} from "@/lib/firebase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    if (hasFirebaseConfig && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        const mapped = mapFirebaseUser(firebaseUser);
        setUser(mapped);
        setIsAuthenticated(!!mapped);
        setIsLoadingAuth(false);
      });
      return () => unsubscribe();
    }
    // No Firebase: use api.auth.me() (localStorage demo)
    const init = async () => {
      const { api } = await import("@/api/apiClient");
      const currentUser = await api.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      }
      setIsLoadingAuth(false);
    };
    init();
  }, []);

  /**
   * `api` wird hier nachgeladen, nicht oben importiert.
   *
   * Der Datenzugriff bringt Firestore mit — rund 150 kB, die sonst auf JEDER
   * Seite im ersten Bündel stecken, auch auf der Startseite, wo niemand
   * angemeldet ist. Gebraucht wird er erst in dem Augenblick, in dem sich
   * jemand abmeldet oder anmelden soll. Beides sind Klicks, keine
   * Bildaufbauten: Die Verzögerung eines Nachladens fällt dort nicht auf.
   *
   * Das Abmelden bei Firebase geschieht vorher und unabhängig davon — wer
   * auf "Abmelden" drückt, ist auch dann abgemeldet, wenn das Nachladen
   * scheitert.
   */
  const logout = () => {
    if (hasFirebaseConfig && auth) {
      firebaseSignOut(auth);
    }
    setUser(null);
    setIsAuthenticated(false);
    import("@/api/apiClient").then(({ api }) => api.auth.logout()).catch(() => {});
  };

  const navigateToLogin = () => {
    const ziel = window.location.href;
    import("@/api/apiClient").then(({ api }) => api.auth.redirectToLogin(ziel)).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError: null,
        appPublicSettings: null,
        logout,
        navigateToLogin,
        checkAppState: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
