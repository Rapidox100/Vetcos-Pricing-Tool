import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Spinner, Logo } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import FirstRun from './pages/FirstRun.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Layout from './components/Layout.jsx';
import Quotation from './pages/Quotation.jsx';
import Quotes from './pages/Quotes.jsx';
import Team from './pages/Team.jsx';
import PricingRules from './pages/PricingRules.jsx';
import ActivityLog from './pages/ActivityLog.jsx';

function FullScreen({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-4 dark:bg-slate-900">
      <Logo className="h-12" />
      {children}
    </div>
  );
}

export default function App() {
  const { user, loading, initialised } = useAuth();

  if (loading) {
    return (
      <FullScreen>
        <Spinner className="h-8 w-8 text-teal-500" />
      </FullScreen>
    );
  }

  // First run: no users exist yet -> create the first admin.
  if (!initialised) {
    return (
      <FullScreen>
        <FirstRun />
      </FullScreen>
    );
  }

  // Not signed in.
  if (!user) {
    return (
      <FullScreen>
        <Login />
      </FullScreen>
    );
  }

  // Signed in but must choose a new password first.
  if (user.mustChangePw) {
    return (
      <FullScreen>
        <ChangePassword forced />
      </FullScreen>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/quotation" replace />} />
        <Route path="/quotation" element={<Quotation />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/account/password" element={<ChangePassword />} />
        {isAdmin && <Route path="/team" element={<Team />} />}
        {isAdmin && <Route path="/pricing" element={<PricingRules />} />}
        {isAdmin && <Route path="/activity" element={<ActivityLog />} />}
        {/* Anything else (incl. admin routes for sales) -> quotation */}
        <Route path="*" element={<Navigate to="/quotation" replace />} />
      </Routes>
    </Layout>
  );
}
