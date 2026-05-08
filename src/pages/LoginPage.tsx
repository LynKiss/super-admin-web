import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { getApiBaseUrl, login } from '../lib/api';
import { useSession } from '../hooks/useSession';

export default function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/console';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(normalizedEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="brand-mark">
          <ShieldCheck size={24} />
          <span>Central Super Admin</span>
        </div>
        <div className="login-visual-copy">
          <p>Central authority</p>
          <h1>Project access control for every backend.</h1>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <ShieldCheck size={24} />
            <span>Central Super Admin</span>
          </div>
          <p className="eyebrow">Secure console</p>
          <h2>Sign in</h2>
          <p className="muted api-base">API: {getApiBaseUrl()}</p>

          {error ? (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="form-stack">
            <label className="field">
              <span>Email</span>
              <div className="input-icon">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="root@example.com"
                />
              </div>
            </label>

            <label className="field">
              <span>Password</span>
              <div className="input-icon">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="icon-button flat"
                  onClick={() => setShowPassword((value) => !value)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button type="submit" className="primary-button full" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}
              {submitting ? 'Signing in' : 'Enter console'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
