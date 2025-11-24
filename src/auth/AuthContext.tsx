import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
// replace AsyncStorage with secure storage wrapper
import { STORAGE as SecureStorage } from '../storage/secureStorage';
import { login, register, type RegisterPayload } from '../api';
import { initFcm, peekFcmToken } from '../firebaseMessaging';

type AuthContextValue = {
    token: string | null;
    isLoading: boolean;
    justSignedUp: boolean;

    signIn: (id: string, password: string) => Promise<void>;
    signUp: (payload: RegisterPayload) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [justSignedUp, setJustSignedUp] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                // FCM 초기화 (권한 요청 + 토큰 발급)
                await initFcm();
                // 저장된 토큰 로드
                const saved = await SecureStorage.getToken();
                if (saved) setToken(saved);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const signIn = async (id: string, password: string) => {
        const fcmToken = peekFcmToken();
        const t = await login(id, password, fcmToken || undefined);
        setToken(t);
        await SecureStorage.setToken(t);
        setJustSignedUp(false);
    };

    const signUp = async (payload: RegisterPayload) => {
        const fcmToken = peekFcmToken();
        const t = await register({ ...payload, fcmToken: fcmToken || undefined });
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