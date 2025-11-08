import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalInput } from '../contexts/GlobalInputContext';

export default function GlobalInputBar() {
  const insets = useSafeAreaInsets();
  const { setInputBarHeight, inputBarHeight, emitSend } = useGlobalInput();
  const [text, setText] = useState('');

  // 높이 측정(onLayout)만 수행
  const onLayout = (e: any) => {
    const h = e.nativeEvent.layout.height as number;
    if (h && h !== inputBarHeight) setInputBarHeight(h);
  };

  const triggerSend = () => {
    if (!text.trim()) return;
    emitSend(text.trim());
    setText('');
  };

  return (
    <View onLayout={onLayout} style={[styles.container, { paddingBottom: (insets.bottom || 0) + 12 }] }>
      <View style={styles.inner}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="오늘 하루는 어땠어요?"
          returnKeyType="send"
          onSubmitEditing={triggerSend}
        />
        <TouchableOpacity style={styles.send} onPress={triggerSend} accessibilityLabel="send">
          <Image source={require('../../assets/arrow-up-icon.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    marginRight: 8,
    backgroundColor: '#fff',
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5d86b', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 18, height: 18, tintColor: '#6a4b00' },
});
