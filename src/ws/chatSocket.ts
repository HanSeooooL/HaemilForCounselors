// Simple WebSocket chat helper (raw WebSocket)
// - sendMessage(message): sends { cid, message, createdAt } and resolves when server replies with matching { cid }
// - connect/disconnect, addOnMessageListener

import { Platform } from 'react-native';

const HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const WS_PATH = `/chat/ws`;
const WS_BASE_URL = `ws://${HOST}:8080${WS_PATH}`; // base, token will be appended as query param when provided

export type ChatResponse = { cid: string; message: string; createdAt: number };

type Pending = {
  resolve: (r: ChatResponse) => void;
  reject: (e: any) => void;
  timeout: number;
  payload?: { message: string; createdAt: number };
};

let ws: WebSocket | null = null;
let currentJwt: string | null = null;
const pending = new Map<string, Pending>();
const listeners: Set<(msg: ChatResponse) => void> = new Set();

// reconnect state
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let manualClose = false;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 20_000;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function scheduleReconnect() {
  if (manualClose) return;
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts), RECONNECT_MAX_MS);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectChatSocket(currentJwt ?? undefined).catch(() => {
      if (!manualClose) scheduleReconnect();
    });
  }, delay);
}

function setupSocket() {
  if (!ws) return;
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      const data = safeParse(ev.data);
      if (!data) return;
      // Expect { cid, message, createdAt }
      const cid = data.cid ?? null;
      const msg = data.message ?? null;
      const createdRaw = data.createdAt ?? data.timestamp ?? null;
      const created = typeof createdRaw === 'number' ? (createdRaw < 2e12 ? Math.round(createdRaw) : createdRaw) : null;

      if (cid && pending.has(String(cid))) {
        const p = pending.get(String(cid))!;
        clearTimeout(p.timeout);
        pending.delete(String(cid));
        if (msg == null || created == null) return p.reject(new Error('invalid response'));
        const out: ChatResponse = { cid: String(cid), message: String(msg), createdAt: created };
        p.resolve(out);
        return;
      }

      // if no cid or not matched, treat as unsolicited/push message
      if (msg != null && created != null) {
        const out: ChatResponse = { cid: String(cid ?? ''), message: String(msg), createdAt: created };
        listeners.forEach(fn => { try { fn(out); } catch {} });
      }
    }
  };
  ws.onerror = () => {
    // reject all pending
    pending.forEach(p => { clearTimeout(p.timeout); p.reject(new Error('ws error')); });
    pending.clear();
    if (!manualClose) scheduleReconnect();
  };
  ws.onclose = () => {
    pending.forEach(p => { clearTimeout(p.timeout); p.reject(new Error('ws closed')); });
    pending.clear();
    ws = null;
    if (!manualClose) scheduleReconnect();
  };
}

export async function connectChatSocket(jwt?: string): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  manualClose = false;
  if (ws) { try { ws.close(); } catch {} ws = null; }
  if (jwt) currentJwt = jwt;
  // Build URL with token in query param so server can validate during handshake
  const url = currentJwt ? `${WS_BASE_URL}?jwt=${encodeURIComponent(currentJwt)}` : WS_BASE_URL;
  ws = new WebSocket(url);
  setupSocket();
  return new Promise((resolve, reject) => {
    if (!ws) return reject(new Error('ws not created'));
    const to = setTimeout(() => { try { ws && ws.close(); } catch {} reject(new Error('connect timeout')); }, 5000);
    ws.onopen = () => { clearTimeout(to); if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } reconnectAttempts = 0; resolve(); };
    // errors/close already handled by setupSocket
    ws.onerror = () => { clearTimeout(to); reject(new Error('ws error')); };
    ws.onclose = () => { clearTimeout(to); reject(new Error('ws closed')); };
  });
}

export async function disconnectChatSocket(): Promise<void> {
  manualClose = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (!ws) return;
  try { ws.close(); } catch {}
  ws = null;
}

export function addOnChatMessageListener(fn: (msg: ChatResponse) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function sendMessage(message: string, timeoutMs = 15000): Promise<ChatResponse> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await connectChatSocket();
  }
  if (!ws) throw new Error('ws not connected');
  const cid = uuidv4();
  const createdAt = Date.now();
  const payload = { cid, message, createdAt };
  const text = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(cid); reject(new Error('timeout')); }, timeoutMs);
    pending.set(cid, { resolve, reject, timeout: t, payload: { message, createdAt } });
    try {
      ws!.send(text);
    } catch (e) {
      clearTimeout(t);
      pending.delete(cid);
      reject(e);
    }
  });
}

/**
 * Fire-and-forget 전송: 서버 응답을 기다리지 않고 메시지를 전송합니다.
 * 연결이 닫혀있으면 내부에서 연결을 시도한 뒤 전송합니다.
 * 성공 시 Promise는 resolve되고, 전송 실패 시 reject됩니다.
 */
export async function sendMessageAsync(message: string, cid?: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await connectChatSocket(currentJwt ?? undefined);
  }
  if (!ws) throw new Error('ws not connected');
  const theCid = cid ?? uuidv4();
  const createdAt = Date.now();
  const payload = { cid: theCid, message, createdAt };
  const text = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    try {
      ws!.send(text);
      resolve(theCid);
    } catch (e) {
      reject(e);
    }
  });
}
