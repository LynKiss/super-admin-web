import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { bootstrapSession } from './lib/api';
import { useSession } from './hooks/useSession';
import LoginPage from './pages/LoginPage';
import ConsolePage from './pages/ConsolePage';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapSession().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <main className="loading-screen">
        <LoaderCircle className="spin" size={22} />
        <span>Loading console</span>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/console"
        element={
          <RequireSession>
            <ConsolePage />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/console" replace />} />
    </Routes>
  );
}

function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
