import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import B2BConnect from './pages/B2BConnect';
import PartnersAdmin from './pages/PartnersAdmin';
import DevelopersPortal from './pages/DevelopersPortal';
import Landing from './pages/Landing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import RequireAuth from './components/RequireAuth';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // Note: 'auth_required' is now handled by the Landing page (public),
    // so we don't auto-redirect anymore. Users click "Login" on the landing page.
  }

  // Render the main app
  return (
    <Routes>
      {/* Public Landing — homepage everyone sees */}
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />

      {/* All configured pages — protected behind login */}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <RequireAuth>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </RequireAuth>
          }
        />
      ))}

      {/* Other explicit routes */}
      <Route path="/b2b-connect" element={<B2BConnect />} />
      <Route path="/partners-admin" element={
        <RequireAuth>
          <LayoutWrapper currentPageName="partners-admin"><PartnersAdmin /></LayoutWrapper>
        </RequireAuth>
      } />
      <Route path="/developers" element={
        <RequireAuth>
          <LayoutWrapper currentPageName="developers"><DevelopersPortal /></LayoutWrapper>
        </RequireAuth>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App