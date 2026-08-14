import { useState, useEffect, useRef } from "react";
import { api } from "@/api/apiClient";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { auth, hasFirebaseConfig, googleProvider, signInWithPopup } from "@/lib/firebase";
import { Mail, Lock, User, Camera, X, Check } from "lucide-react";
import OrbyloxMark from "@/components/OrbyloxMark";

const gradientBtn =
  "w-full py-3.5 rounded-xl font-semibold text-white uppercase tracking-wide bg-[#ef5a24] hover:opacity-95 transition-opacity shadow-lg disabled:opacity-60";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Readable messages for the Firebase auth error codes users actually hit. */
function authErrorMessage(err) {
  const map = {
    "auth/popup-blocked": "Popup wurde blockiert. Erlaube Popups für diese Seite oder nutze E-Mail und Passwort.",
    "auth/popup-closed-by-user": "Anmeldung abgebrochen (Fenster geschlossen).",
    "auth/cancelled-popup-request": "Anmeldung unterbrochen — bitte erneut versuchen.",
    "auth/unauthorized-domain":
      "Diese Domain ist in Firebase nicht freigegeben (Authentication → Settings → Authorized domains).",
    "auth/operation-not-allowed":
      "Diese Anmeldeart ist im Firebase-Projekt nicht aktiviert. Authentication → Sign-in method prüfen.",
    "auth/email-already-in-use": "Für diese E-Mail gibt es bereits ein Konto. Bitte anmelden statt registrieren.",
    "auth/invalid-email": "Diese E-Mail-Adresse sieht nicht gültig aus.",
    "auth/weak-password": "Das Passwort ist zu schwach — mindestens 6 Zeichen verlangt Firebase.",
    "auth/user-not-found": "Kein Konto mit dieser E-Mail gefunden.",
    "auth/wrong-password": "Passwort stimmt nicht.",
    "auth/invalid-credential": "E-Mail oder Passwort stimmt nicht.",
    "auth/too-many-requests": "Zu viele Versuche. Bitte kurz warten und erneut probieren.",
    "auth/network-request-failed": "Netzwerkfehler — Verbindung prüfen und erneut versuchen.",
    "auth/account-exists-with-different-credential":
      "Es gibt schon ein Konto mit dieser E-Mail, angelegt über einen anderen Anbieter.",
  };
  return map[err?.code] || err?.message || "Etwas ist schiefgelaufen. Bitte erneut versuchen.";
}

const passwordChecks = [
  { label: "mindestens 8 Zeichen", test: (v) => v.length >= 8 },
  { label: "ein Großbuchstabe", test: (v) => /[A-Z]/.test(v) },
  { label: "eine Zahl", test: (v) => /[0-9]/.test(v) },
  { label: "ein Sonderzeichen", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const finishLogin = () => {
    const redirect =
      window.localStorage.getItem("orbylox_redirect_after_login") || createPageUrl("ProjectsList");
    window.localStorage.removeItem("orbylox_redirect_after_login");
    navigate(redirect);
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setConfirmPassword("");
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei wählen.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Das Bild ist zu groß (max. 5 MB).");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGoogleSignIn = async () => {
    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setError("Google-Anmeldung ist nicht konfiguriert (VITE_FIREBASE_* in der .env fehlen).");
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      finishLogin();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Bitte zuerst die E-Mail-Adresse eintragen.");
      return;
    }
    setError(null);
    try {
      await api.auth.resetPassword(email.trim());
      setNotice(`Wir haben eine E-Mail zum Zurücksetzen an ${email.trim()} geschickt.`);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Bitte E-Mail und Passwort ausfüllen.");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Bitte deinen Namen eintragen.");
        return;
      }
      const failed = passwordChecks.find((check) => !check.test(password));
      if (failed) {
        setError(`Das Passwort braucht noch: ${failed.label}.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        await api.auth.register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          photoFile,
        });
      } else {
        await api.auth.login({ email: email.trim(), password });
      }
      finishLogin();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) finishLogin();
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-8 h-8 border-4 border-white/50 border-t-[#ef5a24] rounded-full animate-spin" />
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 bg-[#f5f5f5]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-[10%] w-40 h-40 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute bottom-32 right-[15%] w-56 h-56 rounded-full bg-[#ef5a24]/20 blur-3xl" />
        <div className="absolute top-1/3 right-[20%] w-24 h-24 bg-white/10 rounded-2xl rotate-12" />
        <div className="absolute bottom-1/4 left-[15%] w-16 h-16 bg-cyan-200/30 rounded-lg -rotate-12" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-white/50">
          <div className="flex items-center justify-center gap-2 mb-5">
            <OrbyloxMark className="w-10 h-10" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">RBYLOX</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-center text-slate-800 mb-1">
            {isRegister ? "Konto erstellen" : "Willkommen zurück"}
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            {isRegister ? "In einer Minute startklar." : "Melde dich bei ORBYLOX an."}
          </p>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                !isRegister ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                isRegister ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Registrieren
            </button>
          </div>

          {hasFirebaseConfig && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-white bg-[#EA4335] hover:opacity-95 disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? "Bitte warten…" : "Mit Google fortfahren"}
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 uppercase tracking-wide">oder</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {isRegister && (
              <>
                {/* Profile picture */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 hover:border-cyan-400 bg-slate-50 flex items-center justify-center overflow-hidden transition-colors"
                      title="Profilbild wählen"
                    >
                      {photoPreview ? (
                        <img src={photoPreview} alt="Vorschau" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-7 h-7 text-slate-400" />
                      )}
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
                        title="Bild entfernen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">Profilbild (optional, max. 5 MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>

                <div>
                  <label htmlFor="login-name" className="block text-sm font-medium text-slate-600 mb-1">
                    Name
                  </label>
                  <div className="flex items-center border-0 border-b-2 border-slate-200 focus-within:border-cyan-500 transition-colors">
                    <User className="w-5 h-5 text-slate-400 shrink-0 mr-2" />
                    <input
                      id="login-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Vor- und Nachname"
                      className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-600 mb-1">
                E-Mail
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
                  placeholder="name@beispiel.de"
                  className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-600 mb-1">
                Passwort
              </label>
              <div className="flex items-center border-0 border-b-2 border-slate-200 focus-within:border-cyan-500 transition-colors">
                <Lock className="w-5 h-5 text-slate-400 shrink-0 mr-2" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? "Sicheres Passwort wählen" : "Dein Passwort"}
                  className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
              </div>
              {!isRegister && (
                <div className="text-right mt-1">
                  <button type="button" onClick={handleForgotPassword} className="text-sm text-slate-500 hover:text-cyan-600">
                    Passwort vergessen?
                  </button>
                </div>
              )}
            </div>

            {isRegister && (
              <>
                <ul className="grid grid-cols-2 gap-y-1 gap-x-2">
                  {passwordChecks.map((check) => {
                    const ok = check.test(password);
                    return (
                      <li
                        key={check.label}
                        className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-slate-400"}`}
                      >
                        <Check className={`w-3.5 h-3.5 ${ok ? "opacity-100" : "opacity-30"}`} />
                        {check.label}
                      </li>
                    );
                  })}
                </ul>

                <div>
                  <label htmlFor="login-confirm" className="block text-sm font-medium text-slate-600 mb-1">
                    Passwort wiederholen
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
                      placeholder="Passwort erneut eingeben"
                      className="flex-1 py-2.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 py-2 px-3 rounded-lg border border-red-100">{error}</p>
            )}
            {notice && (
              <p className="text-sm text-green-700 bg-green-50 py-2 px-3 rounded-lg border border-green-100">{notice}</p>
            )}

            <button type="submit" className={gradientBtn} disabled={loading}>
              {loading
                ? isRegister
                  ? "Konto wird erstellt…"
                  : "Anmelden…"
                : isRegister
                  ? "Konto erstellen"
                  : "Anmelden"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            {isRegister ? "Schon ein Konto?" : "Noch kein Konto?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
              className="font-semibold text-transparent bg-clip-text bg-[#ef5a24] hover:opacity-90"
            >
              {isRegister ? "Anmelden" : "Jetzt registrieren"}
            </button>
          </p>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => api.auth.demoLogin()}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Ohne Konto ausprobieren (Demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
