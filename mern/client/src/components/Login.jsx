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

    // Shared styles
    const inputStyle = {
        width: "100%",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid #444",
        background: "#333",
        color: "#fff",
        fontSize: "1rem",
        marginBottom: "16px",
        outline: "none",
        transition: "border-color 0.2s",
    };

    return (
        <div className="auth-page">
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "20px" }}>
                <form
                    className="auth-card"
                    onSubmit={onSubmit}
                    style={{
                        width: "100%",
                        maxWidth: "400px",
                        background: "#222",
                        color: "#eee",
                        padding: "32px",
                        borderRadius: "16px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        border: "1px solid #333",
                    }}
                >
                    {/* Header with Back Button */}
                    <div style={{ marginBottom: "24px" }}>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#888",
                                fontSize: "0.9rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "0 0 12px 0",
                                fontWeight: "600",
                                transition: "color 0.2s",
                            }}
                            onMouseOver={(e) => (e.target.style.color = "#fff")}
                            onMouseOut={(e) => (e.target.style.color = "#888")}
                            aria-label="Go back"
                        >
                            &larr; Back
                        </button>
                        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "700", color: "#f7e135" }}>
                            Log in
                        </h1>
                    </div>

                    {error && (
                        <div className="auth-error" style={{
                            background: "rgba(255, 68, 68, 0.1)",
                            border: "1px solid rgba(255, 68, 68, 0.2)",
                            color: "#ff6666",
                            padding: "12px",
                            borderRadius: "8px",
                            marginBottom: "20px",
                            fontSize: "0.9rem"
                        }}>
                            {error}
                        </div>
                    )}

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="email">
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
                        style={inputStyle}
                    />

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="password">
                        Password
                    </label>
                    <div style={{ position: "relative", marginBottom: "8px" }}>
                        <input
                            id="password"
                            style={{ ...inputStyle, paddingRight: "40px", marginBottom: "0" }}
                            type={showPw ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={busy}
                            placeholder="Your password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            aria-label={showPw ? "Hide password" : "Show password"}
                            disabled={busy}
                            style={{
                                position: "absolute",
                                right: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "transparent",
                                border: "none",
                                color: "#888",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: "600",
                            }}
                        >
                            {showPw ? "Hide" : "Show"}
                        </button>
                    </div>

                    <div style={{ textAlign: "right", marginBottom: "24px" }}>
                        <Link
                            to="/forgot-password"
                            style={{ fontSize: "0.85rem", color: "#888", textDecoration: "none" }}
                            onMouseOver={(e) => (e.target.style.color = "#ccc")}
                            onMouseOut={(e) => (e.target.style.color = "#888")}
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        className="go-btn"
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "8px",
                            background: "linear-gradient(45deg,#f7e135,#cc8800)",
                            border: "none",
                            fontWeight: "800",
                            fontSize: "1rem",
                            cursor: "pointer",
                            opacity: busy ? 0.7 : 1,
                            color: "#111",
                            marginBottom: "24px",
                            boxShadow: "0 4px 12px rgba(247, 225, 53, 0.3)",
                        }}
                        disabled={busy}
                    >
                        {busy ? "Signing in…" : "Sign in"}
                    </button>

                    <div style={{ textAlign: "center", fontSize: "0.9rem", color: "#aaa" }}>
                        No account yet?{" "}
                        <Link
                            to="/register"
                            style={{ color: "#f7e135", textDecoration: "none", fontWeight: "600" }}
                        >
                            Create an account
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}