import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppStack';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const MENU_ITEMS = [
  { id: 'profile', label: '내 정보' },
  { id: 'settings', label: '설정 (미구현)' },
  { id: 'help', label: '도움말 (미구현)' },
];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const onPress = (id: string) => {
    if (id === 'profile') {
      navigation.navigate('Profile');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>전체 메뉴</Text>
      </View>

      <FlatList
        data={MENU_ITEMS}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onPress(item.id)}>
            <Text style={styles.rowText}>{item.label}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ padding: 16 }}
      />

      <View style={{ height: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea', backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '600', padding: 12 },
  row: { paddingVertical: 14 },
  rowText: { fontSize: 16 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea' },
});
