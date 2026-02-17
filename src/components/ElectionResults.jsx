import React, { useEffect, useState } from 'react';
import { getElectionStats } from '../api';

const ElectionResults = ({ user, onBack }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState(null);
  const [isElectionEnded, setIsElectionEnded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user.nhcId) {
          console.warn('No NHC ID available for user');
          setErrorMessage('NHC information not available');
          setLoading(false);
          return;
        }

        // Fetch latest election info (including ended elections) to check if it has ended
        console.log('Loading election data for NHC ID:', user.nhcId);
        const response = await fetch(`/api/election-by-nhc/${user.nhcId}`);
        
        if (!response.ok) {
          setErrorMessage('No election found for your NHC');
          setLoading(false);
          return;
        }

        const userElection = await response.json();

        // Check if election has ended
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(userElection.ElectionEndDate);
        endDate.setHours(0, 0, 0, 0);
        
        const hasEnded = today >= endDate;
        
        if (!hasEnded) {
          setErrorMessage(`Election is still active. Results will be available after ${new Date(userElection.ElectionEndDate).toLocaleDateString()}`);
          setLoading(false);
          return;
        }

        setElection(userElection);
        setIsElectionEnded(true);

        // Request stats by NHC (fetch latest election for this NHC)
        console.log('Loading election stats for NHC ID:', user.nhcId);
        const data = await getElectionStats({ nhcId: user.nhcId });
        console.log('Received election stats:', data);
        setStats(data);
      } catch (err) {
        console.error('Failed to load election data', err);
        setErrorMessage(err.message || 'Failed to load election results');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user.nhcId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#1f2937' }}>📊 Election Results</h2>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <p>Loading election results...</p>
          </div>
        ) : errorMessage ? (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#991b1b', fontWeight: 'bold' }}>
              ⏳ Results Not Available
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>
              {errorMessage}
            </p>
          </div>
        ) : !isElectionEnded ? (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#b45309' }}>
              🗳️ Election In Progress
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
              Results will be available after the election ends
            </p>
          </div>
        ) : !stats ? (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#b45309' }}>
              ℹ️ No election results available
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
              No eligible candidates or votes found for this election
            </p>
          </div>
        ) : (
          <div>
            {/* ELECTION ENDED BANNER */}
            <div style={{
              backgroundColor: '#dcfce7',
              border: '2px solid #10b981',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '25px',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '16px', color: '#065f46', fontWeight: 'bold' }}>
                ✅ Election Has Ended - Final Results
              </p>
            </div>

            {/* PRESIDENT CATEGORY */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#1f2937', borderBottom: '2px solid #10b981', paddingBottom: '10px' }}>
                👑 President Results
              </h3>
              {stats.president && stats.president.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.president.map((candidate, index) => (
                    <div
                      key={candidate.Id}
                      style={{
                        backgroundColor: index === 0 ? '#fef3c7' : '#f0fdf4',
                        border: index === 0 ? '2px solid #f59e0b' : '2px solid #10b981',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                          {index === 0 && '🥇 '}
                          {index === 1 && '🥈 '}
                          {index === 2 && '🥉 '}
                          {candidate.FirstName && candidate.LastName ? `${candidate.FirstName} ${candidate.LastName}` : candidate.CNIC}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                          CNIC: {candidate.CNIC}
                        </p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: index === 0 ? '#f59e0b' : '#10b981' }}>
                          {candidate.TotalVotes || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          Votes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>ℹ️ No President candidates or votes recorded</p>
              )}
            </div>

            {/* TREASURER CATEGORY */}
            <div>
              <h3 style={{ margin: '0 0 20px 0', color: '#1f2937', borderBottom: '2px solid #0ea5e9', paddingBottom: '10px' }}>
                💼 Treasurer Results
              </h3>
              {stats.treasurer && stats.treasurer.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.treasurer.map((candidate, index) => (
                    <div
                      key={candidate.Id}
                      style={{
                        backgroundColor: index === 0 ? '#fef3c7' : '#eff6ff',
                        border: index === 0 ? '2px solid #f59e0b' : '2px solid #0ea5e9',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                          {index === 0 && '🥇 '}
                          {index === 1 && '🥈 '}
                          {index === 2 && '🥉 '}
                          {candidate.FirstName && candidate.LastName ? `${candidate.FirstName} ${candidate.LastName}` : candidate.CNIC}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                          CNIC: {candidate.CNIC}
                        </p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: index === 0 ? '#f59e0b' : '#0ea5e9' }}>
                          {candidate.TotalVotes || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          Votes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>ℹ️ No Treasurer candidates or votes recorded</p>
              )}
            </div>
          </div>
        )}

        {/* CLOSE BUTTON */}
        <button
          onClick={onBack}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '12px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#059669';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#10b981';
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default ElectionResults;
