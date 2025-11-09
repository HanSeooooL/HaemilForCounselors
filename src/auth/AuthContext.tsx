import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
// replace AsyncStorage with secure storage wrapper
import { STORAGE as SecureStorage } from '../storage/secureStorage';
import { login, register, type RegisterPayload } from '../api';

type AuthContextValue = {
    token: string | null;
    isLoading: boolean;
    justSignedUp: boolean;
    signIn: (id: string, password: string) => Promise<void>;
    signUp: (payload: RegisterPayload) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [justSignedUp, setJustSignedUp] = useState(false);

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
        setJustSignedUp(false);
    };

    const signUp = async (payload: RegisterPayload) => {
        const t = await register(payload);
        setToken(t);
        await SecureStorage.setToken(t);
        setJustSignedUp(true);
    };

    const signOut = async () => {
        setToken(null);
        await SecureStorage.removeToken();
        setJustSignedUp(false);
    };

    const value = useMemo(() => ({ token, isLoading, justSignedUp, signIn, signUp, signOut }), [token, isLoading, justSignedUp]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('AuthContext not found');
    return ctx;
}