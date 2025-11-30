// src/auth/ProtectedRoute.jsx
import React from "react";
import { useAuth } from "./AuthContext.jsx";
import { Navigate, useLocation } from "react-router-dom";
export default function ProtectedRoute({ children }) {
    const { user, status } = useAuth();
    const location = useLocation();

    if (status === "loading") {
        return <div>Loading…</div>;
    }
    if (!user) {
        return (<Navigate to="/login" replace state={{ from: location }}/>);
    }
    return children;
}