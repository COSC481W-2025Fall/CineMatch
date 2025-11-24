// client/src/auth/api.js
// Minimal auth client for JWT access/refresh flow

let accessToken = null;

// Normalize base ('' for same-origin, or e.g. 'https://api.example.com')
const RAW_BASE = import.meta.env.VITE_API_BASE ?? "";
const API_BASE = RAW_BASE.replace(/\/+$/, ""); // strip trailing slashes
const api = (path) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

export function getAccessToken() {
    return accessToken;
}

async function parseError(res) {
    let message = `HTTP ${res.status}`;
    try {
        const data = await res.json();
        if (data?.error) message = data.error;
        else if (data?.message) message = data.message;
    } catch {}
    return new Error(message);
}

/** REGISTER */
export async function register({ name, email, password }) {
    const body = {
        // if your server expects displayName, keep both:
        name,
        displayName: name,
        email,
        password,
    };

    const res = await fetch(api("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });

    if (!res.ok) throw await parseError(res);
    // some APIs return the created user; we don’t need it here
    return await res.json().catch(() => ({}));
}

///loogin send a post request
export async function login({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
    });

    let data = null;
    try { data = await res.json(); } catch { /* empty */ }

    if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
    }

    if (!data?.accessToken) {
        // Important: if the server didn’t return an access token, treat as error.
        throw new Error("Login succeeded but no access token was returned.");
    }

    accessToken = data.accessToken;
    return data;
}


//LOGOUT
export async function logout() {
    await fetch(api("/auth/logout"), {
        method: "POST",
        credentials: "include",
    });
    accessToken = null;
}

// rotate access token using refresh cookie
export async function refresh() {
    const res = await fetch(api("/auth/refresh"), {
        method: "POST",
        credentials: "include",
    });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    accessToken = data?.accessToken || null;
    return data;
}

/** Helper to call protected APIs; auto-refreshes once on 401 */
export async function authedFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    let res = await fetch(api(url), {
        ...options,
        headers,
        credentials: "include",
    });
    if (res.status !== 401) return res;

    // one retry after refresh
    try {
        await refresh();
        const headers2 = new Headers(options.headers || {});
        if (accessToken) headers2.set("Authorization", `Bearer ${accessToken}`);
        res = await fetch(api(url), {
            ...options,
            headers: headers2,
            credentials: "include",
        });
        return res;
    } catch {
        accessToken = null;
        throw new Error("Session expired. Please log in again.");
    }
}
