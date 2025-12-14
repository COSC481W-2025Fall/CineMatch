// src/auth/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "./api.js"; // use the helper

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError("");

        const addr = String(email || "").trim().toLowerCase();
        if (!addr) return setError("Please enter your email.");

        try {
            setBusy(true);
            // Always returns 200 (even if email not found / not verified) to prevent enumeration
            await forgotPassword(addr);
            setDone(true);
        } catch (err) {
            console.error("forgotPassword error:", err);
            setError(err?.message || "Something went wrong. Try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="auth-page"
            style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
        >
            <form className="auth-card" onSubmit={onSubmit} noValidate>
                <h1>Forgot password</h1>

                {done ? (
                    <div className="auth-success">
                        If an account exists for that email, we’ve sent a reset link.
                    </div>
                ) : (
                    <>
                        {error && <div className="auth-error">{error}</div>}

                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={busy}
                            placeholder="you@example.com"
                        />

                        <button className="go-btn" type="submit" disabled={busy}>
                            {busy ? "Sending…" : "Send reset link"}
                        </button>
                    </>
                )}

                <div className="auth-alt">
                    <Link to="/login">Back to login</Link>
                </div>
            </form>
        </div>
    );
}
