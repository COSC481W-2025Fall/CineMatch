// components/Navigation.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

// Font Awesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faClapperboard,
  faCircleInfo,          
} from "@fortawesome/free-solid-svg-icons";
import { faUser } from "@fortawesome/free-regular-svg-icons";

export default function Navigation({ sidebarCollapsed, setSidebarCollapsed }) {
  const location = useLocation();

  const [listsOpen, setListsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
    setListsOpen(false);
  };

  const isHome = location.pathname === "/";
  const showSearchToggle =
      location.pathname === "/" ||
      location.pathname === "/watchlist" ||
      location.pathname === "/to-watch-list";
  const btnClass = (path) =>
      `nav-icon-btn desktop-only${location.pathname === path ? " active" : ""}`;

  return (
      <header className="navigation-top">
        {/* LEFT: desktop search text / mobile search + lists icons */}
        <div className="nav-left">
          {/* Desktop: SEARCH button (text) */}
          <Link
              to="/"
              className={`nav-icon-btn desktop-only${isHome ? " active" : ""}`}
          >
            SEARCH
          </Link>

          {/* Mobile: search icon -> open/close sidebar filters */}
          <button
              type="button"
              className="nav-icon-btn mobile-only"
              onClick={showSearchToggle ? toggleSidebar : undefined}
              aria-label="Toggle search filters"
              style={{ visibility: showSearchToggle ? "visible" : "hidden" }}
              disabled={!showSearchToggle}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </button>

          {/* Mobile: movie list icon -> Feed / WatchList / To-Watch */}
          <div className="nav-lists-wrapper mobile-only">
            <button
                type="button"
                className="nav-icon-btn"
                onClick={() => setListsOpen((o) => !o)}
                aria-label="Open lists menu"
            >
              <FontAwesomeIcon icon={faClapperboard} />
            </button>
            {listsOpen && (
                <div className="dropdown-menu">
                  <Link
                      to="/"
                      className="dropdown-item"
                      onClick={() => setListsOpen(false)}
                  >
                    Search (Main page)
                  </Link>
                  <Link
                      to="/feed"
                      className="dropdown-item"
                      onClick={() => setListsOpen(false)}
                  >
                    Feed
                  </Link>
                  <Link
                      to="/watchlist"
                      className="dropdown-item"
                      onClick={() => setListsOpen(false)}
                  >
                    WatchList
                  </Link>
                  <Link
                      to="/to-watch-list"
                      className="dropdown-item"
                      onClick={() => setListsOpen(false)}
                  >
                    To-Watch List
                  </Link>
                </div>
            )}
          </div>
        </div>

        {/* CENTER: logo */}
        <div className="logo">cineMatch</div>

        {/* RIGHT: desktop text buttons / mobile icons + avatar */}
        <div className="nav-right">
          {/* Desktop nav buttons */}

          <Link to="/feed" className={btnClass("/feed")}>
            FEED
          </Link>
          <Link to="/watchlist" className={btnClass("/watchlist")}>
            WATCHED LIST
          </Link>
          <Link to="/to-watch-list" className={btnClass("/to-watch-list")}>
            TO-WATCH LIST
          </Link>

          {/* Both: HELP icon button */}
          <Link
              to="/help"
              className="nav-icon-btn"
              aria-label="Help"
          >
            <FontAwesomeIcon icon={faCircleInfo} />
          </Link>

          {/* Account / avatar menu */}
          <div className="nav-account-wrapper">
            {/* Desktop: ACCOUNT text button */}
            <button
                type="button"
                className="nav-icon-btn desktop-only"
                onClick={() => setAccountOpen((o) => !o)}
            >
              ACCOUNT
            </button>

            {/* Mobile: user icon */}
            <button
                type="button"
                className="nav-avatar-btn mobile-only"
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Open account menu"
            >
              <div className="nav-avatar-circle">
                <FontAwesomeIcon icon={faUser} />
              </div>
            </button>

            {accountOpen && (
                <div className="dropdown-menu dropdown-menu-right">
                  <Link
                      to="/login"
                      className="dropdown-item"
                      onClick={() => setAccountOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                      to="/register"
                      className="dropdown-item"
                      onClick={() => setAccountOpen(false)}
                  >
                    Register
                  </Link>
                </div>
            )}
          </div>
        </div>
      </header>
  );
}
