// src/components/Login.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, status, login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    // If already logged in, bounce them to the default
    useEffect(() => {
        if (status === "auth" && user) {
            const dest = location.state?.from?.pathname || "/";
            navigate(dest, { replace: true });
        }
    }, [status, user, location, navigate]);


    async function onSubmit(e) {
        e.preventDefault();
        setError("");

        if (!email.trim() || !password) {
            setError("Please enter email and password.");
            return;
        }

        setBusy(true);
        try {
            await login({ email: email.trim(), password });
            const dest = location.state?.from?.pathname || "/";
            navigate(dest, { replace: true });
        } catch (err) {
            setError(err?.message || "Login failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-page">
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
                <form
                    className="auth-card"
                    onSubmit={onSubmit}
                    style={{
                        width: 360,
                        background: "#222",
                        color: "#eee",
                        padding: 24,
                        borderRadius: 12,
                        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                    }}
                >
                    <h1>Log in</h1>

                    {error && <div className="auth-error">{error}</div>}

                    <label
                        style={{ display: "block", fontSize: 12, opacity: 0.8 }}
                        htmlFor="email"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                        placeholder="your-email@example.com"
                        style={{
                            width: "100%",
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #444",
                            marginBottom: 12,
                        }}
                    />

                    <label htmlFor="password">Password</label>
                    <div className="pw-wrap" style={{ position: "relative", marginBottom: 12 }}>
                        <input
                            id="password"
                            style={{
                                width: "100%",
                                padding: "10px 40px 10px 10px",
                                borderRadius: 8,
                                border: "1px solid #444",
                            }}
                            type={showPw ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={busy}
                            placeholder="Your password"
                        />
                        <button
                            type="button"
                            className="pw-toggle"
                            onClick={() => setShowPw((s) => !s)}
                            aria-label={showPw ? "Hide password" : "Show password"}
                            disabled={busy}
                            style={{
                                position: "absolute",
                                right: 8,
                                top: 6,
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: "#333",
                                color: "#ddd",
                                border: "1px solid #444",
                                cursor: "pointer",
                            }}
                        >
                            {showPw ? "Hide" : "Show"}
                        </button>
                    </div>

                    <button
                        className="go-btn"
                        type="submit"
                        style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 8,
                            background: "linear-gradient(45deg,#ffcc00,#d8a100)",
                            border: "none",
                            fontWeight: 700,
                            cursor: "pointer",
                            opacity: busy ? 0.7 : 1,
                        }}
                        disabled={busy}
                    >
                        {busy ? "Signing in…" : "Sign in"}
                    </button>

                    <div className="auth-alt">
                        No account yet? <Link to="/register">Create an account</Link>
                    </div>
                    <div className="auth-alt">
                        Forgot password?{" "}
                        <Link to="/forgot-password">Reset password</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
