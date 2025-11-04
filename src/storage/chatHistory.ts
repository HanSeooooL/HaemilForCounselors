// filepath: src/storage/chatHistory.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredChatMessage = {
  id: string;
  text: string;
  sender: 'me' | 'bot' | 'system';
  createdAt: number; // ms epoch
};

const KEY_PREFIX = 'chat_history_';

function keyFor(token?: string | null) {
  const suffix = token ? (token.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '') || 'u') : 'default';
  return `${KEY_PREFIX}${suffix}`;
}

function isValidMessage(m: any): m is StoredChatMessage {
  return (
    m &&
    typeof m.id === 'string' &&
    typeof m.text === 'string' &&
    (m.sender === 'me' || m.sender === 'bot' || m.sender === 'system') &&
    typeof m.createdAt === 'number'
  );
}

export async function loadChatHistory(token?: string | null): Promise<StoredChatMessage[] | null> {
  const key = keyFor(token);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter(isValidMessage);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export async function saveChatHistory(token: string | null | undefined, messages: StoredChatMessage[]): Promise<void> {
  const key = keyFor(token);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export async function clearChatHistory(token?: string | null): Promise<void> {
  const key = keyFor(token);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

