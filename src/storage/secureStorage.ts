// filepath: src/storage/secureStorage.ts
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  try {
    const v = await EncryptedStorage.getItem(STORAGE_KEY);
    if (v) return v;
  } catch (e) {
    // noop, fallback to migration path
  }
  // Migration from legacy AsyncStorage
  try {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacy) {
      try {
        await EncryptedStorage.setItem(STORAGE_KEY, legacy);
      } catch {
        // best-effort: even if secure save fails, return legacy
      }
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore cleanup error
      }
      return legacy;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function setToken(token: string): Promise<void> {
  await EncryptedStorage.setItem(STORAGE_KEY, token);
  // Ensure legacy location is cleared
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function removeToken(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(STORAGE_KEY);
  } finally {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const STORAGE = { getToken, setToken, removeToken };


