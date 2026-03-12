/**
 * App Component - Layout shell and route definitions
 *
 * LEARNING NOTES - REACT ROUTER:
 *
 * 1. ANGULAR vs REACT ROUTING:
 *    Angular: RouterModule with route configs, <router-outlet>
 *    React:   <Routes> with nested <Route> elements, <Outlet> for nesting
 *
 * 2. KEY DIFFERENCES:
 *    - Angular routes are configured in a separate module/array
 *    - React routes are JSX elements — they live right in the component tree
 *    - Angular uses routerLink directive; React uses <Link> component
 *    - Both support lazy loading, guards (React uses loaders/actions in v6+)
 *
 * 3. LAYOUT PATTERN:
 *    The App component renders the shared layout (header, footer) and uses
 *    <Routes> to swap out the main content area. This is similar to Angular's
 *    AppComponent template with a <router-outlet>.
 */

import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import { useTheme } from './hooks/useTheme';
import { Sun, Moon, Share2 } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { shareUrl } from './lib/share';
import HomePage from './components/HomePage';
import PrepPage from './components/PrepPage';
import SessionPage from './components/SessionPage';
import NotesPage from './components/NotesPage';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import CreditsPage from './components/CreditsPage';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';

function App() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Compact header during session workflow (prep, active session, notes)
  // to maximize screen real estate on mobile. We keep the h1 for accessibility
  // but hide the subtitle and reduce spacing.
  const isSessionView =
    location.pathname === '/prep' ||
    location.pathname.startsWith('/session/') ||
    location.pathname.startsWith('/notes/');

  return (
    <SessionProvider>
      {/* Skip link — visually hidden until focused, lets keyboard users jump to content */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col p-4 pb-12 sm:px-6 sm:pb-8 lg:px-8">
        <header
          className={`flex-shrink-0 text-center ${isSessionView ? 'mb-4 border-b border-border pb-4' : 'mb-8 border-b-2 border-primary pb-6 sm:mb-12 sm:pb-8'}`}
        >
          {/* Three-column flex: flex-1 spacers auto-balance so the title
              stays centered regardless of how many buttons are on the right. */}
          <div className="flex items-start">
            <div className="flex-1" />
            <Link to="/" className="transition-opacity hover:opacity-80">
              <h1
                className={`font-bold text-primary ${isSessionView ? 'text-xl sm:text-2xl' : 'mb-2 text-3xl sm:text-5xl'}`}
              >
                Build-a-Jam
              </h1>
            </Link>
            <div className="flex flex-1 items-center justify-end gap-1">
              {/* Share button — visible on all screen sizes */}
              <button
                type="button"
                onClick={() => void shareUrl(window.location.href, 'Build-a-Jam')}
                className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Share this page"
              >
                <Share2 className="h-5 w-5" />
              </button>
              {/* Theme toggle in header on desktop, in bottom nav on mobile */}
              <button
                type="button"
                onClick={toggleTheme}
                className="hidden p-2 text-muted-foreground transition-colors hover:text-foreground sm:block"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {!isSessionView && (
            <p className="text-sm text-muted-foreground sm:text-lg">
              Your improv exercise library - Plan sessions with confidence
            </p>
          )}
        </header>

        {/* ROUTES: Main content area that grows to push footer down */}
        <main id="main" className="mb-8 flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/prep" element={<PrepPage />} />
            <Route path="/session/:id" element={<SessionPage />} />
            <Route path="/notes/:id" element={<NotesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/credits" element={<CreditsPage />} />
          </Routes>
        </main>

        <Footer />
      </div>
      <BottomNav theme={theme} onToggleTheme={toggleTheme} />
      <Toaster position="bottom-center" duration={3000} richColors />
    </SessionProvider>
  );
}

export default App;
