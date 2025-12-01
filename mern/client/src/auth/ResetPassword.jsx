// src/auth/ResetPassword.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // "" for same-origin

export default function ResetPassword() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();

    // Read token & user from query- guarded against null
    const token = useMemo(() => sp.get("token") || "", [sp]);
    const u = useMemo(() => sp.get("u") || "", [sp]);

    const [pw, setPw] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const linkInvalid = !token || !u;

    async function onSubmit(e) {
        e.preventDefault();
        setError("");

        if (linkInvalid) return setError("Invalid or expired reset link.");
        if (!pw) return setError("Please enter a new password.");
        if (pw.length < 8) return setError("Password must be at least 8 characters.");
        if (pw !== confirm) return setError("Passwords do not match.");

        try {
            setBusy(true);
            const res = await fetch(`${API_BASE}/auth/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token, u, password: pw }),
            });
            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try {
                    const data = await res.json();
                    if (data?.error) msg = data.error;
                } catch { /* empty */ }
                throw new Error(msg);
            }

            setDone(true);
            setTimeout(() => navigate("/login", { replace: true }), 1000);
        } catch (err) {
            setError(err?.message || "Reset failed. Request a new link and try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={onSubmit} noValidate>
                <h1>Reset password</h1>

                {linkInvalid && (
                    <div className="auth-error" style={{ marginBottom: 12 }}>
                        This reset link is invalid. Request a new one on the{" "}
                        <Link to="/forgot-password">Forgot Password</Link> page.
                    </div>
                )}

                {done ? (
                    <div className="auth-success">Password updated. Redirecting to login…</div>
                ) : (
                    <>
                        {error && <div className="auth-error">{error}</div>}

                        <label htmlFor="password">New password</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            disabled={busy || linkInvalid}
                            placeholder="••••••••"
                        />

                        <label htmlFor="confirm">Confirm password</label>
                        <input
                            id="confirm"
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            disabled={busy || linkInvalid}
                            placeholder="••••••••"
                        />

                        <button className="go-btn" type="submit" disabled={busy || linkInvalid}>
                            {busy ? "Updating…" : "Update password"}
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
