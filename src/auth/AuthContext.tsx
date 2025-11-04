import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
// replace AsyncStorage with secure storage wrapper
import { STORAGE as SecureStorage } from '../storage/secureStorage';
import { login, register, type RegisterPayload } from '../api';

type AuthContextValue = {
    token: string | null;
    isLoading: boolean;
    signIn: (id: string, password: string) => Promise<void>;
    signUp: (payload: RegisterPayload) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                // Load from secure storage (will migrate from legacy AsyncStorage if needed)
                const saved = await SecureStorage.getToken();
                if (saved) setToken(saved);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const signIn = async (id: string, password: string) => {
        const t = await login(id, password);
        setToken(t);
        await SecureStorage.setToken(t);
    };

    const signUp = async (payload: RegisterPayload) => {
        const t = await register(payload);
        setToken(t);
        await SecureStorage.setToken(t);
    };

    const signOut = async () => {
        setToken(null);
        await SecureStorage.removeToken();
    };

    const value = useMemo(() => ({ token, isLoading, signIn, signUp, signOut }), [token, isLoading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('AuthContext not found');
    return ctx;
}