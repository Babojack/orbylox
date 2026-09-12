import { Suspense } from 'react';
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const LoginPage = Pages['login'];

/**
 * Die Startseite kommt ohne den Rahmen aus.
 *
 * `Layout` bringt die Seitenleiste, die Kopfzeile, den Chat-Horcher, den
 * Sprachagenten und damit auch Firestore mit — für Seiten INNERHALB der
 * Anwendung genau richtig. Für die Startseite tut es nichts als eine
 * Übergangsblende: Sie steht in Layouts eigener Liste STANDALONE_PAGES und
 * bekommt dort nur `children` zurück, und ihre Sprachumgebung bringt sie
 * selbst mit. Das gesamte Gewicht des Rahmens lag also auf der ersten
 * Seite, die jemand von ORBYLOX zu sehen bekommt, ohne dort etwas zu tun.
 */
const OHNE_RAHMEN = new Set(['Landing', 'index']);

const LayoutWrapper = ({ children, currentPageName }) => {
  if (!Layout || OHNE_RAHMEN.has(currentPageName)) return <>{children}</>;
  return <Layout currentPageName={currentPageName}>{children}</Layout>;
};

/** Der Kreisel zwischen zwei Seiten — dieselbe Gestalt wie beim Anmelden. */
const Seitenwechsel = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    /**
     * `Suspense` gehört hierher, um die Routen herum.
     *
     * Alle Seiten ausser der Startseite werden nachgeladen (siehe
     * pages.config.js). Waehrend ein Brocken unterwegs ist, hat React nichts
     * zu zeigen — ohne diese Klammer bricht der Aufbau mit "A component
     * suspended while responding to synchronous input" ab.
     *
     * Der Platzhalter ist derselbe Kreisel wie beim Anmelden, damit der
     * Wechsel zwischen zwei Seiten nicht anders aussieht als das Warten auf
     * die Anmeldung.
     */
    <Suspense fallback={<Seitenwechsel />}>
    <Routes>
      {/* Login: full-page form, no Layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).filter(([path]) => path !== 'login').map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
