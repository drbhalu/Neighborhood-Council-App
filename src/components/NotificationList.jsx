import React, { useState, useEffect } from 'react';
import { getNotifications } from '../api';

const NotificationList = ({ user, onClose }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getNotifications(user.cnic);
        setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };
    if(user && user.cnic) fetchNotifications();
  }, [user]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{ 
          backgroundColor: 'white', padding: '20px', borderRadius: '8px', 
          width: '90%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' 
        }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3>Notifications</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {notifications.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No new notifications.</p>
        ) : (
          notifications.map((note) => (
            <div key={note.Id} style={{ 
                borderBottom: '1px solid #eee', padding: '10px 0'
              }}>
              <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>Admin Message:</p>
              <p style={{ margin: '5px 0 0 0' }}>{note.Message}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>
                {new Date(note.CreatedDate).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationList;