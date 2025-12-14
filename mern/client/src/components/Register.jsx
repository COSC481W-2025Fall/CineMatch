// src/components/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../auth/api.js"; // api.js helper

export default function Register() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirm: "",
    });

    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function onChange(e) {
        const { id, value } = e.target;
        setForm((f) => ({ ...f, [id]: value }));
    }

    async function onSubmit(e) {
        e.preventDefault();
        setError("");

        if (!form.name.trim()) return setError("Please enter your name.");
        if (!form.email.trim()) return setError("Please enter an email.");
        if (!form.password) return setError("Please enter a password.");
        if (form.password.length < 8) return setError("Password must be at least 8 characters.");
        if (form.password !== form.confirm) return setError("Passwords do not match.");

        try {
            setBusy(true);
            await register({
                displayName: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
            });

            navigate(
                `/verify-pending?email=${encodeURIComponent(form.email.trim())}`,
                { replace: true }
            );
        } catch (err) {
            setError(err?.message || "Registration failed. Please try again.");
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
                            Create account
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

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="name">
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={form.name}
                        onChange={onChange}
                        disabled={busy}
                        placeholder="Your name"
                        style={inputStyle}
                    />

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={onChange}
                        disabled={busy}
                        placeholder="your-email@example.com"
                        style={inputStyle}
                    />

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="password">
                        Password
                    </label>
                    <div style={{ position: "relative", marginBottom: "16px" }}>
                        <input
                            id="password"
                            style={{ ...inputStyle, paddingRight: "40px", marginBottom: "0" }}
                            type={showPw ? "text" : "password"}
                            autoComplete="new-password"
                            value={form.password}
                            onChange={onChange}
                            disabled={busy}
                            placeholder="Min. 8 characters"
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

                    <label style={{ display: "block", fontSize: "0.85rem", color: "#aaa", marginBottom: "6px" }} htmlFor="confirm">
                        Confirm Password
                    </label>
                    <input
                        id="confirm"
                        style={inputStyle}
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={form.confirm}
                        onChange={onChange}
                        disabled={busy}
                        placeholder="Re-enter password"
                    />

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
                        {busy ? "Creating account…" : "Create account"}
                    </button>

                    <div style={{ textAlign: "center", fontSize: "0.9rem", color: "#aaa" }}>
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            style={{ color: "#f7e135", textDecoration: "none", fontWeight: "600" }}
                        >
                            Log in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}