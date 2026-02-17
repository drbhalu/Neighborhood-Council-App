import React, { useState, useEffect } from 'react';
import { nominateSelf, getNominations, getCandidates, getPositions } from '../api';

const SelfNominationForm = ({ user, onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [nominationOpen, setNominationOpen] = useState(false);
  const [nominationStartDate, setNominationStartDate] = useState(null);
  const [nominationEndDate, setNominationEndDate] = useState(null);
  const [alreadyNominated, setAlreadyNominated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState([]);

  const handleNominate = async () => {
    if (!selectedCategory) {
      alert('Please select a category');
      return;
    }

    if (!user.nhcId) {
      alert('Your NHC information is not available. Please update your profile.');
      return;
    }

    if (!nominationOpen) {
      alert('Nominations are not open today for your NHC.');
      return;
    }

    if (alreadyNominated) {
      alert('You have already nominated.');
      return;
    }

    setIsSubmitting(true);
    try {
      await nominateSelf(user.cnic, user.nhcId, selectedCategory);
      setSuccessMessage(`✅ You have successfully nominated yourself as ${selectedCategory}!`);
      setSelectedCategory('');
      setAlreadyNominated(true);
      setTimeout(() => {
        onBack();
      }, 1600);
    } catch (err) {
      console.error('Nomination error:', err);
      const msg = err && err.message ? err.message : '';
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        alert('You have already nominated for this NHC');
        setAlreadyNominated(true);
      } else if (msg.toLowerCase().includes('nomination') && msg.toLowerCase().includes('open')) {
        alert('Nominations are not open today for your NHC');
        setNominationOpen(false);
      } else {
        alert('Failed to nominate: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    const loadState = async () => {
      setLoading(true);
      try {
        if (!user || !user.nhcId) {
          setNominationOpen(false);
          setAlreadyNominated(false);
          return;
        }

        // Get nomination records for this NHC (use number-safe comparison)
        const nominations = await getNominations();
        console.log('DEBUG getNominations:', nominations);

        const nhcRecords = (nominations || []).filter(n => Number(n.NHC_Id) === Number(user.nhcId) || Number(n.NHCId) === Number(user.nhcId));
        console.log('DEBUG nhcRecords:', nhcRecords);

        // Prefer a record whose period includes today; otherwise pick the most recent schedule
        let record = null;
        if (nhcRecords.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const withDates = nhcRecords.map(r => {
            const startStr = String(r.NominationStartDate || r.NominationStart || r.StartDate || '').split('T')[0];
            const endStr = String(r.NominationEndDate || r.NominationEnd || r.EndDate || '').split('T')[0];
            if (!startStr || !endStr) return null;
            const [sy, sm, sd] = startStr.split('-').map(Number);
            const [ey, em, ed] = endStr.split('-').map(Number);
            const startDate = new Date(sy, sm - 1, sd);
            const endDate = new Date(ey, em - 1, ed);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            return { raw: r, startDate, endDate };
          }).filter(Boolean);

          const active = withDates.find(p => today >= p.startDate && today <= p.endDate);
          if (active) {
            record = active.raw;
          } else if (withDates.length > 0) {
            withDates.sort((a, b) => b.startDate - a.startDate);
            record = withDates[0].raw;
          } else {
            // fallback to first record if no parseable dates available
            record = nhcRecords[0];
          }
        }

        console.log('DEBUG chosen record:', record);

        if (record && (record.NominationStartDate || record.NominationEndDate)) {
          // Parse DATE from DB string "YYYY-MM-DD" safely as local date
          const startDateStr = String(record.NominationStartDate || record.NominationStart || '').split('T')[0];
          const endDateStr = String(record.NominationEndDate || record.NominationEnd || '').split('T')[0];
          
          const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
          const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
          
          const startDate = new Date(startYear, startMonth - 1, startDay);
          const endDate = new Date(endYear, endMonth - 1, endDay);
          // Use date-only comparison (no time) — normalize all dates to start of day
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          console.log('DEBUG startDateStr:', startDateStr);
          console.log('DEBUG endDateStr:', endDateStr);
          console.log('DEBUG startDate:', startDate);
          console.log('DEBUG endDate:', endDate);
          console.log('DEBUG today:', today);
          
          // Check if today is within the range (inclusive)
          const isWithinRange = today >= startDate && today <= endDate;
          console.log('DEBUG isWithinRange result:', isWithinRange);
          
          if (isWithinRange) {
            setNominationOpen(true);
          } else {
            setNominationOpen(false);
          }
          setNominationStartDate(record.NominationStartDate || record.NominationStart || null);
          setNominationEndDate(record.NominationEndDate || record.NominationEnd || null);
        } else {
          console.log('DEBUG no record or dates found');
          setNominationOpen(false);
          setNominationStartDate(null);
          setNominationEndDate(null);
        }

        // Load positions for category selection
        try {
          const pos = await getPositions();
          setPositions((pos || []).map(p => (p.Name || p.name)));
        } catch (posErr) {
          console.error('Failed to load positions', posErr);
          setPositions(['President', 'Treasurer']);
        }

        // Check if user already nominated
        const candidates = await getCandidates(user.nhcId);
        const already = (candidates || []).some(c => String(c.CNIC) === String(user.cnic) || String(c.Cnic) === String(user.cnic));
        setAlreadyNominated(!!already);
      } catch (err) {
        console.error('Failed to load nomination state', err);
        setNominationOpen(false);
        setAlreadyNominated(false);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, [user]);

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
        maxWidth: '500px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#1f2937' }}>🎯 Self Nomination</h2>
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

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '2px solid #10b981',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            color: '#166534',
            textAlign: 'center'
          }}>
            {successMessage}
          </div>
        )}

        {/* CONTENT */}
        {!successMessage && (
          <div>
            {/* INFO / STATUS MESSAGE */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '12px', color: '#6b7280' }}>Checking nomination status...</div>
            ) : alreadyNominated ? (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                color: '#065f46'
              }}>
                ✅ You have already nominated for this NHC.
              </div>
            ) : nominationOpen ? (
              <div style={{
                backgroundColor: '#eff6ff',
                border: '2px solid #0ea5e9',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                color: '#0369a1'
              }}>
                💡 Nominations are open today. Select your preferred position. You'll need 5 votes from your NHC members to become eligible.
              </div>
            ) : (
              <div style={{
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                color: '#92400e'
              }}>
                ⚠️ Nominations are not open currently for your NHC.
                {nominationStartDate && nominationEndDate && (
                  <div style={{ marginTop: 8, fontSize: '13px' }}>
                    📅 Nomination period: {new Date(nominationStartDate).toLocaleDateString()} to {new Date(nominationEndDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY SELECTION */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Choose Position:
              </label>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {positions.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    style={{
                      padding: '16px',
                      border: selectedCategory === category ? '2px solid #10b981' : '2px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: selectedCategory === category ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: selectedCategory === category ? '#10b981' : '#6b7280',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCategory !== category) {
                        e.target.style.borderColor = '#10b981';
                        e.target.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCategory !== category) {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.backgroundColor = '#ffffff';
                      }
                    }}
                  >
                    {category === 'President' ? '👑' : '💼'} {category}
                    {selectedCategory === category && ' ✓'}
                  </button>
                ))}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button
                onClick={handleNominate}
                disabled={!selectedCategory || isSubmitting || !nominationOpen || alreadyNominated || loading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: (selectedCategory && !isSubmitting && nominationOpen && !alreadyNominated && !loading) ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: (selectedCategory && !isSubmitting && nominationOpen && !alreadyNominated && !loading) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory && !isSubmitting && nominationOpen && !alreadyNominated && !loading) {
                    e.target.style.backgroundColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory && !isSubmitting && nominationOpen && !alreadyNominated && !loading) {
                    e.target.style.backgroundColor = '#10b981';
                  }
                }}
              >
                {isSubmitting ? 'Nominating...' : (!nominationOpen ? 'Nominations Closed' : (alreadyNominated ? 'Already Nominated' : 'Nominate'))}
              </button>
              <button
                onClick={onBack}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#ef4444';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfNominationForm;
