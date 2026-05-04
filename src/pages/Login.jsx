import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { auth, hasFirebaseConfig, googleProvider, signInWithPopup } from "@/lib/firebase";
import { Mail, Lock } from "lucide-react";

const gradientBtn = "w-full py-3.5 rounded-xl font-semibold text-white uppercase tracking-wide bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 hover:opacity-95 transition-opacity shadow-lg";

/** Lesbare Meldung für typische Firebase-Google-Fehler (Console: Authentication → Google, Authorized domains). */
function googleSignInErrorMessage(err) {
  const code = err?.code || "";
  const map = {
    "auth/popup-blocked":
      "Popup wurde blockiert. Erlaube Popups für diese Seite oder probiere einen anderen Browser.",
    "auth/popup-closed-by-user": "Anmeldung abgebrochen (Fenster geschlossen).",
    "auth/cancelled-popup-request": "Anmeldung unterbrochen — bitte erneut versuchen.",
    "auth/unauthorized-domain":
      "Diese Domain ist in Firebase nicht freigegeben. In der Firebase Console unter Authentication → Settings → Authorized domains deine Domain (und ggf. localhost) eintragen.",
    "auth/operation-not-allowed":
      "Google-Anmeldung ist im Firebase-Projekt nicht aktiviert. Authentication → Sign-in method → Google einschalten und speichern.",
    "auth/account-exists-with-different-credential":
      "Es gibt schon ein Konto mit dieser E-Mail — bitte zuerst mit E-Mail/Passwort anmelden oder in Firebase die Kontoverknüpfung prüfen.",
    "auth/network-request-failed": "Netzwerkfehler — Verbindung prüfen und erneut versuchen.",
    "auth/internal-error": "Interner Authentifizierungsfehler — oft OAuth/Google Cloud Console; in Firebase die Google-Anbieter-Einstellungen prüfen.",
  };
  if (map[code]) return map[code];
  if (err?.message) return err.message;
  return "Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen oder E-Mail-Login nutzen.";
}

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const finishLogin = () => {
    const redirect =
      window.localStorage.getItem("orbylox_redirect_after_login") ||
      createPageUrl("ProjectsList");
    window.localStorage.removeItem("orbylox_redirect_after_login");
    navigate(redirect);
  };

  const handleGoogleSignIn = async () => {
    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setError(
        "Google-Anmeldung ist nicht konfiguriert. Lege im Projekt eine .env mit VITE_FIREBASE_API_KEY (und den übrigen VITE_FIREBASE_* Werten) an und starte den Dev-Server neu.",
      );
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      finishLogin();
    } catch (err) {
      setError(googleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }
    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must contain at least one uppercase letter.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must contain at least one number.");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setError("Password must contain at least one special character (e.g. !@#$%&*).");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await api.auth.register({ email, password });
      } else {
        await api.auth.login({ email, password });
      }
      finishLogin();
    } catch (err) {
      setError(err && err.message ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    api.auth.demoLogin();
  };

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      finishLogin();
    }
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-cyan-200 via-blue-100 to-fuchsia-200">
        <div className="w-8 h-8 border-4 border-white/50 border-t-fuchsia-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 bg-gradient-to-r from-cyan-200 via-blue-100 to-fuchsia-300">
      {/* Subtle geometric shapes in background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-[10%] w-40 h-40 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute bottom-32 right-[15%] w-56 h-56 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="absolute top-1/3 right-[20%] w-24 h-24 bg-white/10 rounded-2xl rotate-12" />
        <div className="absolute bottom-1/4 left-[15%] w-16 h-16 bg-cyan-200/30 rounded-lg -rotate-12" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-white/50">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-slate-800 mb-8">
            {mode === "login" ? "Login" : "Register"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-600 mb-1">
                Email
              </label>
              <div className="flex items-center border-0 border-b-2 border-slate-200 focus-within:border-cyan-500 transition-colors">
                <Mail className="w-5 h-5 text-slate-400 shrink-0 mr-2" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Type your email"
                  className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-600 mb-1">
                Password
              </label>
              <div className="flex items-center border-0 border-b-2 border-slate-200 focus-within:border-cyan-500 transition-colors">
                <Lock className="w-5 h-5 text-slate-400 shrink-0 mr-2" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Type your password"
                  className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
              {mode === "login" && (
                <div className="text-right mt-1">
                  <button
                    type="button"
                    className="text-sm text-slate-500 hover:text-cyan-600"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {mode === "register" && (
              <>
                <p className="text-xs text-slate-500">
                  Min. 8 characters, 1 uppercase letter, 1 number, 1 special character (e.g. !@#$%&*).
                </p>
                <div>
                  <label htmlFor="login-confirm" className="block text-sm font-medium text-slate-600 mb-1">
                    Confirm password
                  </label>
                  <div className="flex items-center border-0 border-b-2 border-slate-200 focus-within:border-cyan-500 transition-colors">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0 mr-2" />
                    <input
                      id="login-confirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Type your password again"
                      className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 py-2 px-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              className={gradientBtn}
              disabled={loading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">Or {mode === "login" ? "Sign up" : "Sign in"} using</p>
            <div className="flex justify-center gap-4 mt-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                title={!hasFirebaseConfig ? "Firebase-Umgebungsvariablen fehlen" : "Mit Google anmelden"}
                className="w-11 h-11 rounded-full bg-[#EA4335] flex items-center justify-center text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>
            </div>
            {!hasFirebaseConfig && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                Ohne Firebase-Konfiguration (.env mit VITE_FIREBASE_*) funktioniert Google nicht — E-Mail-Login oder Demo nutzen.
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setConfirmPassword(""); }}
              className="mt-4 text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:opacity-90 uppercase tracking-wide"
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleDemo}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Try without account (Demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
