const API_BASE = 'http://127.0.0.1:5000';

type AuthResponse = { token?: string; jwt?: string; id?: string; email?: string };

export async function login(id: string, password: string): Promise<string> {
    const url = `${API_BASE}/auth/login`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
        });
        if (!res.ok) {
            const status = res.status;
            const statusText = res.statusText;
            const text = await res.text().catch(() => '');
            let serverMsg: string | undefined;
            try {
                const json = JSON.parse(text);
                serverMsg = json?.message ?? json?.error;
            } catch {
                serverMsg = text;
            }
            console.error('[login] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `로그인 실패: ${serverMsg} (HTTP ${status})` : `로그인 실패 (HTTP ${status})`);
        }
        const data = (await res.json()) as AuthResponse;
        const token = data.jwt || data.token;
        if (!token) throw new Error('토큰 없음');
        return token;
    } catch (e: any) {
        console.error('[login] request failed', { name: e?.name, message: e?.message, url });
        throw e;
    }
}

export type Gender = 'male' | 'female' | 'other';
export type RegisterPayload = {
    id: string;
    email: string;
    password: string;
    gender?: Gender;
    age?: number;
    height?: number; // cm
    weight?: number; // kg
};

export async function register(payload: RegisterPayload): Promise<string> {
    const url = `${API_BASE}/auth/signup`;
    // 민감정보 마스킹하여 요청 로그 (디버그용)
    const safeLog = { ...payload, password: '***' };
    console.log('[register] request', safeLog);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const status = res.status;
            const statusText = res.statusText;
            const text = await res.text().catch(() => '');
            let serverMsg: string | undefined;
            try {
                const json = JSON.parse(text);
                serverMsg = json?.message ?? json?.error;
            } catch {
                serverMsg = text;
            }
            console.error('[register] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `회원가입 실패: ${serverMsg} (HTTP ${status})` : `회원가입 실패 (HTTP ${status})`);
        }
        const data = (await res.json()) as AuthResponse;
        const token = data.jwt || data.token;
        if (!token) throw new Error('토큰 없음');
        return token;
    } catch (e: any) {
        console.error('[register] request failed', { name: e?.name, message: e?.message, url });
        throw e;
    }
}