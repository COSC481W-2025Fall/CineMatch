import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Help.css";
import Navigation from "./Navigation.jsx";

export default function Help() {
    // Help button state
    const [activeButton, setActiveButton] = useState(null);


    // Top navigation menu states
    const [searchMenuOpen, setSearchMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const activeStyle = {
        background: "linear-gradient(45deg,#f7e135,#cc8800)"
    }

    function renderInfo() {
        switch (activeButton) {
            case "search":
                return (
                
                    <p className="help-info">
                        To find exactly what you're looking for, use the search page to
                        filter movies by actor, genre, year, or rating. Click a title to
                        see details or add it to your lists.
                    </p>
                   
                );
            case "watchlist":
                return (
                    <p className="help-info">
                        The Watched List keeps track of movies you've seen and helps
                        personalize your recommendations.
                    </p>
                );
            case "to-watch":
                return (
                    <p className="help-info">
                        Save movies you plan to watch later in the To-Watch List.
                    </p>
                );
            case "login/signup":
                return (
                    <p className="help-info">
                        To access your feed and lists, you must log in or sign up. Your
                        lists sync across devices.
                    </p>
                );

            default:
                return null;
        }
    }
    return (
        <div id="main-wrapper">
            {/* ================= TOP NAVIGATION ================= */}
            <Navigation
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
            />


            {/* ================= SEARCH MENU ================= */}
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
                        <Link
                            to="/feed"
                            className="menu-button menu-button-red"
                            onClick={() => setSearchMenuOpen(false)}
                        >
                            FEED
                        </Link>

                        <Link
                            to="/watchlist"
                            className="menu-button menu-button-red"
                            onClick={() => setSearchMenuOpen(false)}
                        >
                            WATCHED LIST
                        </Link>

                        <Link
                            to="/to-watch-list"
                            className="menu-button menu-button-red"
                            onClick={() => setSearchMenuOpen(false)}
                        >
                            TO-WATCH LIST
                        </Link>

                        <div className="menu-logo">cinematch</div>
                    </div>
                </div>
            )}

            {/* ================= USER MENU ================= */}
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
                        <button
                            className="menu-button menu-button-red"
                            onClick={() => {
                                console.log("Login");
                                setUserMenuOpen(false);
                            }}
                        >
                            LOGIN
                        </button>

                        <button
                            className="menu-button menu-button-red"
                            onClick={() => {
                                console.log("Register");
                                setUserMenuOpen(false);
                            }}
                        >
                            REGISTER
                        </button>

                        <button
                            className="menu-button menu-button-red"
                            onClick={() => {
                                console.log("Personalization");
                                setUserMenuOpen(false);
                            }}
                        >
                            PERSONALIZATION
                        </button>

                        <div className="menu-logo">cinematch</div>
                    </div>
                </div>
            )}

            {/* ================= HELP CONTENT ================= */}
            <div id="help-container">
                <div id="help-body">
                    <button
                        onClick={() => setActiveButton("search")}
                        style={activeButton === "search" ? activeStyle : undefined}
                        className="help-button"
                    >
                        Search
                    </button>

                    <button
                        onClick={() => setActiveButton("watchlist")}
                        style={activeButton === "watchlist" ? activeStyle : undefined}
                        className="help-button"
                    >
                        Watchlist
                    </button>

                    <button
                        onClick={() => setActiveButton("to-watch")}
                        style={activeButton === "to-watch" ? activeStyle : undefined}
                        className="help-button"
                    >
                        To-Watch List
                    </button>

                    <button
                        onClick={() => setActiveButton("login/signup")}
                        style={activeButton === "login/signup" ? activeStyle : undefined}
                        className="help-button"
                    >
                        Logging In / Signing Up
                    </button>
                </div>

                <div id="info-box">{renderInfo()}</div>
            </div>
        </div>
    );
}

