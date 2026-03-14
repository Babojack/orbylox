import React, { createContext, useState, useContext, useEffect } from "react";
import { api } from "@/api/apiClient";
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
      const currentUser = await api.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      }
      setIsLoadingAuth(false);
    };
    init();
  }, []);

  const logout = () => {
    if (hasFirebaseConfig && auth) {
      firebaseSignOut(auth);
    }
    api.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
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
