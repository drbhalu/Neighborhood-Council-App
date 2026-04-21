import React, { useEffect, useState } from 'react';
import { getAllComplaints, getComplaintHistory } from '../api';

const AdminComplaints = ({ user, onClose }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getAllComplaints();
        setComplaints(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedComplaint?.Id || !user?.cnic) return;
      try {
        setHistoryLoading(true);
        const data = await getComplaintHistory(selectedComplaint.Id, user.cnic);
        setHistory(data || []);
      } catch (_) {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [selectedComplaint?.Id, user?.cnic]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '980px',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0 }}>All Complaints</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>

        {error ? <div style={{ color: '#b91c1c', marginBottom: '10px' }}>{error}</div> : null}
        {loading ? <div>Loading complaints...</div> : null}

        {!loading && !selectedComplaint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(complaints || []).map((c) => (
              <div key={c.Id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.Category || 'Complaint'} (#{c.Id})</div>
                    <div style={{ fontSize: '13px', color: '#475569' }}>{c.UserName || c.UserCNIC || 'Unknown'} | {c.NHC_Code || 'N/A'}</div>
                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>{c.Description || ''}</div>
                  </div>
                  <button
                    onClick={() => setSelectedComplaint(c)}
                    style={{ border: 'none', borderRadius: '8px', backgroundColor: '#2563eb', color: '#fff', padding: '8px 10px', cursor: 'pointer', height: '36px' }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && selectedComplaint && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <button
              onClick={() => setSelectedComplaint(null)}
              style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', marginBottom: '8px' }}
            >
              ←
            </button>
            <h3 style={{ marginTop: 0 }}>{selectedComplaint.Category || 'Complaint'} (#{selectedComplaint.Id})</h3>
            <p style={{ margin: '0 0 8px 0' }}><strong>Status:</strong> {selectedComplaint.Status || 'Pending'}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong>NHC:</strong> {selectedComplaint.NHC_Code || 'N/A'}</p>
            <p style={{ margin: '0 0 12px 0' }}><strong>Description:</strong> {selectedComplaint.Description || ''}</p>

            {selectedComplaint.MeetingMinutesPath ? (
              <p style={{ margin: '0 0 12px 0' }}>
                <a href={`http://localhost:3001${selectedComplaint.MeetingMinutesPath}`} target="_blank" rel="noreferrer">Open latest minutes PDF</a>
              </p>
            ) : null}

            <h4 style={{ marginBottom: '8px' }}>Update History</h4>
            {historyLoading ? (
              <div>Loading history...</div>
            ) : history.length === 0 ? (
              <div style={{ color: '#64748b' }}>No history records.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.map((h) => (
                  <div key={h.Id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', color: '#334155' }}>{new Date(h.CreatedDate).toLocaleString()} | {h.ActionType}</div>
                    <div style={{ fontSize: '13px' }}><strong>By:</strong> {h.ActorCNIC || 'System'} {h.ActorRole ? `(${h.ActorRole})` : ''}</div>
                    {h.StatusSnapshot ? <div style={{ fontSize: '13px' }}><strong>Status:</strong> {h.StatusSnapshot}</div> : null}
                    {h.RemarksSnapshot ? <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}><strong>Remarks:</strong> {h.RemarksSnapshot}</div> : null}
                    {h.MinutesPathSnapshot ? (
                      <a href={`http://localhost:3001${h.MinutesPathSnapshot}`} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2563eb' }}>
                        Open PDF
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminComplaints;
