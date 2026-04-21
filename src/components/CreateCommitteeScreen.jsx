import React, { useEffect, useState } from 'react';
import { createPanel, getCommitteeSettings, getNHCMembersByCode, getComplaintsByNHC, getPanels } from '../api';

const CreateCommitteeScreen = ({ user, onBack, onCreated, initialComplaintId = null }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [committeeMemberCount, setCommitteeMemberCount] = useState(3);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [existingPanels, setExistingPanels] = useState([]);
  const [formData, setFormData] = useState({
    committeeName: '',
    complaintId: '',
    committeeHead: '',
    member1: '',
    member2: '',
    member3: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [membersData, complaintsData, panelsData, settingsData] = await Promise.all([
          getNHCMembersByCode(user.nhcCode),
          getComplaintsByNHC(user.nhcCode),
          getPanels(user.nhcId ? { nhcId: user.nhcId } : { cnic: user.cnic }),
          getCommitteeSettings(),
        ]);

        const configuredCount = Number(settingsData?.committeeMemberCount) || 3;
        setCommitteeMemberCount(Math.max(1, configuredCount));
        setAvailableMembers((membersData || []).filter((m) => String(m.CNIC) !== String(user.cnic)));
        setComplaints(complaintsData || []);
        setExistingPanels(panelsData || []);
      } catch (err) {
        console.error('Error loading create committee screen data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user.cnic, user.nhcCode, user.nhcId]);

  useEffect(() => {
    if (initialComplaintId) {
      setFormData((prev) => ({ ...prev, complaintId: String(initialComplaintId) }));
    }
  }, [initialComplaintId]);

  const memberFieldNames = Array.from({ length: committeeMemberCount }, (_, index) => `member${index + 1}`);
  const selectedMembers = memberFieldNames.map((fieldName) => formData[fieldName]);

  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev };
      memberFieldNames.forEach((fieldName) => {
        if (typeof next[fieldName] === 'undefined') {
          next[fieldName] = '';
        }
      });
      Object.keys(next).forEach((key) => {
        if (/^member\d+$/.test(key) && !memberFieldNames.includes(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [committeeMemberCount]);

  useEffect(() => {
    if (formData.committeeHead && !selectedMembers.includes(formData.committeeHead)) {
      setFormData((prev) => ({ ...prev, committeeHead: '' }));
    }
  }, [formData.committeeHead, selectedMembers.join('|')]);

  const getAvailableOptionsForField = (fieldName) => {
    const selected = new Set(selectedMembers.filter((cnic) => cnic && cnic !== formData[fieldName]));
    return availableMembers.filter((member) => {
      const cnic = String(member.CNIC || '');
      if (!cnic) return false;
      if (formData[fieldName] === cnic) return true;
      return !selected.has(cnic);
    });
  };

  const getAssignableComplaints = () => {
    const assignedComplaintIds = new Set(
      (existingPanels || [])
        .map((p) => p.ComplaintId)
        .filter((id) => id !== null && typeof id !== 'undefined')
        .map((id) => Number(id))
    );

    return (complaints || []).filter((c) => {
      const status = String(c.Status || '').toLowerCase().replace(/\s+/g, '-');
      const isPending = status === 'pending' || status === 'open';
      const isUnassigned = !assignedComplaintIds.has(Number(c.Id));
      const isRequested = initialComplaintId && Number(c.Id) === Number(initialComplaintId);
      const isResolved = status === 'resolved';

      if (isRequested) {
        return isUnassigned && !isResolved;
      }
      return isPending && isUnassigned;
    });
  };

  const assignableComplaints = getAssignableComplaints();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user.nhcId) {
      alert('NHC information is missing. Please login again.');
      return;
    }

    const uniqueMembers = new Set(selectedMembers);

    if (!formData.committeeName.trim()) {
      alert('Please enter committee name.');
      return;
    }
    if (selectedMembers.some((cnic) => !cnic)) {
      alert(`Please select all ${committeeMemberCount} committee members.`);
      return;
    }
    if (uniqueMembers.size !== selectedMembers.length) {
      alert('Please select 5 different members.');
      return;
    }
    if (!formData.committeeHead) {
      alert('Please select a committee head from selected members.');
      return;
    }
    if (!formData.complaintId) {
      alert('Please select a complaint to assign this committee.');
      return;
    }

    try {
      setSubmitting(true);
      await createPanel({
        panelName: formData.committeeName.trim(),
        presidentCnic: user.cnic,
        nhcId: user.nhcId,
        members: selectedMembers.map((cnic) => ({
          cnic,
          role: cnic === formData.committeeHead ? 'Head' : 'Member',
        })),
        complaintId: Number(formData.complaintId),
        isCommittee: true,
      });

      alert('Committee created successfully.');
      if (typeof onCreated === 'function') {
        onCreated();
      }
    } catch (error) {
      alert('Error creating committee: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, color: '#1f2937', fontSize: '22px' }}>Create Committee</h3>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}
        >
          ✕
        </button>
      </div>

      <p style={{ marginTop: 0, color: '#64748b', marginBottom: '14px' }}>
        Enter committee details and assign one complaint.
      </p>

      {loading ? (
        <p style={{ color: '#475569' }}>Loading form data...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
              Committee Name
            </label>
            <input
              type="text"
              required
              value={formData.committeeName}
              onChange={(e) => setFormData({ ...formData, committeeName: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
              placeholder="Enter committee name"
            />
          </div>

          {memberFieldNames.map((fieldKey, index) => (
            <div style={{ marginBottom: '15px' }} key={fieldKey}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
                Member {index + 1}
              </label>
              <select
                required
                value={formData[fieldKey]}
                onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
              >
                <option value="">Select member {index + 1}</option>
                {getAvailableOptionsForField(fieldKey).map((member) => (
                  <option key={`${fieldKey}-${member.CNIC}`} value={member.CNIC}>
                    {member.FirstName} {member.LastName} ({member.CNIC})
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
              Committee Head
            </label>
            <select
              required
              value={formData.committeeHead}
              onChange={(e) => setFormData({ ...formData, committeeHead: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
            >
              <option value="">Select committee head</option>
              {selectedMembers
                .filter(Boolean)
                .map((cnic) => {
                  const member = availableMembers.find((m) => String(m.CNIC) === String(cnic));
                  return (
                    <option key={`head-${cnic}`} value={cnic}>
                      {member ? `${member.FirstName} ${member.LastName}` : cnic} ({cnic})
                    </option>
                  );
                })}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
              Assign Complaint
            </label>
            <select
              required
              value={formData.complaintId}
              onChange={(e) => setFormData({ ...formData, complaintId: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
            >
              <option value="">Select complaint</option>
              {assignableComplaints.map((complaint) => (
                <option key={`complaint-${complaint.Id}`} value={complaint.Id}>
                  #{complaint.Id} - {complaint.Category} ({complaint.UserName || complaint.UserCNIC || 'Unknown'})
                </option>
              ))}
            </select>
            {assignableComplaints.length === 0 && (
              <div style={{ marginTop: '8px', color: '#991b1b', fontSize: '12px' }}>
                No pending unassigned complaints available.
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || assignableComplaints.length === 0}
            style={{
              width: '100%',
              padding: '10px 20px',
              backgroundColor: '#0f766e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Committee'}
          </button>
        </form>
      )}
    </div>
  );
};

export default CreateCommitteeScreen;
