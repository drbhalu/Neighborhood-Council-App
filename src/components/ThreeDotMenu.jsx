import React, { useState, useRef, useEffect } from 'react';

const ThreeDotMenu = ({ onEditProfile, onRequestNHC, onChangeCouncil }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      {/* THE 3-DOT BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'none', border: 'none', fontSize: '24px', 
          cursor: 'pointer', padding: '5px' 
        }}
      >
        ⋮
      </button>

      {/* THE DROPDOWN MENU (Shows 3 Buttons) */}
      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: '30px',
          backgroundColor: 'white', border: '1px solid #ddd',
          borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 1000, width: '180px'
        }}>
          {/* BUTTON 1: EDIT PROFILE */}
          <div 
            onClick={() => { onEditProfile(); setIsOpen(false); }}
            style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '14px' }}
          >
            Edit Profile
          </div>
          
          {/* BUTTON 2: REQUEST NHC */}
          <div 
            onClick={() => { onRequestNHC(); setIsOpen(false); }}
            style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '14px' }}
          >
            Request NHC
          </div>
          
          {/* BUTTON 3: CHANGE COUNCIL */}
          <div 
            onClick={() => { onChangeCouncil(); setIsOpen(false); }}
            style={{ padding: '10px 15px', cursor: 'pointer', fontSize: '14px' }}
          >
            Change Council
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDotMenu;