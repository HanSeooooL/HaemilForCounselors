// filepath: src/storage/chatHistory.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredChatMessage = {
  id: string;
  text: string;
  sender: 'me' | 'bot' | 'system';
  createdAt: number; // ms epoch
};

const KEY_PREFIX = 'chat_history_';

/**
 * Generate a storage key using optional token and optional username.
 * - If username is provided, it is normalized and included to separate users.
 * - If token is provided, a stable short fingerprint of the token is included.
 * - Falls back to 'default' when neither provided.
 */
function keyFor(token?: string | null, username?: string | null) {
  const uname = typeof username === 'string' && username.trim() ? username.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '') : null;
  const tokenSuffix = token ? (token.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '') || 't') : null;
  if (uname && tokenSuffix) return `${KEY_PREFIX}${uname}_${tokenSuffix}`;
  if (uname) return `${KEY_PREFIX}${uname}`;
  if (tokenSuffix) return `${KEY_PREFIX}${tokenSuffix}`;
  return `${KEY_PREFIX}default`;
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

// Note: 기존 호출과의 호환성을 위해 token은 여전히 첫번째 인자로 남기고,
// 두번째 인자 username은 선택적입니다 (ex: loadChatHistory(token, username)).
export async function loadChatHistory(token?: string | null, username?: string | null): Promise<StoredChatMessage[] | null> {
  const key = keyFor(token, username);
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

export async function saveChatHistory(token: string | null | undefined, messages: StoredChatMessage[], username?: string | null): Promise<void> {
  const key = keyFor(token, username);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export async function clearChatHistory(token?: string | null, username?: string | null): Promise<void> {
  const key = keyFor(token, username);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
