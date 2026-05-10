import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';

function authErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
      } else if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setResetSent(false);
    setPassword('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="login-brand">Planner</span>

        {mode === 'reset' ? (
          <>
            <p className="login-subtitle">Enter your email to reset your password.</p>
            {resetSent ? (
              <p className="login-success">Check your email for a reset link.</p>
            ) : (
              <form className="login-form" onSubmit={handleSubmit}>
                <input
                  className="login-input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && <p className="login-error">{error}</p>}
                <button className="login-btn" type="submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Email'}
                </button>
              </form>
            )}
            <button className="login-link" onClick={() => switchMode('signin')}>
              Back To Sign In
            </button>
          </>
        ) : (
          <>
            <p className="login-subtitle">
              {mode === 'signup' ? 'Create an account.' : 'Sign in to your planner.'}
            </p>
            <form className="login-form" onSubmit={handleSubmit}>
              <input
                className="login-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                className="login-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {error && <p className="login-error">{error}</p>}
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? '…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <div className="login-links">
              {mode === 'signin' ? (
                <>
                  <button className="login-link" onClick={() => switchMode('signup')}>
                    Create An Account
                  </button>
                  <button className="login-link" onClick={() => switchMode('reset')}>
                    Forgot Password?
                  </button>
                </>
              ) : (
                <button className="login-link" onClick={() => switchMode('signin')}>
                  Already Have An Account? Sign In
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
