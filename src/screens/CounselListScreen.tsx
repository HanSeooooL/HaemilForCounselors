import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../navigation/ChatStack';

type Props = NativeStackScreenProps<ChatStackParamList, 'CounselList'>;

const COUNSELORS = [
  { id: 'c1', name: '김상담', title: '임상심리사' },
  { id: 'c2', name: '이상담', title: '상담사' },
  { id: 'c3', name: '박상담', title: '정신건강 전문' },
];

export default function CounselListScreen({ navigation }: Props) {
  const items = [
    { id: 'bot', name: '챗봇', subtitle: '자동 상담 챗봇', mode: 'bot' },
    ...COUNSELORS.map((c) => ({ id: c.id, name: c.name, subtitle: c.title, mode: 'counselor' })),
  ];

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        navigation.navigate('Chat', { mode: item.mode, counselorId: item.id === 'bot' ? undefined : item.id, title: item.name });
      }}
    >
      <View style={styles.left}>
        <Image source={require('../../assets/new-splash-logo.png')} style={styles.avatar} />
        <View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>상담 선택</Text>
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  left: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#888' },
  chev: { fontSize: 20, color: '#aaa' },
});
