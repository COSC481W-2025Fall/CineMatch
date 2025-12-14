// components/Navigation.jsx
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// Font Awesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faClapperboard,
  faCircleInfo,
    faBars // eric what awful IDE did you use that does this indentation i litterly cant indent by a single space on webstorm
} from "@fortawesome/free-solid-svg-icons";
import { faUser } from "@fortawesome/free-regular-svg-icons";
import NotificationModal from "./NotificationModal.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Navigation({ sidebarCollapsed, setSidebarCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [listsOpen, setListsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
    setListsOpen(false);
  };

  const isHome = location.pathname === "/";
  const btnClass = (path) =>
      `nav-icon-btn desktop-only${location.pathname === path ? " active" : ""}`;

  const showSearchToggle =
      location.pathname === "/" ||
      location.pathname === "/watchlist" ||
      location.pathname === "/to-watch-list";

  async function handleLogoutClick() {
    try {
      navigate("/", { replace: true });
      await logout();
      setNotificationMsg("You have been logged out.");
    } catch (e) {
      console.error("logout failed", e);
      setNotificationMsg(e?.message || "Failed to log out.");
    } finally {
      setAccountOpen(false);
    }
  }

  const displayName =
      user?.displayName || (user?.email ? user.email.split("@")[0] : "friend");

  return (
      <>
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
                <FontAwesomeIcon icon={faBars} />
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
                      Watched Movies
                    </Link>
                    <Link
                        to="/to-watch-list"
                        className="dropdown-item"
                        onClick={() => setListsOpen(false)}
                    >
                      Watch Later
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
              WATCHED MOVIES
            </Link>
            <Link to="/to-watch-list" className={btnClass("/to-watch-list")}>
              WATCH LATER
            </Link>

            {/* Both: HELP icon button */}
            <Link to="/help" className="nav-icon-btn" aria-label="Help">
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
                    {user ? (
                        <>
                          <div className="dropdown-item disabled">
                            Welcome,&nbsp;{displayName}
                          </div>
                          <button
                              type="button"
                              className="dropdown-item nav-auth-logout"
                              onClick={handleLogoutClick}
                          >
                            Logout
                          </button>
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                  </div>
              )}
            </div>
          </div>
        </header>

        {notificationMsg && (
            <NotificationModal
                message={notificationMsg}
                onClose={() => setNotificationMsg("")}
            />
        )}
      </>
  );
}
