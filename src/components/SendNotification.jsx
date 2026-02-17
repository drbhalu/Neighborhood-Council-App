import React, { useState } from 'react';
import './AdminDashboard.css';

const SendNotification = ({ onBack, onSend }) => {
  const [cnic, setCnic] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cnic || !message) {
      alert("Please enter CNIC and Message");
      return;
    }
    onSend({ recipientCnic: cnic, message });
  };

  return (
    <div className="admin-dashboard-container">
      <div className="simple-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>SEND NOTIFICATION</h2>
      </div>

      <div className="signup-content">
        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-group">
            <label>Recipient CNIC</label>
            <input 
              type="text" 
              value={cnic} 
              onChange={(e) => setCnic(e.target.value)} 
              placeholder="Enter User CNIC" 
              className="nhc-input" 
              style={{ width: '100%', padding: '10px' }} 
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              placeholder="Type your message here..." 
              rows="4"
              style={{ width: '100%', padding: '10px' }}
            />
          </div>

          <button type="submit" className="submit-btn">Send Notification</button>
        </form>
      </div>
    </div>
  );
};

export default SendNotification;