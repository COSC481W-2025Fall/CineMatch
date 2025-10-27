import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Help.css";

export default function Help() {
    {/* Theses are for the buttons useState when pressed and the style */}
    const [activeButton, setActiveButton] = useState(null);

    const activeStyle = {
        background: "linear-gradient(45deg,#f7e135,#cc8800)",
    };

    {/* If specifc button is press give one of these statemates  */}
    function renderInfo() {
        switch (activeButton) {
            case "search":
                return <p className="help-info" >To find exactly what you're looking for,
                    use the search page to filter movies by fields like actor, genre, year, or rating (between 0 and 5).
                    Once you find a movie, simply click on its title to see a full description. The pop-up also gives
                    you the option to save it to your personal Watched List or To-Watch List.</p>;
            case "feed":
                return <p className="help-info">The main feed provides personalized movie recommendations. These
                    suggestions are generated based on the current contents of your To-Watch List. To start receiving
                    personalized recommendations, you must first add movies to your
                    list by clicking on a movie on the search page.</p>;
            case "watchlist":
                return <p className="help-info">Your Watched List helps you keep a running
                    history of all the films you have watched,
                    ensuring you never forget which ones you've seen.</p>;
            case "to-watch":
                return <p className="help-info" >Use the To-Watch List as a bookmark for all the movies you want to see.</p>;
            case "Uploading/Downloading Json file":
                return <p className="help-info">The data for both your Watched List and To-Watch List is stored locally in a JSON file.
                    This file is essential because your main feed uses it to generate personalized movie recommendations.To ensure you never lose your progress and can
                    continue getting recommendations
                    on future visits, you must download your JSON file before leaving the site. If you ever need to restore your
                    saved lists, simply use the Upload feature to load the saved JSON file from your computer. </p>
            default:
                return null;
        }
    }

    return (
        <>
            <div className="navigation-top">
                <button className="navigation-button">
                    <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
                        SEARCH
                    </Link>
                </button>
                <div className="logo">cineMatch</div>
                <button className="navigation-button active">HELP</button>       {/* Same navigation bar */}
                <button className="navigation-button">
                    <Link
                    to="/feed"
                    style={{ color: "inherit", textDecoration: "none" }}>       {/* routes to the other pages */}
                    FEED
                </Link></button>
                <button className="navigation-button">
                    <Link
                        to="/watchlist"
                        style={{ color: "inherit", textDecoration: "none" }}>       {/* routes to the other pages */}
                        WATCHED LIST
                    </Link>
                </button>
                <button className="navigation-button">
                    <Link
                        to="/to-watch-list"
                        style={{ color: "inherit", textDecoration: "none" }}>
                        TO-WATCH LIST
                    </Link>
                </button>
            </div>

            <div className="help-header">
                <h2>Welcome to the Help Center!</h2>
                <p>Need a hand? Click a button below to get answers, support, and tips.</p>      {/* Header div */}
            </div>

            <div id="help-container">
                <div id="help-body">{/* If button is click set the ActiveButton (useState) to search and when actived from the click -> style the button */}
                    <button
                        onClick={() => setActiveButton("search")}
                        style={activeButton === "search" ? activeStyle : undefined}
                        className="help-button">
                        Search
                    </button>
                    <button
                        onClick={() => setActiveButton("feed")}
                        style={activeButton === "feed" ? activeStyle : undefined}
                        className="help-button">
                        Feed
                    </button>
                    <button
                        onClick={() => setActiveButton("watchlist")}
                        style={activeButton === "watchlist" ? activeStyle : undefined}
                        className="help-button">
                        Watchlist
                    </button>
                    <button
                        onClick={() => setActiveButton("to-watch")}
                        style={activeButton === "to-watch" ? activeStyle : undefined}
                        className="help-button">
                        To-Watch List
                    </button>
                    <button
                        onClick={() => setActiveButton("Uploading/Downloading Json file")}
                        style={activeButton === "Uploading/Downloading Json file" ? activeStyle : undefined}
                        className="help-button">
                        Uploading/Downloading Json file
                    </button>
                </div>
            </div>

            <div id="info-box">{renderInfo()}</div>{/*The function for when a button is pressed */}
        </>
    );
}
