import React, { useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, Image, StyleSheet, Platform, Keyboard, EmitterSubscription } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalInput } from '../contexts/GlobalInputContext';

export default function GlobalInputBar() {
  const insets = useSafeAreaInsets();
  const { setInputBarHeight, inputBarHeight, emitSend } = useGlobalInput();
  const [text, setText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  // 높이 측정(onLayout)만 수행
  const onLayout = (e: any) => {
    const h = e.nativeEvent.layout.height as number;
    if (h && h !== inputBarHeight) setInputBarHeight(h);
  };

  useEffect(() => {
    let showSub: EmitterSubscription | undefined;
    let hideSub: EmitterSubscription | undefined;
    if (Platform.OS === 'ios') {
      showSub = Keyboard.addListener('keyboardWillShow', (e) => {
        const h = e.endCoordinates?.height ?? 0;
        setKbHeight(h);
      });
      hideSub = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    } else {
      showSub = Keyboard.addListener('keyboardDidShow', (e) => {
        const h = e.endCoordinates?.height ?? 0;
        setKbHeight(h);
      });
      hideSub = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    }
    return () => {
      try { showSub && showSub.remove(); } catch {}
      try { hideSub && hideSub.remove(); } catch {}
    };
  }, []);

  const triggerSend = () => {
    if (!text.trim()) return;
    emitSend(text.trim());
    setText('');
  };

  const bottomPad = (insets.bottom || 0) + 12;
  const translateY = Platform.OS === 'ios' ? -Math.max(0, kbHeight - (insets.bottom || 0)) : 0;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { paddingBottom: bottomPad, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
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
    zIndex: 1000,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
