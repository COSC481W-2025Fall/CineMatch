
import React from "react";
import { Link } from "react-router-dom";//imports

export default function VerifySuccess() {//component
    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Email confirmed!</h1>
                <p>Your email has been successfully verified.</p>
                <p>You can now log in and start using cineMatch on any device.</p>
                <div style={{ marginTop: 24 }}>
                    <Link to="/login" className="go-btn">
                        Go to login
                    </Link>
                </div>
            </div>
        </div>
    );
}
