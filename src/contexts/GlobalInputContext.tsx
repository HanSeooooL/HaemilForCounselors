import React, { createContext, useContext, useRef, useState } from 'react';

type SendHandler = (text: string) => void;

type GlobalInputContextValue = {
  registerSendHandler: (h: SendHandler) => () => void;
  setInputBarHeight: (h: number) => void;
  inputBarHeight: number;
  emitSend: (text: string) => void;
};

const GlobalInputContext = createContext<GlobalInputContextValue | null>(null);

export function GlobalInputProvider({ children }: { children: React.ReactNode }) {
  // use a map to track handlers and ensure we call only the most-recently-registered handler
  const handlers = useRef<Map<number, SendHandler>>(new Map());
  const nextId = useRef(1);
  const [inputBarHeight, setInputBarHeight] = useState<number>(0);

  const registerSendHandler = (h: SendHandler) => {
    const id = nextId.current++;
    handlers.current.set(id, h);
    return () => { handlers.current.delete(id); };
  };

  const emitSend = (text: string) => {
    // call only the last-registered handler (if any)
    const keys = Array.from(handlers.current.keys());
    if (keys.length === 0) return;
    const lastKey = keys[keys.length - 1];
    const fn = handlers.current.get(lastKey);
    if (!fn) return;
    try { fn(text); } catch (e) { console.warn('[GlobalInput] handler error', e); }
  };

  return (
    <GlobalInputContext.Provider value={{ registerSendHandler, setInputBarHeight, inputBarHeight, emitSend }}>
      {children}
    </GlobalInputContext.Provider>
  );
}

export function useGlobalInput() {
  const ctx = useContext(GlobalInputContext);
  if (!ctx) throw new Error('useGlobalInput must be used within GlobalInputProvider');
  return ctx;
}
