// src/components/VerifySuccess.jsx
import React from "react";
import { Link } from "react-router-dom";  //imports

export default function VerifySuccess() { //component
    return (
        <div className="auth-page">
            <div className="auth-card" style={{ minHeight: "10vh", display: "grid", placeItems: "center" }}>
                <h1>Email confirmed!</h1>
                <p>Your email has been successfully verified.</p>
                <p>You can now log in and start using CineMatch online on any device!</p>
                <div style={{ marginTop: 24 }}>
                    <Link to="/login" className="go-btn">
                        Go to login
                    </Link>
                </div>
            </div>
        </div>
    );
}