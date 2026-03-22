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
import Calendar from './pages/Calendar';
import AdminUsers from './pages/AdminUsers';
import Canvas from './pages/Canvas';
import Chat from './pages/Chat';
import Docs from './pages/Docs';
import FileHub from './pages/FileHub';
import Home from './pages/Home';
import Impressum from './pages/Impressum';
import Integrations from './pages/Integrations';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ProductValidation from './pages/ProductValidation';
import Profile from './pages/Profile';
import ProjectsList from './pages/ProjectsList';
import ScrumBoard from './pages/ScrumBoard';
import Settings from './pages/Settings';
import SocialBoard from './pages/SocialBoard';
import StartupBuilder from './pages/StartupBuilder';
import Subscription from './pages/Subscription';
import index from './pages/index';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminUsers": AdminUsers,
    "Calendar": Calendar,
    "Canvas": Canvas,
    "Chat": Chat,
    "Docs": Docs,
    "FileHub": FileHub,
    "Home": Home,
    "Impressum": Impressum,
    "Integrations": Integrations,
    "Landing": Landing,
    "login": Login,
    "ProductValidation": ProductValidation,
    "Profile": Profile,
    "ProjectsList": ProjectsList,
    "ScrumBoard": ScrumBoard,
    "Settings": Settings,
    "SocialBoard": SocialBoard,
    "StartupBuilder": StartupBuilder,
    "Subscription": Subscription,
    "index": index,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};