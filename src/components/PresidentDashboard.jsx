import React, { useState, useEffect } from 'react';
import { getComplaintsByNHC } from '../api';
import logo from '../assets/logo.png';

const PresidentDashboard = ({ user, onClose }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); // null = overview, 'total', 'open', 'in-progress', 'resolved'

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await getComplaintsByNHC(user.nhcCode);
        setComplaints(data || []);
      } catch (err) {
        console.error('Error fetching complaints:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, [user.nhcCode]);

  // Calculate statistics
  const totalComplaints = complaints.length;
  const openComplaints = complaints.filter(c => c.Status === 'Pending' || c.Status === 'Open').length;
  const inProgressComplaints = complaints.filter(c => c.Status === 'In-Progress').length;
  const resolvedComplaints = complaints.filter(c => c.Status === 'Resolved').length;

  // Filter complaints based on selected category
  const getFilteredComplaints = () => {
    switch (selectedCategory) {
      case 'total':
        return complaints;
      case 'open':
        return complaints.filter(c => c.Status === 'Pending' || c.Status === 'Open');
      case 'in-progress':
        return complaints.filter(c => c.Status === 'In-Progress');
      case 'resolved':
        return complaints.filter(c => c.Status === 'Resolved');
      default:
        return [];
    }
  };

  // Get category title
  const getCategoryTitle = () => {
    switch (selectedCategory) {
      case 'total':
        return 'All Complaints';
      case 'open':
        return 'Open Complaints';
      case 'in-progress':
        return 'In-Progress Complaints';
      case 'resolved':
        return 'Resolved Complaints';
      default:
        return '';
    }
  };

  // Handle card click
  const handleCardClick = (category) => {
    setSelectedCategory(category);
  };

  // Handle back to overview
  const handleBackToOverview = () => {
    setSelectedCategory(null);
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
        maxWidth: selectedCategory ? '900px' : '700px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* HEADER WITH CLOSE BUTTON */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '30px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <img src={logo} alt="Logo" style={{ height: '60px', width: 'auto', marginBottom: '15px' }} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
              {selectedCategory ? getCategoryTitle() : 'Dashboard'}
            </h1>
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

        {/* BACK BUTTON (only show when viewing details) */}
        {selectedCategory && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleBackToOverview}
              style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ← Back to Overview
            </button>
          </div>
        )}

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
            Assalam-o-Alikum, {user.role || 'President'} {user.firstName} {user.lastName}
          </h2>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            {selectedCategory ? 'Here are the complaint details' : 'Here is an overview of citizen reports in your area'}
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
            <p>Loading complaint statistics...</p>
          </div>
        )}

        {/* STATISTICS CARDS */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '30px'
          }}>
            {/* TOTAL COMPLAINTS */}
            <div
              style={{
                backgroundColor: '#0ea5e9',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => handleCardClick('total')}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '200px',
                height: '200px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }}></div>
              <p style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '500'
              }}>
                Total complaints
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {totalComplaints}
                </span>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  All
                </span>
              </div>
            </div>

            {/* OPEN/ATTENTION COMPLAINTS */}
            <div
              style={{
                backgroundColor: '#0ea5e9',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => handleCardClick('open')}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '200px',
                height: '200px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }}></div>
              <p style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '500'
              }}>
                Open
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {openComplaints}
                </span>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  Attention
                </span>
              </div>
            </div>

            {/* IN-PROGRESS COMPLAINTS */}
            <div
              style={{
                backgroundColor: '#0ea5e9',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => handleCardClick('in-progress')}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '200px',
                height: '200px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }}></div>
              <p style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '500'
              }}>
                In-Progress
              </p>
              <span style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white'
              }}>
                {inProgressComplaints}
              </span>
            </div>

            {/* RESOLVED COMPLAINTS */}
            <div
              style={{
                backgroundColor: '#0ea5e9',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => handleCardClick('resolved')}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '200px',
                height: '200px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }}></div>
              <p style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '500'
              }}>
                Resolved
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {resolvedComplaints}
                </span>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  Resolved
                </span>
              </div>
            </div>
          </div>
        )}

        {/* COMPLAINT DETAILS VIEW */}
        {!loading && selectedCategory && (
          <div>
            {getFilteredComplaints().length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <p>No complaints found in this category.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {getFilteredComplaints().map((complaint) => (
                  <div
                    key={complaint.Id}
                    style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {/* COMPLAINT HEADER */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <h3 style={{
                          margin: '0 0 4px 0',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: '#1f2937'
                        }}>
                          {complaint.Category}
                        </h3>
                        <p style={{
                          margin: 0,
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          Submitted by: {complaint.UserName} (CNIC: {complaint.UserCNIC})
                        </p>
                      </div>
                      <div style={{
                        backgroundColor: complaint.Status === 'Resolved' ? '#10b981' :
                                       complaint.Status === 'In-Progress' ? '#f59e0b' :
                                       complaint.Status === 'Pending' ? '#ef4444' : '#6b7280',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {complaint.Status || 'Pending'}
                      </div>
                    </div>

                    {/* COMPLAINT DESCRIPTION */}
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#374151'
                      }}>
                        Description:
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#4b5563',
                        lineHeight: '1.5'
                      }}>
                        {complaint.Description}
                      </p>
                    </div>

                    {/* COMPLAINT DETAILS */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Budget Involved:
                        </span>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '14px',
                          color: complaint.HasBudget ? '#ef4444' : '#10b981',
                          fontWeight: 'bold'
                        }}>
                          {complaint.HasBudget ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Date Submitted:
                        </span>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '14px',
                          color: '#374151'
                        }}>
                          {new Date(complaint.CreatedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* PHOTO ATTACHMENT */}
                    {complaint.PhotoPath && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{
                          margin: '0 0 8px 0',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#374151'
                        }}>
                          📸 Photo Attachment:
                        </p>
                        <img
                          src={`http://localhost:3001${complaint.PhotoPath}`}
                          alt="Complaint photo"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db'
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            marginTop: '20px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3b82f6';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PresidentDashboard;
