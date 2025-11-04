declare module 'react-native-encrypted-storage' {
  const EncryptedStorage: {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
  };
  export default EncryptedStorage;
}

