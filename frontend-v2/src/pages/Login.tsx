import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { loginWithGoogle, loginAsAdmin } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [showAdmin, setShowAdmin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAsAdmin(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm bg-[var(--white)] border border-[var(--border)] rounded-2xl p-8 shadow-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo size={120} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Lumen</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Your research library</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Google Sign-In (returns an ID token credential) */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse.credential) {
                handleGoogleCredential(credentialResponse.credential);
              } else {
                setError('Google returned no credential');
              }
            }}
            onError={() => setError('Google sign-in was cancelled or failed')}
            useOneTap={false}
            theme={theme === 'dark' ? 'filled_black' : 'outline'}
            shape="pill"
            size="large"
            width="300"
          />
        </div>

        {/* Admin toggle */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setShowAdmin((v) => !v); setError(null); }}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {showAdmin ? 'Hide admin login' : 'Sign in as administrator'}
          </button>
        </div>

        {/* Admin login form */}
        {showAdmin && (
          <form onSubmit={handleAdminLogin} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Admin Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
