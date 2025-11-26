// src/components/Navigation.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navigation({ sidebarCollapsed, setSidebarCollapsed }) {
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <>
      <nav className="navigation-top">
        <div className="nav-left">
          <button 
            className={`hamburger-menu ${!sidebarCollapsed ? 'open' : ''}`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          <button 
            className="nav-icon-btn"
            onClick={() => setSearchMenuOpen(true)}
            aria-label="Open search menu"
          >
            🔍
          </button>
        </div>

        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="logo">cinematch</div>
        </Link>

        <div className="nav-right">
          <Link to="/help" className="nav-icon-btn" aria-label="Help">
            ❓
          </Link>

          <button 
            className="nav-icon-btn"
            onClick={() => setUserMenuOpen(true)}
            aria-label="Open user menu"
          >
            👤
          </button>
        </div>
      </nav>

      {/* SEARCH MENU */}
      {searchMenuOpen && (
        <div className="fullscreen-menu">
          <button 
            className="menu-close-x"
            onClick={() => setSearchMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          
          <div className="menu-buttons">
            <Link to="/feed" className="menu-button menu-button-red" onClick={() => setSearchMenuOpen(false)}>
              FEED
            </Link>
            
            <Link to="/watchlist" className="menu-button menu-button-red" onClick={() => setSearchMenuOpen(false)}>
              WATCHED LIST
            </Link>
            
            <Link to="/to-watch-list" className="menu-button menu-button-red" onClick={() => setSearchMenuOpen(false)}>
              TO-WATCH LIST
            </Link>
            
            <div className="menu-logo">cinematch</div>
          </div>
        </div>
      )}

      {/* USER MENU */}
      {userMenuOpen && (
        <div className="fullscreen-menu">
          <button 
            className="menu-close-x"
            onClick={() => setUserMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          
          <div className="menu-buttons">
            <button className="menu-button menu-button-red" onClick={() => { console.log('Login'); setUserMenuOpen(false); }}>
              LOGIN
            </button>
            
            <button className="menu-button menu-button-red" onClick={() => { console.log('Register'); setUserMenuOpen(false); }}>
              REGISTER
            </button>
            
            <button className="menu-button menu-button-red" onClick={() => { console.log('Personalization'); setUserMenuOpen(false); }}>
              PERSONALIZATION
            </button>
            
            <div className="menu-logo">cinematch</div>
          </div>
        </div>
      )}
    </>
  );
}