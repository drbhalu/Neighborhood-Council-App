import React, { useEffect } from 'react';
import logo from '../assets/logo.png';

const Splash = ({ onSplashComplete }) => {
  useEffect(() => {
    // Show splash screen for 3 seconds then transition to login
    const timer = setTimeout(() => {
      onSplashComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onSplashComplete]);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      margin: 0,
      padding: 0
    }}>
      <img 
        src={logo} 
        alt="Logo" 
        style={{ 
          height: '200px', 
          width: 'auto'
        }} 
      />
    </div>
  );
};

export default Splash;
