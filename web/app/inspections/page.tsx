'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  getApiErrorMessage,
  getInspections,
  type InspectionListItem,
} from '../../lib/api';
import { clearStoredAuth, isAuthenticated } from '../../lib/auth';

export default function InspectionsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const loadInspections = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getInspections();
        setInspections(data);
      } catch (loadError) {
        const message = getApiErrorMessage(loadError, 'Failed to load inspections');
        setError(message);

        if (message === 'Unauthorized') {
          clearStoredAuth();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadInspections();
  }, [router]);

  const handleLogout = () => {
    clearStoredAuth();
    router.replace('/login');
  };

  return (
    <main style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Inspections</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {loading ? <p>Loading inspections...</p> : null}
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}

      {!loading && !error ? (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#ffffff',
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #d0d0d0', padding: '0.75rem' }}>
                Locomotive
              </th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #d0d0d0', padding: '0.75rem' }}>
                Template
              </th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #d0d0d0', padding: '0.75rem' }}>
                Status
              </th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #d0d0d0', padding: '0.75rem' }}>
                Created At
              </th>
            </tr>
          </thead>
          <tbody>
            {inspections.map((inspection) => (
              <tr
                key={inspection.id}
                onClick={() => router.push(`/inspections/${inspection.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ borderBottom: '1px solid #e5e5e5', padding: '0.75rem' }}>
                  {inspection.locomotive.locoNumber}
                </td>
                <td style={{ borderBottom: '1px solid #e5e5e5', padding: '0.75rem' }}>
                  {inspection.template.name}
                </td>
                <td style={{ borderBottom: '1px solid #e5e5e5', padding: '0.75rem' }}>
                  {inspection.status}
                </td>
                <td style={{ borderBottom: '1px solid #e5e5e5', padding: '0.75rem' }}>
                  {new Date(inspection.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && !error && inspections.length === 0 ? <p>No inspections found.</p> : null}
    </main>
  );
}
