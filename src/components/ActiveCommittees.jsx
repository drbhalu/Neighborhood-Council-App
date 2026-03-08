import React, { useState, useEffect } from 'react';
import { getPanels } from '../api';
import logo from '../assets/logo.png';

const ActiveCommittees = ({ user, onClose }) => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPanels = async () => {
      try {
        setLoading(true);
        // Fetch all panels for this NHC (using nhcCode as NHC_Id doesn't seem to be used, so we try to get by cnic or general fetch)
        const data = await getPanels({ nhcId: user.nhcId });
        setPanels(data || []);
      } catch (err) {
        console.error('Error fetching panels:', err);
        setError(err.message || 'Failed to fetch committees');
      } finally {
        setLoading(false);
      }
    };
    fetchPanels();
  }, [user.nhcId]);

  // Calculate days since creation
  const getDaysSince = (createdDate) => {
    if (!createdDate) return 'Recent';
    const created = new Date(createdDate);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px 30px',
        width: '100%',
        maxWidth: '700px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* HEADER WITH CLOSE BUTTON */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <img src={logo} alt="Logo" style={{ height: '60px', width: 'auto', marginBottom: '15px' }} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>Active Committees</h1>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* USER INFO */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#1f2937'
          }}>
            Assalam-o-Alikum, President {user.firstName} {user.lastName}
          </h2>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            Here are the active committees in your NHC
          </p>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#991b1b',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666'
          }}>
            <p>Loading committees...</p>
          </div>
        )}

        {/* COMMITTEES LIST */}
        {!loading && panels.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <p style={{ margin: 0, fontSize: '16px' }}>No active committees yet.</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#999' }}>
              Create a new committee to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {panels.map((panel) => (
              <div
                key={panel.Id}
                style={{
                  backgroundColor: '#0ea5e9',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)';
                }}
              >
                {/* COMMITTEE NAME */}
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {panel.PanelName || `Committee ${panel.Id}`}
                </h3>

                {/* COMMITTEE META INFO */}
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '12px'
                }}>
                  📋 Status: <strong>{panel.Status || 'Active'}</strong> &nbsp;&nbsp;
                  📅 Created: <strong>{getDaysSince(panel.CreatedDate)}</strong>
                </p>

                {/* COMMITTEE DESCRIPTION / ISSUE */}
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.95)',
                  fontWeight: '500',
                  marginTop: '8px'
                }}>
                  💼 Committee Focus Area
                </p>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: '1.4'
                }}>
                  {panel.Description || 'General Committee Activities'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* CREATE NEW COMMITTEE BUTTON */}
        <button
          onClick={() => {
            // Placeholder for future create committee functionality
            alert('Create new committee feature coming soon!');
          }}
          style={{
            width: '100%',
            padding: '15px 20px',
            backgroundColor: '#0ea5e9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#0284c7';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#0ea5e9';
          }}
        >
          + CREATE NEW COMMITTE
        </button>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            marginTop: '12px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4b5563';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#6b7280';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ActiveCommittees;
