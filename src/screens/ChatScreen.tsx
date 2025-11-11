import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { getProfile, type UserProfile } from '../api';
import { saveChatHistory, loadChatHistory, type StoredChatMessage } from '../storage/chatHistory';
import { useGlobalInput, GlobalInputProvider } from '../contexts/GlobalInputContext';
import GlobalInputBar from '../components/GlobalInputBar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/ChatStack';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

export type ChatMessage = {
    id: string;
    text: string;
    sender: 'me' | 'bot' | 'system';
    createdAt: number;
    status?: 'sending' | 'sent' | 'failed';
};

// 페이지 로드 크기
const PAGE_SIZE = 10;
// 상단 로드 트리거/리셋 임계값 (히스테리시스)
const TOP_TRIGGER_Y = 8;   // 이 값 이하에서만 상단 로드 트리거
const TOP_RESET_Y = 120;   // 이 값 이상으로 내려오면 다음 로드를 허용
const NEAR_BOTTOM_THRESHOLD = 80; // 하단 근처 판정 여유 픽셀

// 날짜 구분선과 메시지를 함께 다루는 리스트 아이템 타입
type ChatListItem =
    | { kind: 'date'; id: string; date: number }
    | { kind: 'msg'; id: string; msg: ChatMessage };

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
}

function formatDate(ts: number): string {
    try {
        return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    } catch {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const dd = d.getDate();
        return `${y}년 ${m}월 ${dd}일`;
    }
}

function isSameDay(a: number, b: number): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function MessageBubble({ item }: { item: ChatMessage }) {
    const isMine = item.sender === 'me';
    const isSystem = item.sender === 'system';
    const time = formatTime(item.createdAt);
    if (isSystem) {
        return (
            <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
                <View style={[styles.bubble, styles.systemBubble]}>
                    <Text style={[styles.bubbleText, styles.systemText]}>{item.text}</Text>
                </View>
                <View style={[styles.timeRow, styles.timeRowOther]}>
                    <Text style={styles.timeText}>{time}</Text>
                </View>
            </View>
        );
    }
    return (
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>{item.text}</Text>
            </View>
            <View style={[styles.timeRow, isMine ? styles.timeRowMine : styles.timeRowOther]}>
                <Text style={styles.timeText}>{time}</Text>
                {isMine && item.status === 'sending' ? <Text style={styles.smallStatus}>전달중…</Text> : null}
                {isMine && item.status === 'failed' ? <Text style={styles.smallStatusErr}>전송 실패</Text> : null}
            </View>
        </View>
    );
}

function DateSeparator({ ts }: { ts: number }) {
    const label = formatDate(ts);
    return (
        <View style={styles.dateSeparatorWrap}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{label}</Text>
            <View style={styles.dateSeparatorLine} />
        </View>
    );
}

// Move all ChatScreen logic into an inner component that is rendered inside the GlobalInputProvider
function ChatScreenInner({ route, navigation }: Props) {
    const insets = useSafeAreaInsets();
    const { token, signOut } = useAuth();
    const { registerSendHandler, inputBarHeight } = useGlobalInput();
    // 추가: 헤더 높이 측정을 위한 ref/state
    const headerRef = useRef<View | null>(null);
    const [headerHeight, setHeaderHeight] = useState(0);

    // input state handled by GlobalInputBar; no local input state required

    // messages 초기값을 빈 배열로 고정
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // 안전한 setMessages 래퍼: updater(배열 또는 함수)를 받아 항상 배열을 보장합니다.
    const setMessagesSafe = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        if (typeof updater === 'function') {
            setMessages(prev => {
                const base = Array.isArray(prev) ? prev : [];
                const next = (updater as (p: ChatMessage[]) => ChatMessage[])(base);
                return Array.isArray(next) ? next : base;
            });
        } else {
            setMessages(Array.isArray(updater) ? updater : []);
        }
    }, []);

    // sending state is tracked via sendingRef; local UI state removed to avoid unused warnings
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [mode] = useState<'bot' | 'counselor'>('bot');

    const listRef = useRef<FlatList<ChatListItem>>(null);
    const contentHeightRef = useRef(0);
    const listHeightRef = useRef(0);
    // 페이징용 refs
    const remainingHistoryRef = useRef<ChatMessage[]>([]); // 아직 화면에 올리지 않은 과거 메시지
    const loadingOlderRef = useRef(false); // 이전 페이지 로드 중 여부
    const suppressAutoScrollRef = useRef(false); // 하단 자동 스크롤 억제 (초기/프리펜드 상황 등)
    const canLoadOlderRef = useRef(true); // 상단 로드 히스테리시스: true일 때만 트리거
    const userNearBottomRef = useRef(true); // 현재 사용자가 하단 근처에 있는지
    const scrollOffsetRef = useRef(0); // 현재 스크롤 y 오프셋
    const preservePrependRef = useRef<{active:boolean; prevContentHeight:number; prevScrollOffset:number}>({active:false, prevContentHeight:0, prevScrollOffset:0});
    // dynamic footer height that ensures last message sits above inputBar
    const initialFooter = (inputBarHeight || 0) + 24;
    const [footerHeight, setFooterHeight] = useState<number>(initialFooter);
    const footerHeightRef = useRef<number>(initialFooter);

    const scrollToBottom = useCallback(() => {
      try {
        const contentH = contentHeightRef.current || 0;
        const listH = listHeightRef.current || 0;
        if (contentH <= listH) return;
        const offset = Math.max(0, contentH - listH);
        requestAnimationFrame(() => {
          try { listRef.current?.scrollToOffset({ offset, animated: false }); } catch {}
        });
      } catch {}
    }, []);

    // --- WebSocket state (component-scoped) ---
    const socketRef = useRef<WebSocket | null>(null);
    const pendingRef = useRef(new Map<string, { resolve: (r: any) => void; reject: (e: any) => void; timeout: ReturnType<typeof setTimeout> }>());
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const manualCloseRef = useRef(false);

    const HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
    const WS_BASE = `ws://${HOST}:8080/chat/ws`;

    function cleanupSocket() {
      try {
        if (socketRef.current) {
          try { socketRef.current.close(); } catch {}
          socketRef.current = null;
        }
      } catch {}
    }

    function scheduleReconnect() {
      if (manualCloseRef.current) return;
      if (reconnectTimerRef.current) return;
      const delay = Math.min(500 * Math.pow(2, reconnectAttemptsRef.current), 20000);
      reconnectAttemptsRef.current++;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectSocket().catch(() => { if (!manualCloseRef.current) scheduleReconnect(); });
      }, delay);
    }

    async function connectSocket(): Promise<void> {
      if (!token) throw new Error('no token');
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
      manualCloseRef.current = false;
      cleanupSocket();
      const url = `${WS_BASE}?jwt=${encodeURIComponent(token)}`;
      return new Promise((resolve, reject) => {
        try {
          const ws = new WebSocket(url);
          socketRef.current = ws;
          const to = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('connect timeout')); }, 5000);
          ws.onopen = () => { clearTimeout(to); reconnectAttemptsRef.current = 0; resolve(); };
          ws.onmessage = (ev) => {
                     try {
                       const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : null;
                       if (!data) return;
                       const cid = data.cid ?? null;
                       const msg = data.message ?? null;
                       const createdRaw = data.createdAt ?? data.timestamp ?? null;
                       const created = typeof createdRaw === 'number' ? (createdRaw < 2e12 ? Math.round(createdRaw) : createdRaw) : (typeof createdRaw === 'string' ? (Number(createdRaw) || Date.parse(createdRaw) || null) : null);
                       if (cid && pendingRef.current.has(String(cid))) {
                         const p = pendingRef.current.get(String(cid))!;
                         clearTimeout(p.timeout);
                         pendingRef.current.delete(String(cid));
                         return p.resolve({ cid: String(cid), message: String(msg ?? ''), createdAt: created ?? Date.now() });
                       }
                       if (msg != null && created != null) {
                         const out: ChatMessage = { id: `${created}-bot-${Math.random().toString(36).slice(2,6)}`, text: String(msg), sender: 'bot', createdAt: created };
                         setMessagesSafe(prev => [...prev, out]);
                       }
                     } catch (e) { console.warn('[ChatScreen] ws msg parse err', e); }
                   };
          ws.onerror = () => {
            // reject all pending
            pendingRef.current.forEach(p => { clearTimeout(p.timeout); p.reject(new Error('ws error')); });
            pendingRef.current.clear();
            if (!manualCloseRef.current) scheduleReconnect();
          };
          ws.onclose = () => {
            pendingRef.current.forEach(p => { clearTimeout(p.timeout); p.reject(new Error('ws closed')); });
            pendingRef.current.clear();
            socketRef.current = null;
            if (!manualCloseRef.current) scheduleReconnect();
          };
        } catch (e) { reject(e); }
      });
    }

    async function disconnectSocket() {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      cleanupSocket();
    }

    async function sendMessageAsyncLocal(message: string, cid?: string): Promise<string> {
      const theCid = cid ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      await connectSocket();
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) throw new Error('ws not connected');
      const payload = { cid: theCid, message, createdAt: Date.now() };
      const text = JSON.stringify(payload);
      return new Promise((resolve, reject) => {
        try {
          socketRef.current!.send(text);
          resolve(theCid);
        } catch (e) { reject(e); }
      });
    }

    // 프로필 불러오기 (id/email -> 로컬 저장 키에 사용)
    useEffect(() => {
        if (!token) {
            setProfile(null);
            return;
        }
        let mounted = true;
        (async () => {
            try {
                const p = await getProfile(token);
                if (mounted) setProfile(p);
            } catch (e) {
                console.warn('[ChatScreen] getProfile failed', e);
                if (mounted) setProfile(null);
            }
        })();
        return () => { mounted = false; };
    }, [token]);

    // Only connect socket when the Chat screen is focused; disconnect on blur/unmount
    useFocusEffect(
      React.useCallback(() => {
        let mounted = true;
        if (mode === 'bot' && token) {
          connectSocket().catch(() => {/* managed */});
        }
        return () => {
          // disconnect when leaving the screen or mode/token change
          disconnectSocket().catch(() => {});
          mounted = false;
        };
      }, [mode, token])
    );

    // 최초 진입 시 저장된 채팅 불러오기 (모드와 프로필을 포함한 키 사용)
    useEffect(() => {
        (async () => {
            const userKey = profile?.id ? `${profile.id}_${mode}` : undefined;
            const saved = await loadChatHistory(token, userKey);
            if (saved && saved.length) {
                const restored: ChatMessage[] = saved
                    .filter((m): m is StoredChatMessage => !!m)
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map(m => ({ ...m }));
                if (restored.length <= PAGE_SIZE) {
                    remainingHistoryRef.current = [];
                    setMessagesSafe(restored);
                } else {
                    // 최근 PAGE_SIZE만 화면 표시, 이전 것은 remainingHistoryRef에 저장
                    remainingHistoryRef.current = restored.slice(0, restored.length - PAGE_SIZE);
                    setMessagesSafe(restored.slice(-PAGE_SIZE));
                }
                // 초기 진입 시에는 최신 메시지들이 보이도록 하단으로 스크롤
                requestAnimationFrame(() => scrollToBottom());
                return;
            }
            remainingHistoryRef.current = [];
            // 저장된 메시지가 없으면 빈 배열 유지
        })();
    }, [token, profile?.id, mode]);

    // 메시지 변경될 때마다 저장 (화면에 보이는 messages + 아직 안 불러온 remainingHistoryRef 합침)
    useEffect(() => {
        const userKey = profile?.id ? `${profile.id}_${mode}` : undefined;
        const fullHistory = [...remainingHistoryRef.current, ...messages];
        saveChatHistory(token, fullHistory, userKey);
    }, [token, messages, profile?.id, mode]);

    const sorted = useMemo(() => [...messages].sort((a, b) => a.createdAt - b.createdAt), [messages]);

    // 날짜 구분선을 포함한 렌더링 아이템 구성
    const items: ChatListItem[] = useMemo(() => {
        const out: ChatListItem[] = [];
        let lastDateTs: number | null = null;
        for (const m of sorted) {
            if (lastDateTs == null || !isSameDay(lastDateTs, m.createdAt)) {
                const d = new Date(m.createdAt);
                const id = `date-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
                out.push({ kind: 'date', id, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() });
                lastDateTs = m.createdAt;
            }
            out.push({ kind: 'msg', id: m.id, msg: m });
        }
        return out;
    }, [sorted]);

    // performSend: accept text directly (used by GlobalInputBar via registerSendHandler)
    const sendingRef = useRef(false);
    const performSend = useCallback(async (textRaw: string) => {
        const text = (textRaw ?? '').trim();
        if (!text) return;
        const now = Date.now();
        const cid = `${now}-${Math.random().toString(36).slice(2,9)}`;
        const myMsg: ChatMessage = { id: cid, text, sender: 'me', createdAt: now, status: 'sending' };
        setMessagesSafe(prev => [...prev, myMsg]);

        if (!token) {
            Alert.alert('인증 필요', '로그인이 필요합니다. 다시 로그인해주세요.');
            return;
        }

        if (mode === 'counselor') {
            setMessagesSafe(prev => [
                ...prev,
                { id: `${Date.now()}-sys`, text: '메시지가 상담사에게 전달되었습니다. (서버 미구현)', sender: 'system', createdAt: Date.now() },
            ]);
             return;
        }

        if (sendingRef.current) return; // prevent concurrent sends
        sendingRef.current = true;
        try {
            await sendMessageAsyncLocal(text, cid);
            setMessagesSafe(prev => prev.map(m => m.id === cid ? { ...m, status: 'sent' } : m));
        } catch (e: any) {
            setMessagesSafe(prev => prev.map(m => m.id === cid ? { ...m, status: 'failed' } : m));
            const msg = e?.message ?? '메시지 전송 중 오류가 발생했습니다';
            setMessagesSafe(prev => [
                ...prev,
                { id: `${Date.now()}-err`, text: `전송 실패: ${msg}`, sender: 'system', createdAt: Date.now() },
            ]);
        } finally {
            sendingRef.current = false;
        }
    }, [token, mode, signOut]);

    // 상단으로 스크롤 시 이전 페이지 로드
    const loadNextOlderPage = useCallback(() => {
        if (loadingOlderRef.current) return;
        if (!remainingHistoryRef.current.length) return;
        loadingOlderRef.current = true;
        suppressAutoScrollRef.current = true; // prepend 중에는 하단 스크롤 금지
        preservePrependRef.current = {
          active: true,
          prevContentHeight: contentHeightRef.current || 0,
          prevScrollOffset: scrollOffsetRef.current || 0,
        };
        // older(과거) 메시지 중 가장 최신 묶음(끝쪽) PAGE_SIZE 추출
        const takeCount = Math.min(PAGE_SIZE, remainingHistoryRef.current.length);
        const startIdx = remainingHistoryRef.current.length - takeCount;
        const page = remainingHistoryRef.current.slice(startIdx); // 오름차순 상태 유지
        remainingHistoryRef.current = remainingHistoryRef.current.slice(0, startIdx);
        // prepend
        setMessagesSafe(prev => [...page, ...prev]);
        loadingOlderRef.current = false;
    }, []);

    // register a stable handler that calls performSend(text)
    useEffect(() => {
         const handler = (text: string) => { performSend(text); };
         const unsub = registerSendHandler(handler);
         return () => { try { unsub(); } catch {} };
     }, [registerSendHandler, performSend]);

    // If the inputBarHeight changes (measured by GlobalInputBar), ensure we scroll again
    useEffect(() => {
        if (!inputBarHeight) return;
        if (!messages || messages.length === 0) return;
        // wait two frames to ensure layout finished, then scroll
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom()));
    }, [inputBarHeight, messages.length, scrollToBottom]);

    // 컴포넌트 언마운트 또는 토큰/모드 변경 시 소켓 정리
    useEffect(() => {
        return () => {
            try {  } catch {}
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const parent = navigation.getParent?.();
            try {
                // Apply both display:none and height:0 as a robust hide across platforms
                parent?.setOptions?.({ tabBarStyle: { display: 'none', height: 0 } });
            } catch (e) {}
            return () => {
                try {
                    parent?.setOptions?.({ tabBarStyle: undefined });
                } catch (e) {}
            };
        }, [navigation])
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={headerHeight}
        >
            {/* development overlay removed */}

            <View
              ref={headerRef}
              onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h && h !== headerHeight) setHeaderHeight(h); }}
              style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 8 }]}
            >
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null} style={styles.backButton} accessibilityLabel="뒤로가기">
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerTitleWrap} onPress={() => { /* optional dropdown */ }}>
                        <Text style={styles.headerTitle}>{route?.params?.title ?? '챗봇'}</Text>
                        <Text style={styles.headerCaret}>▾</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.headerRight} />
            </View>

            <FlatList
                  style={{ flex: 1 }}
                  ref={listRef}
                  data={items}
                  keyExtractor={(it) => it.id}
                  renderItem={({ item }) => (
                      item.kind === 'date' ? (
                          <DateSeparator ts={item.date} />
                      ) : (
                          <MessageBubble item={item.msg} />
                      )
                  )}
                  // Use a footer spacer to guarantee the final item sits above the absolute InputBar
                 contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, justifyContent: 'flex-start' }}
                 ListFooterComponent={<View style={{ height: footerHeight }} />}
                 onContentSizeChange={(w, h) => {
                   const prevFooter = footerHeightRef.current || initialFooter;
                   const contentWithoutFooter = Math.max(0, h - prevFooter);
                   const listH = listHeightRef.current || 0;
                   const desiredFooter = (inputBarHeight || 0) + 24 + Math.max(0, listH - contentWithoutFooter);
                   if (desiredFooter !== footerHeightRef.current) {
                     footerHeightRef.current = desiredFooter;
                     setFooterHeight(desiredFooter);
                     contentHeightRef.current = contentWithoutFooter + desiredFooter;
                   } else {
                     contentHeightRef.current = h;
                   }

                   // 프리펜드 직후 위치 보정: 이전 contentHeight 대비 증가분만큼 offset 증가
                   if (preservePrependRef.current.active) {
                     const delta = (contentHeightRef.current || 0) - preservePrependRef.current.prevContentHeight;
                     if (delta > 0) {
                       const newOffset = preservePrependRef.current.prevScrollOffset + delta;
                       requestAnimationFrame(() => {
                         try { listRef.current?.scrollToOffset({ offset: newOffset, animated: false }); } catch {}
                       });
                     }
                     preservePrependRef.current.active = false;
                     // 프리펜드 후 자동 하단 스크롤 억제 유지, 사용자가 아래로 다시 내릴 때까지
                     return;
                   }

                   // 사용자 하단 근처일 때만 자동 하단 스크롤
                   if (userNearBottomRef.current && !suppressAutoScrollRef.current) {
                     requestAnimationFrame(() => scrollToBottom());
                   }
                 }}
                 onLayout={(e) => {
                   listHeightRef.current = e.nativeEvent.layout.height;
                   const prevFooter = footerHeightRef.current || initialFooter;
                   const contentWithoutFooter = Math.max(0, (contentHeightRef.current || 0) - prevFooter);
                   const desiredFooter = (inputBarHeight || 0) + 24 + Math.max(0, listHeightRef.current - contentWithoutFooter);
                   if (desiredFooter !== footerHeightRef.current) {
                     footerHeightRef.current = desiredFooter;
                     setFooterHeight(desiredFooter);
                     contentHeightRef.current = contentWithoutFooter + desiredFooter;
                   }
                   // 초기/레이아웃 변화 시에는 하단 근처이면만 스크롤
                   if (userNearBottomRef.current && !preservePrependRef.current.active && !suppressAutoScrollRef.current) {
                     requestAnimationFrame(() => scrollToBottom());
                   }
                 }}
                 onScroll={(e) => {
                   const y = e.nativeEvent.contentOffset.y;
                   scrollOffsetRef.current = y;
                   const contentH = contentHeightRef.current || 0;
                   const listH = listHeightRef.current || 0;
                   // 하단 근처 판정
                   const nearBottom = y + listH + NEAR_BOTTOM_THRESHOLD >= contentH;
                   userNearBottomRef.current = nearBottom;
                   if (nearBottom) {
                     // 사용자가 다시 아래로 왔으므로 자동 스크롤 억제 해제
                     suppressAutoScrollRef.current = false;
                   }
                   // 상단 로드 히스테리시스
                   if (y <= TOP_TRIGGER_Y) {
                     if (canLoadOlderRef.current) {
                       canLoadOlderRef.current = false;
                       loadNextOlderPage();
                     }
                   } else if (y > TOP_RESET_Y) {
                     canLoadOlderRef.current = true;
                   }
                 }}
                 scrollEventThrottle={16}
            />

            {/* InputBar is fixed at the bottom (GlobalInputBar is absolute-positioned) */}
            <GlobalInputBar />

         </KeyboardAvoidingView>
    );
}

export default function ChatScreen(props: Props) {
    return (
        <GlobalInputProvider>
            <ChatScreenInner {...props} />
        </GlobalInputProvider>
    );
}

 const styles = StyleSheet.create({
     container: { flex: 1, backgroundColor: '#fff' },
     header: {
         paddingHorizontal: 16,
         borderBottomWidth: StyleSheet.hairlineWidth,
         borderBottomColor: '#e5e5ea',
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'space-between',
         backgroundColor: '#fff',
     },
     headerLeft: { flexDirection: 'row', alignItems: 'center' },
     headerLogo: { width: 36, height: 36, marginRight: 8 },
     headerTitleWrap: { flexDirection: 'row', alignItems: 'center' },
     headerTitle: { fontSize: 18, fontWeight: '700' },
     headerCaret: { marginLeft: 6, fontSize: 14, color: '#777' },
     headerRight: { flexDirection: 'row', alignItems: 'center' },

     modeButton: {
         paddingHorizontal: 10,
         paddingVertical: 6,
         borderRadius: 16,
         marginLeft: 6,
         backgroundColor: 'transparent',
     },
     modeButtonActive: { backgroundColor: '#007AFF' },
     modeText: { color: '#007AFF', fontWeight: '500' },
     modeTextActive: { color: 'white' },

     bubbleRow: { flexDirection: 'column', marginVertical: 4, maxWidth: '80%' },
     bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
     bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
     bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
     bubbleMine: { backgroundColor: '#007AFF' },
     bubbleOther: { backgroundColor: '#E4F0C1' },
     bubbleText: { fontSize: 16 },
     bubbleTextMine: { color: 'white' },
     bubbleTextOther: { color: '#111' },

     timeRow: { marginTop: 2 },
     timeRowMine: { alignItems: 'flex-end' },
     timeRowOther: { alignItems: 'flex-start' },
     timeText: { fontSize: 11, color: '#8e8e93' },

     systemBubble: { backgroundColor: '#fff7e6', borderColor: '#ffe0b2', borderWidth: StyleSheet.hairlineWidth },
     systemText: { color: '#a15d00' },

     dateSeparatorWrap: {
         alignSelf: 'center',
         flexDirection: 'row',
         alignItems: 'center',
         marginVertical: 10,
     },
     dateSeparatorLine: { flex: 1, height: StyleSheet.hairlineWidth as number, backgroundColor: '#e6e6e6', marginHorizontal: 12 },
     dateSeparatorText: { fontSize: 12, color: '#9b9b9b' },

     inputBar: {
         paddingHorizontal: 16,
         paddingTop: 8,
         borderTopWidth: StyleSheet.hairlineWidth,
         borderTopColor: '#e5e5ea',
         backgroundColor: '#fff',
         zIndex: 9999,
         elevation: 20,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: -2 },
         shadowOpacity: 0.05,
         shadowRadius: 6,
     },
     inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
     textInputCustom: {
         flex: 1,
         backgroundColor: '#fff',
         borderWidth: 1,
         borderColor: '#e6e6e6',
         borderRadius: 24,
         paddingHorizontal: 16,
         paddingVertical: Platform.select({ ios: 12, android: 10 }),
         marginRight: 8,
     },
     sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5d86b', alignItems: 'center', justifyContent: 'center' },
     sendIcon: { fontSize: 18, color: '#6a4b00', transform: [{ rotate: '90deg' }] },
     sendIconImage: { width: 18, height: 18, tintColor: '#6a4b00' },
    smallStatus: {
        fontSize: 10,
        color: '#007AFF',
        marginLeft: 4,
    },
    smallStatusErr: {
        fontSize: 10,
        color: '#ff3b30',
        marginLeft: 4,
    },
    debugOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 9999,
    },
    debugText: {
        color: 'white',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    backIcon: {
        fontSize: 18,
        color: '#6a4b00',
        transform: [{ rotate: '90deg' }],
    },
 });
