import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) setToken(saved);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const signIn = async (id: string, password: string) => {
        const t = await login(id, password);
        setToken(t);
        await AsyncStorage.setItem(STORAGE_KEY, t);
    };

    const signUp = async (payload: RegisterPayload) => {
        const t = await register(payload);
        setToken(t);
        await AsyncStorage.setItem(STORAGE_KEY, t);
    };

    const signOut = async () => {
        setToken(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
    };

    const value = useMemo(() => ({ token, isLoading, signIn, signUp, signOut }), [token, isLoading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('AuthContext not found');
    return ctx;
}