import { Platform } from 'react-native';

const HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const API_BASE = `http://${HOST}:8080`;

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

// --- Profile API ---
export type UserProfile = {
    id: string;
    email: string;
    age?: number;
    gender?: Gender;
    height?: number; // cm
    weight?: number; // kg
};

export async function getProfile(token: string): Promise<UserProfile> {
    const url = `${API_BASE}/user/me`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            console.error('[getProfile] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `프로필 조회 실패: ${serverMsg} (HTTP ${status})` : `프로필 조회 실패 (HTTP ${status})`);
        }
        const data = (await res.json()) as Partial<UserProfile> & { user?: Partial<UserProfile> };
        // accept either flat or nested user
        const flat: Partial<UserProfile> = { ...(data.user ?? {}), ...data };
        if (!flat.id || !flat.email) {
            throw new Error('invalid profile payload');
        }
        return {
            id: String(flat.id),
            email: String(flat.email),
            age: flat.age ?? undefined,
            gender: flat.gender as Gender | undefined,
            height: flat.height ?? undefined,
            weight: flat.weight ?? undefined,
        };
    } catch (e) {
        // do not fallback to JWT decode in RN to avoid env issues
        throw e;
    }
}

export type UpdateProfilePayload = {
    age?: number | null;
    gender?: Gender | null;
    height?: number | null; // cm
    weight?: number | null; // kg
};

export async function updateProfile(token: string, patch: UpdateProfilePayload): Promise<UserProfile> {
    const url = `${API_BASE}/user/me`;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(patch),
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
            console.error('[updateProfile] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `프로필 수정 실패: ${serverMsg} (HTTP ${status})` : `프로필 수정 실패 (HTTP ${status})`);
        }
        const data = (await res.json()) as Partial<UserProfile>;
        // server returns updated profile
        return {
            id: String(data.id ?? ''),
            email: String(data.email ?? ''),
            age: data.age ?? undefined,
            gender: data.gender as Gender | undefined,
            height: data.height ?? undefined,
            weight: data.weight ?? undefined,
        };
    } catch (e) {
        console.error('[updateProfile] request failed', e);
        throw e;
    }
}

export async function deleteAccount(token: string): Promise<void> {
    const url = `${API_BASE}/user/me`;
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            console.error('[deleteAccount] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `회원탈퇴 실패: ${serverMsg} (HTTP ${status})` : `회원탈퇴 실패 (HTTP ${status})`);
        }
    } catch (e) {
        console.error('[deleteAccount] request failed', e);
        throw e;
    }
}

export type ChangePasswordPayload = {
    currentPassword: string;
    newPassword: string;
};

export async function changePassword(token: string, payload: ChangePasswordPayload): Promise<void> {
    const url = `${API_BASE}/user/me/password`;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            console.error('[changePassword] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `비밀번호 변경 실패: ${serverMsg} (HTTP ${status})` : `비밀번호 변경 실패 (HTTP ${status})`);
        }
        // 204 No Content or 200 OK with message; we don't need to parse body
        return;
    } catch (e) {
        console.error('[changePassword] request failed', e);
        throw e;
    }
}

// --- Chat API ---
export type RawChatResponse = {
    jwt?: string;
    token?: string;
    message?: string;
    generatedMessage?: string;
    createdAt?: number | string;
    created_time?: number | string;
    timestamp?: number | string;
};

export type ChatResponse = { jwt: string; message: string; createdAt: number };

function parseCreatedAt(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') {
        // if seconds, convert to ms when it looks like a 10-digit epoch
        if (v < 2e12) return Math.round(v * 1000);
        return v;
    }
    if (typeof v === 'string') {
        // try numeric first
        const n = Number(v);
        if (!Number.isNaN(n)) return n < 2e12 ? Math.round(n * 1000) : n;
        const t = Date.parse(v);
        if (!Number.isNaN(t)) return t; // already ms epoch
    }
    return null;
}

export async function postChatResponse(jwt: string, message: string): Promise<ChatResponse> {
    const url = `${API_BASE}/chat/response`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt, message }),
        });
        if (!res.ok) {
            const status = res.status;
            const statusText = res.statusText;
            const text = await res.text().catch(() => '');
            let serverMsg: string | undefined;
            try {
                const json = JSON.parse(text);
                serverMsg = (json?.message as string | undefined) ?? (json?.error as string | undefined);
            } catch {
                serverMsg = text;
            }
            console.error('[chat] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `채팅 전송 실패: ${serverMsg} (HTTP ${status})` : `채팅 전송 실패 (HTTP ${status})`);
        }
        const data = (await res.json()) as RawChatResponse;
        const resJwt = data.jwt || data.token;
        const resMsg = data.message ?? data.generatedMessage;
        const created = parseCreatedAt(data.createdAt ?? data.created_time ?? data.timestamp);
        if (!resJwt) throw new Error('응답에 JWT 없음');
        if (!resMsg) throw new Error('응답에 메시지 없음');
        if (created == null) throw new Error('응답에 생성 시각 없음');
        return { jwt: resJwt, message: resMsg, createdAt: created };
    } catch (e: any) {
        console.error('[chat] request failed', { name: e?.name, message: e?.message, url });
        throw e;
    }
}

export type ExamScoreEntry = {
    userid: string;
    timestamp: number; // may be seconds or ms
    scores: number[];
};

class ApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, status?: number, code?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

export async function fetchExamScores(jwt: string): Promise<ExamScoreEntry[]> {
    const url = `${API_BASE}/depressionscore/examscores`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt }),
        });

        const text = await res.text().catch(() => '');
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

        if (!res.ok) {
            // Try to extract server-side error code/message
            const serverMsg = parsed?.message ?? parsed?.error ?? String(text);
            throw new ApiError(`서버 오류: ${serverMsg}`, res.status, parsed?.error);
        }

        // 200 OK cases: either array of entries or { message: 'no_scores' }
        if (Array.isArray(parsed)) {
            // normalize timestamp to ms
            const normalized: ExamScoreEntry[] = parsed.map((it: any) => ({
                userid: String(it.userid ?? ''),
                // handle number (seconds or ms) and ISO string timestamps
                timestamp: (() => {
                    const raw = it.timestamp;
                    if (raw == null) return 0;
                    if (typeof raw === 'number') {
                        return raw < 2e12 ? Math.round(raw * 1000) : raw;
                    }
                    if (typeof raw === 'string') {
                        // try numeric string first (seconds or ms)
                        const n = Number(raw);
                        if (!Number.isNaN(n)) return n < 2e12 ? Math.round(n * 1000) : n;
                        // try parsing ISO / RFC date strings
                        const p = Date.parse(raw);
                        if (!Number.isNaN(p)) return p;
                        return 0;
                    }
                    return 0;
                })(),
                scores: Array.isArray(it.scores) ? it.scores.map((s: any) => Number(s)) : [],
            }));
            return normalized;
        }

        if (parsed && typeof parsed === 'object' && parsed.message === 'no_scores') {
            // no data available
            return [];
        }

        // unexpected payload
        throw new ApiError('응답 파싱 실패: 예상치 못한 페이로드', res.status, 'invalid_payload');
    } catch (e: any) {
        if (e instanceof ApiError) throw e;
        console.error('[fetchExamScores] request failed', { name: e?.name, message: e?.message, url });
        throw new ApiError(e?.message ?? '요청 실패', undefined, 'request_failed');
    }
}

export type FirstCheckPayload = { jwt: string } & Record<`q${string}`, number>;

export async function postFirstCheck(payload: FirstCheckPayload): Promise<void> {
    const url = `${API_BASE}/depressionscore/firstcheck`;
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
            console.error('[postFirstCheck] HTTP error', { status, statusText, message: serverMsg, url });
            throw new Error(serverMsg ? `초기 문진 전송 실패: ${serverMsg} (HTTP ${status})` : `초기 문진 전송 실패 (HTTP ${status})`);
        }
        // 성공 시 200 OK, 바디는 사용하지 않음
        return;
    } catch (e: any) {
        console.error('[postFirstCheck] request failed', { name: e?.name, message: e?.message, url });
        throw e;
    }
}

export async function postDeviceToken(jwt: string, deviceToken: string, platform: string = Platform.OS): Promise<void> {
    const url = `${API_BASE}/push/register`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ token: deviceToken, platform }),
        });
        if (!res.ok) {
            const status = res.status;
            const text = await res.text().catch(() => '');
            throw new Error(`디바이스 토큰 등록 실패 (${status}): ${text}`);
        }
    } catch (e) {
        console.error('[postDeviceToken] 실패', e);
    }
}
