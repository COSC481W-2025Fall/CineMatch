
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function VerifyPending() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);//<-- / Creating a URLSearchParams object for easy parse query parameters from the URL search
    const email = params.get("email") || "";//Retrieve the value of the 'email' query parameter

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Confirm your email</h1>
                <p>
                    We&apos;ve sent a verification link
                    {email ? <> to <strong>{email}</strong></> : ""}.
                </p>
                <p>
                    Please check your inbox (and spam folder). Once you confirm, you can{" "}
                    <Link to="/login">log in</Link>.
                </p>
                <p style={{ marginTop: 16, fontSize: "0.9rem" }}>
                    Didn&apos;t get anything? You can close this page and use &quot;Resend verification&quot;
                    from the login screen later, or contact support.
                </p>
                <div style={{ marginTop: 24 }}>
                    <Link to="/" className="go-btn">Back to search</Link>
                </div>
            </div>
        </div>
    );
}