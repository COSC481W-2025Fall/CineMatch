// src/auth/api.js

let currentUser = null;

const RAW_BASE = import.meta.env.VITE_API_BASE || "/api";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

const api = (path) =>
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
let accessToken = null;

export function setAccessToken(token) {
    accessToken = token;
}

export function getAccessToken() {
    return accessToken;
}

export function getCurrentUser() {
    return currentUser;
}


export async function refresh() {
    const res = await fetch(api("/auth/refresh"), {
        method: "POST",
        credentials: "include",
    });

    const text = await res.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch { /* empty */ }
    }

    if (!res.ok) {
        const msg = data.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }

    if (data.accessToken) accessToken = data.accessToken;
    return data;
}

// Authorization fetch

export async function authedFetch(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
    }

    let res = await fetch(api(path), {
        ...init,
        headers,
        credentials: "include",
    });

    // Try one refresh on 401
    if (res.status === 401) {
        try {
            await refresh();
            const retryHeaders = new Headers(init.headers || {});
            if (accessToken) {
                retryHeaders.set("Authorization", `Bearer ${accessToken}`);
            }
            return fetch(api(path), {
                ...init,
                headers: retryHeaders,
                credentials: "include",
            });
        } catch {
            // give up and return original 401
            window.dispatchEvent(new Event("auth:unauthorized"));
        }
    }

    return res;
}

export async function login({ email, password }) {
    const res = await fetch(api("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `Login failed (HTTP ${res.status})`);
    }

    if (data?.accessToken) {
        accessToken = data.accessToken;
    }
    currentUser = data?.user || null;

    return data; // { accessToken, user }
}

export async function register({ displayName, email, password }) {
    const res = await fetch(api("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, displayName }),
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `Registration failed (HTTP ${res.status})`);
    }

    return data;
}

export async function logout() {
    try {
        await fetch(api("/auth/logout"), {
            method: "POST",
            credentials: "include",
        });
    } catch { /* empty */ }
    accessToken = null;
    currentUser = null;
}


export async function fetchReactions() {
    const res = await authedFetch("/me/reactions");

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return {
        likedTmdbIds: Array.isArray(data?.likedTmdbIds) ? data.likedTmdbIds : [],
        dislikedTmdbIds: Array.isArray(data?.dislikedTmdbIds)
            ? data.dislikedTmdbIds
            : [],
    };
}


export async function updateReaction(tmdbId, reaction) {
    const res = await authedFetch("/me/reactions/tmdb", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, reaction }),
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return {
        likedTmdbIds: Array.isArray(data?.likedTmdbIds) ? data.likedTmdbIds : [],
        dislikedTmdbIds: Array.isArray(data?.dislikedTmdbIds)
            ? data.dislikedTmdbIds
            : [],
    };
}


export async function forgotPassword(email) {
    const res = await fetch(api("/auth/forgot"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `Password reset failed (HTTP ${res.status})`);
    }

    return data || { ok: true };
}

