import React, { useState, useEffect } from 'react';
import SignUp from './components/SignUp';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import CreateNHC from './components/CreateNHC';
import Splash from './components/Splash';
import SendNotification from './components/SendNotification';
import RequestsList from './components/RequestsList';
import Elections from './components/Elections';
import { getNHCList, createNHC, sendNotification } from './api';
import MemberDashboard from './components/MemberDashboard';
import AllUsers from './components/AllUsers';
import EditUser from './components/EditUser';

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
  const handleLoginSuccess = (userData) => {
    if (userData.role && userData.role.toLowerCase() === 'admin') {
      setCurrentView('admin');
    } else {
      // Only set user state if they are a Member
      setCurrentUser(userData);
      setCurrentView('member');
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

      {currentView === 'edit-user' && editingUser && (
        <EditUser user={editingUser} onBack={switchToAdmin} />
      )}
      
      {/* FIX: Added && currentUser check to prevent crash */}
      {currentView === 'member' && currentUser && (
        <MemberDashboard 
          user={currentUser} 
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}

export default App;