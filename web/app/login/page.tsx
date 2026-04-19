'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { login, getApiErrorMessage } from '../../lib/api';
import { isAuthenticated, setStoredAuth, WEB_DEVICE_ID } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/inspections');
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await login({
        employeeId,
        password,
        deviceId: WEB_DEVICE_ID,
      });

      setStoredAuth(response.token, response.user);
      router.replace('/inspections');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'grid',
          gap: '0.75rem',
          backgroundColor: '#ffffff',
          padding: '1.5rem',
          border: '1px solid #d0d0d0',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Supervisor Login</h1>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Employee ID</span>
          <input
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading || employeeId.trim() === '' || password === ''}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {error ? <p style={{ margin: 0, color: '#b00020' }}>{error}</p> : null}
      </form>
    </main>
  );
}
