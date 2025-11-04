import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getProfile, updateProfile, deleteAccount, changePassword, type Gender, type UpdateProfilePayload, type UserProfile } from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const [pwVisible, setPwVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const genderLabel = (g?: Gender) => (g === 'male' ? '남성' : g === 'female' ? '여성' : g === 'other' ? '기타' : undefined);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getProfile(token);
      setProfile(p);
    } catch (e: any) {
      setError(e?.message ?? '프로필을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onOpenEdit = () => {
    if (!profile) return;
    setAge(profile.age != null ? String(profile.age) : '');
    setGender(profile.gender);
    setHeight(profile.height != null ? String(profile.height) : '');
    setWeight(profile.weight != null ? String(profile.weight) : '');
    setEditVisible(true);
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const patch: UpdateProfilePayload = {
        age: age ? Number(age) : null,
        gender: gender ?? null,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
      };
      if (patch.age != null && (isNaN(patch.age) || (patch.age as number) <= 0)) throw new Error('나이는 양수여야 합니다');
      if (patch.height != null && (isNaN(patch.height) || (patch.height as number) <= 0)) throw new Error('키는 양수여야 합니다');
      if (patch.weight != null && (isNaN(patch.weight) || (patch.weight as number) <= 0)) throw new Error('체중은 양수여야 합니다');
      const updated = await updateProfile(token, patch);
      setProfile((prev) => ({ ...(prev ?? ({} as any)), ...updated } as UserProfile));
      setEditVisible(false);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await signOut();
  };

  const onDelete = () => {
    Alert.alert('회원탈퇴', '정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴', style: 'destructive', onPress: async () => {
          if (!token) return;
          try {
            await deleteAccount(token);
          } catch (e: any) {
            Alert.alert('오류', e?.message ?? '탈퇴 실패');
          } finally {
            await signOut();
          }
        }
      }
    ]);
  };

  const onChangePassword = async () => {
    if (!token) return;
    // 클라이언트 검증
    if (!currentPw) return Alert.alert('안내', '현재 비밀번호를 입력하세요.');
    if (!newPw || newPw.length < 8) return Alert.alert('안내', '새 비밀번호는 8자 이상이어야 합니다.');
    if (newPw !== newPw2) return Alert.alert('안내', '새 비밀번호가 일치하지 않습니다.');

    setPwSaving(true);
    try {
      await changePassword(token, { currentPassword: currentPw, newPassword: newPw });
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      setPwVisible(false);
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '비밀번호 변경 실패');
    } finally {
      setPwSaving(false);
    }
  };

  const renderRow = (label: string, value?: string | number | null) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value == null || value === '' ? '입력되지 않음' : String(value)}</Text>
    </View>
  );

  let content: React.ReactNode;
  if (loading) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="다시 시도" onPress={load} />
        <View style={{ height: 12 }} />
        <Button title="로그아웃" onPress={onLogout} />
      </View>
    );
  } else if (!profile) {
    content = (
      <View style={styles.center}>
        <Text>프로필 정보가 없습니다</Text>
        <Button title="새로고침" onPress={load} />
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.content}>
        {renderRow('아이디', profile.id)}
        {renderRow('이메일', profile.email)}
        {renderRow('나이', profile.age ?? null)}
        {renderRow('성별', genderLabel(profile.gender) ?? null)}
        {renderRow('키 (cm)', profile.height ?? null)}
        {renderRow('몸무게 (kg)', profile.weight ?? null)}

        <View style={styles.buttonGroup}>
          <Button title="내 정보 수정" onPress={onOpenEdit} />
          <Button title="비밀번호 변경" onPress={() => setPwVisible(true)} />
          <Button title="로그아웃" onPress={onLogout} />
          <Button title="회원탈퇴" color={Platform.OS === 'ios' ? '#ff3b30' : '#d00'} onPress={onDelete} />
        </View>

        <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
          <View style={styles.modalContainer}>
            <Text style={styles.title}>내 정보 수정</Text>

            <View style={{ height: 8 }} />
            <Text style={styles.modalLabel}>성별</Text>
            <View style={styles.genderRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity key={g} style={[styles.genderBtn, gender === g && styles.genderBtnActive]} onPress={() => setGender(g)}>
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{genderLabel(g)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.genderBtn, gender == null && styles.genderBtnActive]} onPress={() => setGender(undefined)}>
                <Text style={[styles.genderText, gender == null && styles.genderTextActive]}>선택안함</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>나이</Text>
            <TextInput
              placeholder="나이"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>키 (cm)</Text>
            <TextInput
              placeholder="키"
              keyboardType="number-pad"
              value={height}
              onChangeText={setHeight}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>몸무게 (kg)</Text>
            <TextInput
              placeholder="몸무게"
              keyboardType="number-pad"
              value={weight}
              onChangeText={setWeight}
              style={styles.input}
            />

            <View style={styles.rowGap} />
            <View style={styles.rowBetween}>
              <Button title="취소" onPress={() => setEditVisible(false)} disabled={saving} />
              <Button title={saving ? '저장 중...' : '저장'} onPress={onSave} disabled={saving} />
            </View>
          </View>
        </Modal>

        <Modal visible={pwVisible} animationType="slide" onRequestClose={() => setPwVisible(false)}>
          <View style={styles.modalContainer}>
            <Text style={styles.title}>비밀번호 변경</Text>
            <Text style={styles.modalLabel}>현재 비밀번호</Text>
            <TextInput
              placeholder="현재 비밀번호"
              secureTextEntry
              value={currentPw}
              onChangeText={setCurrentPw}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>새 비밀번호</Text>
            <TextInput
              placeholder="새 비밀번호 (8자 이상)"
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>새 비밀번호 확인</Text>
            <TextInput
              placeholder="새 비밀번호 확인"
              secureTextEntry
              value={newPw2}
              onChangeText={setNewPw2}
              style={styles.input}
            />
            <View style={styles.rowGap} />
            <View style={styles.rowBetween}>
              <Button title="취소" onPress={() => setPwVisible(false)} disabled={pwSaving} />
              <Button title={pwSaving ? '변경 중...' : '변경'} onPress={onChangePassword} disabled={pwSaving} />
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
        <Text style={styles.headerTitle}>내 정보</Text>
      </View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },

  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e0e0e0' },
  label: { color: '#555' },
  value: { fontWeight: '500' },
  buttonGroup: { marginTop: 20, gap: 12 },
  error: { color: 'red', marginBottom: 12 },

  modalContainer: { flex: 1, padding: 20, paddingTop: 48 },
  modalLabel: { marginTop: 12, marginBottom: 6, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  rowGap: { height: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 16 },
  genderBtnActive: { backgroundColor: '#007AFF22', borderColor: '#007AFF' },
  genderText: { color: '#333' },
  genderTextActive: { color: '#007AFF', fontWeight: '600' },
});
