// src/auth/AuthContext.jsx

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from "react";
import {
    login as apiLogin,
    logout as apiLogout,
    refresh,
    setAccessToken,
} from "./api.js";

const STORAGE_TOKEN_KEY = "cm_accessToken";
const STORAGE_USER_KEY = "cm_user";

const AuthContext = createContext({
    user: null,
    loading: true,
    login: async () => {},
    logout: async () => {},
    setUser: () => {},
});

export function AuthProvider({ children }) {
    // Generate user from localStorage synchronously
    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [loading, setLoading] = useState(true); // true while refreshing 

    // On first login:
    // - Load saved access token into in-memory state
    // - Try /auth/refresh to rotate tokens & verify session
    useEffect(() => {
        // If we had a token from a previous session, put it back into memory
        const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (savedToken) {
            setAccessToken(savedToken);
        }

        let cancelled = false;

        (async () => {
            try {
                const data = await refresh(); 
                if (cancelled) return;

                if (data?.accessToken) {
                    setAccessToken(data.accessToken);
                    localStorage.setItem(STORAGE_TOKEN_KEY, data.accessToken);
                }
                if (data?.user) {
                    setUser(data.user);
                    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
                }
                // If refresh succeeds, synced with server.
            } catch (e) {
                // IMPORTANT:
                // If refresh fails (no cookie, expired, etc.), we DO NOT wipe out
                // whatever we loaded from localStorage. We just treat it as a
                // "best effort" and let authedFetch handle 401s later.
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Login: use the api.js login helper, then access token and user
    const login = useCallback(async (credentials) => {
        const data = await apiLogin(credentials); // { accessToken, user }

        if (data?.accessToken) {
            setAccessToken(data.accessToken);
            localStorage.setItem(STORAGE_TOKEN_KEY, data.accessToken);
        }

        if (data?.user) {
            setUser(data.user);
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
        }

        return data;
    }, []);

    // Logout: tell server, then clear token and user from memory and storage
    const logout = useCallback(async () => {
        await apiLogout().catch(() => {
            // ignore network errors on logout
        });

        setAccessToken(null);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        setUser(null);
    }, []);


    const value = {
        user,
        loading,
        login,
        logout,
        setUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
