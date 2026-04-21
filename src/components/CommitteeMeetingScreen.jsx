import React, { useEffect, useState } from 'react';
import { getComplaintHistory, saveCommitteeMeetingDecision } from '../api';

const CommitteeMeetingScreen = ({ committee, user, onBack, onSaved, allowPresidentReview = false }) => {
  const normalizeDecision = (value) => {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'budget' || v === 'budget needed') return 'budget';
    if (v === 'solved' || v === 'complaint solved in meeting') return 'solved';
    if (v === 'inprogress' || v === 'in-progress' || v === 'need more work / still in progress') return 'inprogress';
    return '';
  };

  const [minutesFile, setMinutesFile] = useState(null);
  const [remarks, setRemarks] = useState(committee?.CommitteeRemarks || '');
  const [decision, setDecision] = useState(normalizeDecision(committee?.MeetingDecision));
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetReason, setBudgetReason] = useState('');
  const [moreWorkNeeded, setMoreWorkNeeded] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const isPresident = String(user?.role || '').toLowerCase() === 'president';
  const complaintId = committee?.ComplaintId || committee?.Id;

  const complainant = committee?.ComplaintUserName || committee?.UserName || committee?.ComplaintUserCNIC || committee?.UserCNIC || 'N/A';
  const complaintType = String(committee?.ComplaintType || '').toLowerCase() === 'against' ? 'Against Member' : 'Normal';
  const statusLabel = committee?.ComplaintStatus || committee?.Status || 'In Progress';

  const mapDecisionToStatus = (value) => {
    if (value === 'solved') return 'Resolved';
    return 'In-Progress';
  };

  const decisionLabelMap = {
    budget: 'Budget Needed',
    solved: 'Complaint Solved In Meeting',
    inprogress: 'Need More Work / Still In Progress',
  };

  const cardStyle = {
    backgroundColor: '#f6f3fa',
    border: '1px solid #e9e3f2',
    borderRadius: '24px',
    padding: '22px',
  };

  const sectionTitleStyle = {
    margin: '0 0 10px 0',
    fontSize: '22px',
    color: '#111827',
    fontWeight: '700',
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '15px',
    color: '#1f2937',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  };

  useEffect(() => {
    const loadHistory = async () => {
      if (!complaintId || !user?.cnic) return;
      try {
        setHistoryLoading(true);
        setHistoryError('');
        const rows = await getComplaintHistory(complaintId, user.cnic);
        setHistory(rows || []);
      } catch (err) {
        setHistoryError(err.message || 'Failed to load complaint history');
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [complaintId, user?.cnic]);

  const handleSave = async () => {
    if (isPresident && !allowPresidentReview) {
      alert('President can only view committee decisions.');
      return;
    }

    if (!complaintId) {
      alert('No complaint is assigned to this committee.');
      return;
    }
    if (!decision) {
      alert('Please select a meeting decision.');
      return;
    }
    if (decision === 'budget') {
      if (!String(budgetAmount || '').trim()) {
        alert('Please enter how much budget is needed.');
        return;
      }
      if (!String(budgetReason || '').trim()) {
        alert('Please enter why more budget is needed.');
        return;
      }
    }
    if (decision === 'inprogress' && !String(moreWorkNeeded || '').trim()) {
      alert('Please enter what more work is needed.');
      return;
    }

    try {
      setSaving(true);
      await saveCommitteeMeetingDecision({
        complaintId,
        remarks: remarks?.trim(),
        status: isPresident && allowPresidentReview && decision === 'solved' ? 'Resolved' : mapDecisionToStatus(decision),
        decision,
        minutesFile,
        actorCnic: user?.cnic,
        budgetAmount: decision === 'budget' ? budgetAmount.trim() : '',
        budgetReason: decision === 'budget' ? budgetReason.trim() : '',
        moreWorkNeeded: decision === 'inprogress' ? moreWorkNeeded.trim() : '',
      });
      alert(isPresident && allowPresidentReview ? 'Complaint finalized successfully.' : 'Meeting decision saved successfully.');
      try {
        const rows = await getComplaintHistory(complaintId, user.cnic);
        setHistory(rows || []);
      } catch (_) {}
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      alert('Failed to save meeting decision: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#1f2937', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
          title="Back"
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: '#111827' }}>Committee Meeting</h2>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '22px', color: '#111827' }}>
          {committee?.ComplaintCategory || committee?.PanelName || 'Committee Complaint'}
        </h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#334155', lineHeight: 1.55 }}>
          {committee?.ComplaintDescription || 'No complaint details available.'}
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1f2937' }}>
          Complainant: {complainant}
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1f2937' }}>
          Type: {complaintType}
        </p>
        <p style={{ margin: 0, fontSize: '15px', color: '#1f2937' }}>
          Status: {statusLabel}
        </p>
      </div>

      <div style={{ marginTop: '14px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
        <h3 style={sectionTitleStyle}>History</h3>
        {historyLoading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Loading history...</p>
        ) : historyError ? (
          <p style={{ margin: 0, color: '#b91c1c' }}>{historyError}</p>
        ) : history.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No previous updates yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((item) => (
              <div
                key={`history-${item.Id}`}
                style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', backgroundColor: '#f8fafc' }}
              >
                <div style={{ fontSize: '12px', color: '#334155', marginBottom: '6px' }}>
                  {new Date(item.CreatedDate).toLocaleString()} | {item.ActionType || 'update'}
                </div>
                <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                  <strong>By:</strong> {item.ActorCNIC || 'System'} {item.ActorRole ? `(${item.ActorRole})` : ''}
                </div>
                {item.StatusSnapshot ? (
                  <div style={{ fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                    <strong>Status:</strong> {item.StatusSnapshot}
                  </div>
                ) : null}
                {item.RemarksSnapshot ? (
                  <div style={{ fontSize: '13px', color: '#1f2937', whiteSpace: 'pre-wrap', marginBottom: '4px' }}>
                    <strong>Remarks:</strong> {item.RemarksSnapshot}
                  </div>
                ) : null}
                {item.MinutesPathSnapshot ? (
                  <a
                    href={`http://localhost:3001${item.MinutesPathSnapshot}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline' }}
                  >
                    Open minutes PDF
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '14px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
        <h3 style={sectionTitleStyle}>Meeting Details</h3>

        <label
          style={{
            display: 'block',
            border: '1px dashed #94a3b8',
            borderRadius: '12px',
            padding: '12px 14px',
            textAlign: 'center',
            fontSize: '15px',
            color: '#475569',
            cursor: 'pointer',
            marginBottom: '12px',
            backgroundColor: '#f8fafc',
          }}
        >
          {minutesFile ? minutesFile.name : committee?.MeetingMinutesPath ? 'Replace Minutes PDF' : 'Upload Minutes PDF'}
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            disabled={isPresident && !allowPresidentReview}
            onChange={(e) => setMinutesFile(e.target.files?.[0] || null)}
          />
        </label>

        {isPresident && !allowPresidentReview ? (
          <p style={{ margin: '0 0 12px 0', color: '#991b1b', fontSize: '14px' }}>
            View only: President cannot make committee decisions.
          </p>
        ) : null}

        {committee?.MeetingMinutesPath && !minutesFile ? (
          <p style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '14px' }}>
            Existing minutes file is already saved.
          </p>
        ) : null}

        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={isPresident && !allowPresidentReview}
          placeholder="Enter meeting summary / minutes remarks"
          style={{
            ...inputStyle,
            minHeight: '120px',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginTop: '14px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px' }}>
        <h3 style={sectionTitleStyle}>Meeting Decision</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '15px', color: '#1f2937' }}>
          <input
            type="radio"
            name="meetingDecision"
            checked={decision === 'budget'}
            onChange={() => {
              setDecision('budget');
              setMoreWorkNeeded('');
            }}
            disabled={isPresident && !allowPresidentReview}
            style={{ width: '18px', height: '18px' }}
          />
          {decisionLabelMap.budget}
        </label>
        {decision === 'budget' ? (
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              disabled={isPresident && !allowPresidentReview}
              placeholder="How much budget is needed"
              style={{
                ...inputStyle,
                marginBottom: '10px',
              }}
            />
            <textarea
              value={budgetReason}
              onChange={(e) => setBudgetReason(e.target.value)}
              disabled={isPresident && !allowPresidentReview}
              placeholder="Why more budget is needed"
              style={{
                ...inputStyle,
                minHeight: '120px',
                resize: 'vertical',
              }}
            />
          </div>
        ) : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '15px', color: '#1f2937' }}>
          <input
            type="radio"
            name="meetingDecision"
            checked={decision === 'solved'}
            onChange={() => {
              setDecision('solved');
              setBudgetAmount('');
              setBudgetReason('');
              setMoreWorkNeeded('');
            }}
            disabled={isPresident && !allowPresidentReview}
            style={{ width: '18px', height: '18px' }}
          />
          {decisionLabelMap.solved}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#1f2937' }}>
          <input
            type="radio"
            name="meetingDecision"
            checked={decision === 'inprogress'}
            onChange={() => {
              setDecision('inprogress');
              setBudgetAmount('');
              setBudgetReason('');
            }}
            disabled={isPresident && !allowPresidentReview}
            style={{ width: '18px', height: '18px' }}
          />
          {decisionLabelMap.inprogress}
        </label>
        {decision === 'inprogress' ? (
          <textarea
            value={moreWorkNeeded}
            onChange={(e) => setMoreWorkNeeded(e.target.value)}
            disabled={isPresident && !allowPresidentReview}
            placeholder="What more work is needed"
            style={{
              ...inputStyle,
              minHeight: '120px',
              marginTop: '10px',
              resize: 'vertical',
            }}
          />
        ) : null}
      </div>

      {(!isPresident || allowPresidentReview) && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '14px',
            width: '100%',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 14px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : isPresident && allowPresidentReview ? 'Finalize Complaint' : 'Save Meeting Decision'}
        </button>
      )}
    </div>
  );
};

export default CommitteeMeetingScreen;
