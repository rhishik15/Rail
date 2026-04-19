'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  approveInspection,
  getApiErrorMessage,
  getInspectionById,
  rejectInspection,
  type InspectionDetail,
} from '../../../lib/api';
import { clearStoredAuth, isAuthenticated } from '../../../lib/auth';

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const inspectionId = useMemo(() => {
    const id = params?.id;
    return Array.isArray(id) ? id[0] : id;
  }, [params]);

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    if (!inspectionId) {
      setLoading(false);
      setError('Inspection id is missing');
      return;
    }

    const loadInspection = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getInspectionById(inspectionId);
        setInspection(data);
      } catch (loadError) {
        const message = getApiErrorMessage(loadError, 'Failed to load inspection');
        setError(message);

        if (message === 'Unauthorized') {
          clearStoredAuth();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadInspection();
  }, [inspectionId, router]);

  const handleApprove = async () => {
    if (!inspectionId || actionLoading) {
      return;
    }

    if (!window.confirm('Approve this inspection?')) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await approveInspection(inspectionId);
      router.push('/inspections');
      router.refresh();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, 'Approval failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!inspectionId || actionLoading) {
      return;
    }

    const comments = window.prompt('Enter rejection comments');

    if (comments === null) {
      return;
    }

    if (comments.trim() === '') {
      setError('Rejection comments are required');
      return;
    }

    if (!window.confirm('Reject this inspection?')) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await rejectInspection(inspectionId, comments.trim());
      router.push('/inspections');
      router.refresh();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, 'Rejection failed'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => router.push('/inspections')}>Back</button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleApprove} disabled={loading || actionLoading || !inspection}>
            {actionLoading ? 'Working...' : 'Approve'}
          </button>
          <button onClick={handleReject} disabled={loading || actionLoading || !inspection}>
            {actionLoading ? 'Working...' : 'Reject'}
          </button>
        </div>
      </div>

      {loading ? <p>Loading inspection...</p> : null}
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}

      {inspection ? (
        <section style={{ backgroundColor: '#ffffff', border: '1px solid #d0d0d0', padding: '1rem' }}>
          <h1 style={{ marginTop: 0 }}>Inspection Detail</h1>
          <p><strong>Template:</strong> {inspection.template.name} v{inspection.template.version}</p>
          <p><strong>Locomotive:</strong> {inspection.locomotive.locoNumber}</p>
          <p><strong>Status:</strong> {inspection.status}</p>
          {inspection.rejectionReason ? (
            <p><strong>Rejection Reason:</strong> {inspection.rejectionReason}</p>
          ) : null}

          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {inspection.entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid #d0d0d0',
                  backgroundColor: entry.isFlagged ? '#fff0f0' : '#fafafa',
                  padding: '0.75rem',
                }}
              >
                <p style={{ margin: '0 0 0.25rem 0' }}>
                  <strong>{entry.templateItem.label}</strong>
                  {entry.isFlagged ? ' - FLAGGED' : ''}
                </p>
                <p style={{ margin: '0 0 0.25rem 0' }}>
                  <strong>Value:</strong> {entry.value === '' ? 'N/A' : entry.value}
                </p>
                <p style={{ margin: '0 0 0.25rem 0' }}>
                  <strong>Input Type:</strong> {entry.templateItem.inputType}
                </p>
                {(entry.templateItem.minValue !== null || entry.templateItem.maxValue !== null) ? (
                  <p style={{ margin: '0 0 0.25rem 0' }}>
                    <strong>Range:</strong> {entry.templateItem.minValue ?? '-'} to {entry.templateItem.maxValue ?? '-'}
                  </p>
                ) : null}
                {entry.remarks ? (
                  <p style={{ margin: 0 }}><strong>Remarks:</strong> {entry.remarks}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
