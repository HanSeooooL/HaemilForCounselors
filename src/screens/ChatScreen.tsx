// filepath: /Users/hanseol/Desktop/projects/HaemilForCounseolrs/src/screens/ChatScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { postChatResponse } from '../api';
import { saveChatHistory, loadChatHistory, type StoredChatMessage, clearChatHistory } from '../storage/chatHistory';

export type ChatMessage = {
    id: string;
    text: string;
    sender: 'me' | 'bot' | 'system';
    createdAt: number;
};

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

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const { token, signOut } = useAuth();

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>(() => [
        { id: 'welcome', text: '안녕하세요! 상담 채팅을 시작해보세요.', sender: 'bot', createdAt: Date.now() },
    ]);
    const [sending, setSending] = useState(false);

    const listRef = useRef<FlatList<ChatListItem>>(null);

    // 최초 진입 시 저장된 채팅 불러오기
    useEffect(() => {
        (async () => {
            const saved = await loadChatHistory(token);
            if (saved && saved.length) {
                const restored: ChatMessage[] = saved
                    .filter((m): m is StoredChatMessage => !!m)
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map(m => ({ ...m }));
                setMessages(restored);
                requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
            }
        })();
    }, [token]);

    // 메시지 변경될 때마다 저장 (초기 로드 후에도 반영)
    useEffect(() => {
        saveChatHistory(token, messages);
    }, [token, messages]);

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

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text) return;
        const now = Date.now();
        const myMsg: ChatMessage = { id: `${now}`, text, sender: 'me', createdAt: now };
        setMessages(prev => [...prev, myMsg]);
        setInput('');
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

        if (!token) {
            Alert.alert('인증 필요', '로그인이 필요합니다. 다시 로그인해주세요.');
            return;
        }

        if (sending) return; // 중복 전송 방지
        setSending(true);
        try {
            const res = await postChatResponse(token, text);
            if (res.jwt !== token) {
                Alert.alert('세션 확인 실패', '서버에서 반환한 토큰이 일치하지 않습니다. 다시 로그인해주세요.');
                try { await clearChatHistory(token); } catch {}
                try { await signOut(); } catch {}
                return;
            }
            const botMsg: ChatMessage = {
                id: `${res.createdAt}-bot`,
                text: res.message,
                sender: 'bot',
                createdAt: res.createdAt,
            };
            setMessages(prev => [...prev, botMsg]);
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        } catch (e: any) {
            const msg = e?.message ?? '메시지 전송 중 오류가 발생했습니다';
            setMessages(prev => [
                ...prev,
                { id: `${Date.now()}-err`, text: `전송 실패: ${msg}`, sender: 'system', createdAt: Date.now() },
            ]);
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        } finally {
            setSending(false);
        }
    }, [input, token, sending, signOut]);

    const onSubmitEditing = useCallback(() => {
        send();
    }, [send]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            keyboardVerticalOffset={Platform.select({ ios: insets.top + 8, android: 0 })}
        >
            <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
                <Text style={styles.headerTitle}>채팅</Text>
                {/* 로그아웃 버튼 제거 */}
            </View>

            <FlatList
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
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />

            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <TextInput
                    style={styles.textInput}
                    placeholder="메시지를 입력하세요"
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={onSubmitEditing}
                    returnKeyType="send"
                    editable={!sending}
                />
                <Button title={sending ? '전송중…' : '전송'} onPress={send} disabled={sending} />
            </View>
        </KeyboardAvoidingView>
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
    headerTitle: { fontSize: 20, fontWeight: '600' },

    bubbleRow: { flexDirection: 'column', marginVertical: 4, maxWidth: '80%' },
    bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    bubbleMine: { backgroundColor: '#007AFF' },
    bubbleOther: { backgroundColor: '#f1f1f1' },
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
        gap: 8,
        marginVertical: 10,
    },
    dateSeparatorLine: { height: StyleSheet.hairlineWidth as number, backgroundColor: '#e0e0e0', width: 40 },
    dateSeparatorText: { fontSize: 12, color: '#666' },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e5ea',
        backgroundColor: '#fff',
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: Platform.select({ ios: 10, android: 8 }),
    },
});
