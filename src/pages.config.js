/**
 * pages.config.js - Page routing configuration
 * 
 * Do not add imports or modify PAGES manually.
 * Pages are registered from files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */

/* ------------------------------------------------------------------------
 * NACHGETRAGEN: Die Seiten werden nachgeladen, nicht mitgeliefert.
 *
 * Vorher stand hier für jede Seite ein gewöhnlicher Import. Das ergibt EIN
 * Bündel: Wer die Startseite öffnete, lud die Leinwand, den Kalender, den
 * Startup-Builder, die Blogverwaltung und den Texteditor gleich mit —
 * 2,2 MB, über die Leitung 614 kB. Auf dem Handy ist das der grösste Teil
 * der Wartezeit, bevor überhaupt etwas zu sehen ist (Lighthouse: 61).
 *
 * `lazy()` macht aus jedem Import einen eigenen Brocken, der erst beim
 * Aufruf der Seite geholt wird. Die Startseite bleibt gewöhnlich importiert:
 * Sie ist das Erste, was jemand sieht — sie nachzuladen hiesse, erst ein
 * leeres Gerüst zu zeigen und dann noch einmal zu warten. `<Suspense>` in
 * App.jsx fängt die Wartezeit der übrigen ab.
 *
 * Falls das Gerüst diese Datei je neu erzeugt, ist das Nachladen weg —
 * `npm run check:bundle` schlägt dann an.
 * ---------------------------------------------------------------------- */
import { lazy } from 'react';
import Landing from './pages/Landing';

/**
 * Auch der Rahmen wird nachgeladen.
 *
 * `Layout.jsx` bringt Seitenleiste, Kopfzeile, Chat-Horcher, Zeiterfassung,
 * Sprachagent — und ueber `api` die ganze Firestore-Bibliothek. Fest
 * importiert lag das alles im ersten Buendel, auch auf der Startseite, die
 * den Rahmen gar nicht benutzt (siehe OHNE_RAHMEN in App.jsx).
 *
 * Nachgeladen kostet er einen zweiten Zugriff — aber nur auf den Seiten, die
 * ihn wirklich zeigen, und dort laeuft er parallel zur Seite selbst.
 */
const __Layout = lazy(() => import('./Layout.jsx'));

const About = lazy(() => import('./pages/About'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const BlogAdmin = lazy(() => import('./pages/BlogAdmin'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Canvas = lazy(() => import('./pages/Canvas'));
const Chat = lazy(() => import('./pages/Chat'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Docs = lazy(() => import('./pages/Docs'));
const FileHub = lazy(() => import('./pages/FileHub'));
const Home = lazy(() => import('./pages/Home'));
const IdeasHub = lazy(() => import('./pages/IdeasHub'));
const Impressum = lazy(() => import('./pages/Impressum'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Login = lazy(() => import('./pages/Login'));
const Meeting = lazy(() => import('./pages/Meeting'));
const ProductValidation = lazy(() => import('./pages/ProductValidation'));
const Profile = lazy(() => import('./pages/Profile'));
const ProjectsList = lazy(() => import('./pages/ProjectsList'));
const ScrumBoard = lazy(() => import('./pages/ScrumBoard'));
const Settings = lazy(() => import('./pages/Settings'));
const SocialBoard = lazy(() => import('./pages/SocialBoard'));
const StartupBuilder = lazy(() => import('./pages/StartupBuilder'));
const Subscription = lazy(() => import('./pages/Subscription'));

export const PAGES = {
    "About": About,
    "AdminUsers": AdminUsers,
    "admin": BlogAdmin,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Canvas": Canvas,
    "Chat": Chat,
    "Contacts": Contacts,
    "Docs": Docs,
    "FileHub": FileHub,
    "IdeasHub": IdeasHub,
    "Home": Home,
    "Impressum": Impressum,
    "Integrations": Integrations,
    "Landing": Landing,
    "login": Login,
    "Meeting": Meeting,
    "ProductValidation": ProductValidation,
    "Profile": Profile,
    "ProjectsList": ProjectsList,
    "ScrumBoard": ScrumBoard,
    "Settings": Settings,
    "SocialBoard": SocialBoard,
    "StartupBuilder": StartupBuilder,
    "Subscription": Subscription,
    // `./pages/index` gab die Startseite nur weiter — hier direkt dieselbe,
    // sonst entstuende ein zweiter Brocken mit demselben Inhalt.
    "index": Landing,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};
