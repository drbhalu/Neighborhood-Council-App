import React, { useState, useEffect } from 'react';
import SignUp from './components/SignUp';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import CreateNHC from './components/CreateNHC';
import Splash from './components/Splash';
import SendNotification from './components/SendNotification';
import RequestsList from './components/RequestsList';
import Elections from './components/Elections';
import { getNHCList, createNHC, sendNotification, sendRequest, getUserRoleInNHC } from './api';
import MemberDashboard from './components/MemberDashboard';
import AllUsers from './components/AllUsers';
import EditUser from './components/EditUser';
import ChooseNHC from './components/ChooseNHC';
import RequestNHC from './components/RequestNHC';
import AdminComplaints from './components/AdminComplaints';


function App() {
  const [currentView, setCurrentView] = useState('splash');
  const [nhcList, setNhcList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    const loadZones = async () => {
      try {
        const data = await getNHCList();
        setNhcList(data);
      } catch (err) {
        console.error("Failed to load NHCs", err);
      }
    };
    loadZones();
  }, []);

  // FIX: Check Role FIRST
  const handleLoginSuccess = async (userData) => {
    if (userData.role && userData.role.toLowerCase() === 'admin') {
      setCurrentUser(userData);
      setCurrentView('admin');
    } else {
      // prepare nhc choices for members who belong to more than one council
      let options = [];
      if (userData.nhcCodes && Array.isArray(userData.nhcCodes)) {
        options = [...userData.nhcCodes];
      } else if (userData.nhcCode && typeof userData.nhcCode === 'string') {
        options = userData.nhcCode
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      const member = { ...userData, nhcOptions: options };
      setCurrentUser(member);

      // if user has multiple councils, prompt for selection first
      if (options.length > 1) {
        setCurrentView('choose-nhc');
      } else if (options.length === 1) {
        // Single NHC: fetch and verify NHC-specific role before showing dashboard
        try {
          const roleResponse = await getUserRoleInNHC(userData.cnic, options[0]);
          const nhcSpecificRole = roleResponse.role;
          
          // Fetch nhcId for this NHC
          let nhcId = null;
          try {
            const nhcListData = await getNHCList();
            const nhcRecord = (nhcListData || []).find(n => n.Name === options[0] || n.Code === options[0]);
            if (nhcRecord) {
              nhcId = nhcRecord.Id;
            }
          } catch (nhcErr) {
            console.error('Error fetching NHC ID:', nhcErr);
          }
          
          setCurrentUser(prev => ({
            ...prev,
            nhcCode: options[0],
            nhcId: nhcId,  // Set nhcId here
            role: nhcSpecificRole  // Use NHC-specific role, NOT global role
          }));
          setCurrentView('member');
        } catch (err) {
          console.error('Error fetching NHC role on login:', err);
          // Fallback: use the default NHC anyway
          setCurrentUser(prev => ({
            ...prev,
            nhcCode: options[0],
            nhcId: userData.nhcId  // Use the nhcId from login response if available
          }));
          setCurrentView('member');
        }
      } else {
        // No NHC assigned yet
        setCurrentView('member');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
  };
  
  const switchToSignup = () => setCurrentView('signup');
  const switchToLogin = () => setCurrentView('login');
  const switchToAdmin = () => setCurrentView('admin');

  const handleCreateNHC = async (newNHC) => {
    try {
      await createNHC(newNHC);
      alert(`NHC "${newNHC.name}" Saved to Database!`);
      const updatedData = await getNHCList();
      setNhcList(updatedData);
      switchToAdmin();
    } catch (error) {
      alert("Error creating NHC");
    }
  };

  const handleNotify = async (notificationData) => {
    try {
      await sendNotification(notificationData);
      alert("Notification Sent Successfully!");
      switchToAdmin();
    } catch (error) {
      alert("Error sending notification");
    }
  };

  const handleViewRequests = () => {
    setCurrentView('all-requests');
  };

  const handleViewAllUsers = () => {
    setCurrentView('all-users');
  };

  const handleViewElections = () => {
    setCurrentView('elections');
  };

  const handleViewComplaints = () => {
    setCurrentView('admin-complaints');
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setCurrentView('edit-user');
  };

  return (
    <>
      {currentView === 'splash' && (
        <Splash onSplashComplete={() => setCurrentView('login')} />
      )}

      {currentView === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} onSwitchToSignup={switchToSignup} />
      )}

      {currentView === 'signup' && (
        <SignUp 
          onSwitchToLogin={switchToLogin} 
          onSignupSuccess={() => { alert("Signup Success"); switchToLogin(); }} 
          nhcList={nhcList}
        />
      )}

      {currentView === 'admin' && (
        <AdminDashboard 
          onLogout={handleLogout} 
          onCreateNHC={() => setCurrentView('create-nhc')} 
          onNotify={() => setCurrentView('send-notification')}
          onViewRequests={handleViewRequests}
          onViewAllUsers={handleViewAllUsers}
          onViewElections={handleViewElections}
          onViewComplaints={handleViewComplaints}
        />
      )}

      {currentView === 'create-nhc' && (
        <CreateNHC onCreateNHC={handleCreateNHC} onBack={switchToAdmin} />
      )}
      
      {currentView === 'send-notification' && (
        <SendNotification 
          onBack={switchToAdmin} 
          onSend={handleNotify} 
        />
      )}
      {currentView === 'all-requests' && (
        <RequestsList onBack={switchToAdmin} nhcList={nhcList} />
      )}

      {currentView === 'all-users' && (
        <AllUsers onBack={switchToAdmin} onEditUser={handleEditUser} />
      )}

      {currentView === 'elections' && (
        <Elections onBack={switchToAdmin} />
      )}

      {currentView === 'admin-complaints' && currentUser && (
        <AdminComplaints user={currentUser} onClose={switchToAdmin} />
      )}

      {currentView === 'edit-user' && editingUser && (
        <EditUser user={editingUser} onBack={switchToAdmin} />
      )}
      
      {/* FIX: Added && currentUser check to prevent crash */}
      {currentView === 'choose-nhc' && currentUser && (
        <ChooseNHC
          user={currentUser}
          onSelect={async (code) => {
            try {
              // Fetch NHC-specific role from database
              const roleResponse = await getUserRoleInNHC(currentUser.cnic, code);
              const nhcSpecificRole = roleResponse.role; // e.g., 'President' or 'Member'
              
              // Fetch nhcId for this NHC code
              let nhcIdForCode = null;
              try {
                const nhcListData = await getNHCList();
                const nhcRecord = (nhcListData || []).find(n => n.Name === code || n.Code === code);
                if (nhcRecord) {
                  nhcIdForCode = nhcRecord.Id;
                }
              } catch (nhcErr) {
                console.error('Error fetching NHC list to get ID:', nhcErr);
              }
              
              // Update user with new NHC code, nhcId AND new role
              setCurrentUser({ 
                ...currentUser, 
                nhcCode: code,
                nhcId: nhcIdForCode,  // Update nhcId for this NHC
                role: nhcSpecificRole  // Update role for this NHC
              });
              setCurrentView('member');
            } catch (err) {
              console.error('Error fetching role for NHC:', err);
              alert('Failed to load NHC role. Please try again.');
            }
          }}
          onCancel={handleLogout}
        />
      )}

      {currentView === 'request-nhc' && currentUser && (
        <RequestNHC
          user={currentUser}
          onSubmit={async (location, address, reason) => {
            try {
              await sendRequest({
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                cnic: currentUser.cnic,
                requestType: 'Create NHC',
                message: `📍 Location: ${location}\n\n📮 Address: ${address}\n\n${reason}`,
                location: location || ''
              });
              alert('Request sent to Admin!');
              setCurrentView('member');
            } catch (err) {
              console.error(err);
              alert('Failed to send request');
            }
          }}
          onCancel={() => setCurrentView('member')}
        />
      )}

      {currentView === 'member' && currentUser && (
        <MemberDashboard 
          user={currentUser} 
          onLogout={handleLogout} 
          onRequestNHCPage={() => setCurrentView('request-nhc')}
          onBackToChooseNHC={() => setCurrentView('choose-nhc')}
        />
      )}
    </>
  );
}

export default App;