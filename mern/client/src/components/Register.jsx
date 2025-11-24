import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// if your api file exports `register`, keep this name; if it’s `registerUser`, change accordingly
import { register as registerUser } from "../auth/api";

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "",                // State hook to manage all form fields in a single object
        email: "",
        password: "",
        confirm: "",
    });
    const [showPw, setShowPw] = useState(false);// State hook to control the visibility of the password fields
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function onChange(e) {      // Handler function for all input changes
        const { id, value } = e.target;
        setForm((f) => ({ ...f, [id]: value }));
    }
        //function to handle form submission
    async function onSubmit(e) {
        e.preventDefault();
        setError("");

        // basic client-side validation
        if (!form.name.trim()) return setError("Please enter your name.");
        if (!form.email.trim()) return setError("Please enter an email.");
        if (!form.password) return setError("Please enter a password.");
        if (form.password.length < 8)
            return setError("Password must be at least 8 characters.");
        if (form.password !== form.confirm)
            return setError("Passwords do not match.");

        try {
            setBusy(true);
            await registerUser({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
            });
            // WATCH OUT HERE!!!! WE SHOULD FIND A DIFFERENT FIX FOR THIS!!!!
            e = form.email.trim();

            // success — send them to login (or auto-login if you prefer)
            navigate(`/verify-pending?email=${encodeURIComponent(e)}`, { replace: true });
        } catch (err) {
            // show friendly message if server provided one
            setError(err?.message || "Registration failed. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-page">
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <form className="auth-card" onSubmit={onSubmit}
                  style={{
                      width: 360,
                      background: "#222",
                      color: "#eee",
                      padding: 24,
                      borderRadius: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                  }}

            >
                <h1>Create your account</h1>

                {error && <div className="auth-error">{error}</div>}

                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }} htmlFor="name">Name</label>
                <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={onChange}
                    disabled={busy}
                    placeholder="Your name"
                />

                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }} htmlFor="email">Email</label>
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={onChange}
                    disabled={busy}
                    placeholder="your-email@example.com"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #444", marginBottom: 12 }}
                />

                <label htmlFor="password">Password</label>
                <div className="pw-wrap" style={{ position: "relative", marginBottom: 12 }}>
                    <input
                        id="password"
                        style={{ width: "100%", padding: "10px 40px 10px 10px", borderRadius: 8, border: "1px solid #444" }}
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={onChange}
                        disabled={busy}
                        //placeholder="••••••••"
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

                <label htmlFor="confirm">Confirm password</label>
                <input
                    id="confirm"
                    style={{ width: "100%", padding: "10px 40px 10px 10px", borderRadius: 8, border: "1px solid #444" }}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={onChange}
                    disabled={busy}
                    //placeholder="••••••••"
                    placeholder="Your password"
                />

                <button className="go-btn" type="submit"
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


                        disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                </button>

                <div className="auth-alt">
                    Already have an account? <Link to="/login">Log in</Link>
                </div>
            </form>
            </div>
        </div>
    );
}
