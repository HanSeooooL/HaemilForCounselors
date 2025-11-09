import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';
import { UserFlags } from '../storage/userFlags';

export default function InitialQuestionnaireIntro() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const onStart = async () => {
    await UserFlags.setInitialQuestionnairePromptDone();
    navigation.replace('InitialQuestionnaireForm');
  };

  const onLater = async () => {
    await UserFlags.setInitialQuestionnairePromptDone();
    navigation.replace('RootTabs');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }] }>
      <Image source={require('../../assets/new-splash-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>{'초기 문진표를\n작성할게요'}</Text>
      <Text style={styles.subtitle}>{'좀 더 정확한\n진단을 위해 필요해요'}</Text>

      <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={onStart}>
        <Text style={styles.ctaPrimaryText}>해보죠!</Text>
      </Pressable>
      <Pressable style={[styles.cta, styles.ctaSecondary]} onPress={onLater}>
        <Text style={styles.ctaSecondaryText}>다음에 할래요</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: '#fff' },
  logo: { width: '60%', height: 120, marginBottom: 28 },
  title: { fontSize: 40, fontWeight: '900', textAlign: 'center', lineHeight: 44, marginBottom: 14 },
  subtitle: { fontSize: 18, color: '#5b5b5b', textAlign: 'center', marginBottom: 24 },
  cta: { alignSelf: 'stretch', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  ctaPrimary: { backgroundColor: '#8FAF6B' },
  ctaPrimaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  ctaSecondary: { backgroundColor: '#8a8a8a' },
  ctaSecondaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
