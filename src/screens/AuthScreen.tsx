import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable, Image } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import type { Gender, RegisterPayload } from '../api';

export default function AuthScreen() {
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');

    // 공통 상태
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');

    // 회원가입용 상태
    const [step, setStep] = useState(0); // 0:id, 1:pw+confirm, 2:email, 3:optionals
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [email, setEmail] = useState('');
    const [gender, setGender] = useState<Gender | undefined>(undefined);
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [showGenderModal, setShowGenderModal] = useState(false);
    const [showAgeModal, setShowAgeModal] = useState(false);

    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const resetSignup = () => {
        setStep(0);
        setId('');
        setPassword('');
        setPasswordConfirm('');
        setEmail('');
        setGender(undefined);
        setAge('');
        setHeight('');
        setWeight('');
        setErr(null);
    };

    const onLogin = async () => {
        setErr(null);
        if (!id.trim() || !password) return setErr('아이디와 비밀번호를 입력하세요');
        setLoading(true);
        try {
            await signIn(id.trim(), password);
        } catch (e: any) {
            setErr(e?.message ?? '로그인 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const onSignupNext = () => {
        setErr(null);
        if (step === 0) {
            if (!id.trim()) return setErr('아이디를 입력하세요');
            return setStep(1);
        }
        // step 1: 비밀번호 + 재입력 통합 화면
        if (step === 1) {
            if (!password || password.length < 8) return setErr('비밀번호는 8자 이상이어야 합니다');
            if (!passwordConfirm) return setErr('비밀번호 확인을 입력하세요');
            if (passwordConfirm !== password) return setErr('비밀번호가 일치하지 않습니다');
            return setStep(2);
        }
        if (step === 2) {
            if (!email.trim()) return setErr('이메일을 입력하세요');
            // 간단한 형식 체크(선택)
            const simple = /.+@.+\..+/;
            if (!simple.test(email.trim())) return setErr('올바른 이메일 형식이 아닙니다');
            return setStep(3);
        }
    };

    const onSignupBack = () => {
        setErr(null);
        if (step > 0) setStep(step - 1);
    };

    const onSignupSubmit = async () => {
        setErr(null);
        setLoading(true);
        try {
            const payload: RegisterPayload = {
                id: id.trim(),
                email: email.trim(),
                password,
                gender,
                age: age ? Number(age) : undefined,
                height: height ? Number(height) : undefined,
                weight: weight ? Number(weight) : undefined,
            };
            // 숫자 검증(양수)
            if (payload.age !== undefined && (isNaN(payload.age) || payload.age <= 0)) {
                setErr('나이는 양수여야 합니다');
                setLoading(false);
                return;
            }
            if (payload.height !== undefined && (isNaN(payload.height) || payload.height <= 0)) {
                setErr('키는 양수여야 합니다');
                setLoading(false);
                return;
            }
            if (payload.weight !== undefined && (isNaN(payload.weight) || payload.weight <= 0)) {
                setErr('체중은 양수여야 합니다');
                setLoading(false);
                return;
            }

            await signUp(payload);
            // 라우팅은 Root(App.tsx)에서 토큰/플래그 상태를 감지해 처리합니다.
        } catch (e: any) {
            setErr(e?.message ?? '회원가입 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const renderSignupStep = () => {
        if (step === 0) {
            return (
                <>
                    <Text style={styles.titleHuge}>아이디를{"\n"}입력해주세요</Text>
                    <TextInput
                        placeholder="아이디 입력"
                        placeholderTextColor="#bdbdbd"
                        autoCapitalize="none"
                        value={id}
                        onChangeText={setId}
                        style={styles.bigInput}
                    />
                    <TouchableOpacity
                        style={styles.bigButton}
                        activeOpacity={0.8}
                        onPress={onSignupNext}
                        disabled={loading}
                    >
                        <Text style={styles.bigButtonText}>{loading ? '처리중...' : '다음'}</Text>
                    </TouchableOpacity>
                </>
            );
        }
        // step 1: 비밀번호 + 재입력 통합 화면
        if (step === 1) {
            return (
                <>
                    <Text style={styles.titleHuge}>비밀번호를{"\n"}입력해주세요</Text>
                    <TextInput
                        placeholder="비밀번호 입력"
                        placeholderTextColor="#bdbdbd"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        style={styles.bigInput}
                    />
                    <TextInput
                        placeholder="비밀번호 재입력"
                        placeholderTextColor="#bdbdbd"
                        secureTextEntry
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        style={styles.bigInput}
                    />
                    <TouchableOpacity
                        style={styles.bigButton}
                        activeOpacity={0.8}
                        onPress={onSignupNext}
                        disabled={loading}
                    >
                        <Text style={styles.bigButtonText}>{loading ? '처리중...' : '다음'}</Text>
                    </TouchableOpacity>
                </>
            );
        }
        // step 2: 이메일
        if (step === 2) {
            return (
                <>
                    <Text style={styles.titleHuge}>이메일을{"\n"}입력해주세요</Text>
                    <TextInput
                        placeholder="이메일 입력"
                        placeholderTextColor="#bdbdbd"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                        style={styles.bigInput}
                    />
                    <TouchableOpacity
                        style={styles.bigButton}
                        activeOpacity={0.8}
                        onPress={onSignupNext}
                        disabled={loading}
                    >
                        <Text style={styles.bigButtonText}>{loading ? '처리중...' : '다음'}</Text>
                    </TouchableOpacity>
                </>
            );
        }
        // step 3: 인적사항 입력(설계서)
        return (
            <>
                <Text style={styles.titleHuge}>인적사항을{"\n"}입력해주세요</Text>
                <Text style={styles.subtitle}>민감한 내용은{"\n"}입력하지 않아도 괜찮아요</Text>

                <Text style={styles.fieldLabel}>성별</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setShowGenderModal(true)}>
                    <Text style={styles.selectBoxText}>{gender ? (gender === 'male' ? '남성' : gender === 'female' ? '여성' : '기타') : '선택'}</Text>
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>나이</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setShowAgeModal(true)}>
                    <Text style={styles.selectBoxText}>{age ? age : '선택'}</Text>
                </TouchableOpacity>

                <TextInput
                    placeholder="키 입력"
                    placeholderTextColor="#bdbdbd"
                    keyboardType="number-pad"
                    value={height}
                    onChangeText={setHeight}
                    style={styles.bigInput}
                />
                <TextInput
                    placeholder="체중 입력"
                    placeholderTextColor="#bdbdbd"
                    keyboardType="number-pad"
                    value={weight}
                    onChangeText={setWeight}
                    style={styles.bigInput}
                />

                <TouchableOpacity
                    style={styles.bigButton}
                    activeOpacity={0.8}
                    onPress={onSignupSubmit}
                    disabled={loading}
                >
                    <Text style={styles.bigButtonText}>{loading ? '처리중...' : '완료'}</Text>
                </TouchableOpacity>
                {/* Gender Modal */}
                <Modal visible={showGenderModal} transparent animationType="fade" onRequestClose={() => setShowGenderModal(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setShowGenderModal(false)}>
                        <View style={styles.modalContent}>
                            {['남성', '여성', '기타', '선택안함'].map((opt) => (
                                <Pressable key={opt} style={styles.optionItem} onPress={() => {
                                    if (opt === '선택안함') setGender(undefined);
                                    else setGender(opt === '남성' ? 'male' : opt === '여성' ? 'female' : 'other');
                                    setShowGenderModal(false);
                                }}>
                                    <Text style={styles.optionText}>{opt}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>

                {/* Age Modal */}
                <Modal visible={showAgeModal} transparent animationType="fade" onRequestClose={() => setShowAgeModal(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setShowAgeModal(false)}>
                        <View style={[styles.modalContent, { maxHeight: 300 }]}
                        >
                            <FlatList
                                data={Array.from({ length: 70 - 15 + 1 }, (_, i) => String(15 + i))}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <Pressable style={styles.optionItem} onPress={() => { setAge(item); setShowAgeModal(false); }}>
                                        <Text style={styles.optionText}>{item} 세</Text>
                                    </Pressable>
                                )}
                            />
                        </View>
                    </Pressable>
                </Modal>
            </>
        );
    };

    return (
        <View style={styles.container}>
            {mode === 'signin' ? (
                <>
                    <Image source={require('../../assets/new-splash-logo.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.titleHuge}>좋은 하루{"\n"}보내셨나요?</Text>
                    <TextInput
                        placeholder="아이디 입력"
                        placeholderTextColor="#bdbdbd"
                        autoCapitalize="none"
                        value={id}
                        onChangeText={setId}
                        style={styles.loginInput}
                    />
                    <TextInput
                        placeholder="비밀번호 입력"
                        placeholderTextColor="#bdbdbd"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        style={styles.loginInput}
                    />
                    {err ? <Text style={styles.error}>{err}</Text> : null}
                    <TouchableOpacity style={styles.bigButton} onPress={onLogin} activeOpacity={0.8} disabled={loading}>
                        <Text style={styles.bigButtonText}>{loading ? '처리중...' : '로그인'}</Text>
                    </TouchableOpacity>
                    <View style={styles.switchRow}>
                        <Text>해밀이 처음이신가요? </Text>
                        <Text
                            style={styles.link}
                            onPress={() => {
                                setMode('signup');
                                resetSignup();
                            }}
                        >
                            회원가입
                        </Text>
                    </View>
                </>
            ) : (
                <>
                    {renderSignupStep()}
                    {err ? <Text style={styles.error}>{err}</Text> : null}
                    {step > 0 && step < 3 && (
                        <View style={styles.row}>
                            {step > 0 && (
                                <Button title="뒤로" onPress={onSignupBack} disabled={loading} />
                            )}
                            {step < 3 ? (
                                <Button title={loading ? '처리중...' : '다음'} onPress={onSignupNext} disabled={loading} />
                            ) : (
                                <Button title={loading ? '처리중...' : '회원가입 완료'} onPress={onSignupSubmit} disabled={loading} />
                            )}
                        </View>
                    )}
                    <View style={styles.switchRow}>
                        <Text>이미 계정이 있나요? </Text>
                        <Text
                            style={styles.link}
                            onPress={() => {
                                setMode('signin');
                                setErr(null);
                            }}
                        >
                            로그인
                        </Text>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
    // 큰 제목(설계서 기준)
    titleHuge: { fontSize: 40, fontWeight: '800', marginBottom: 16, lineHeight: 44 },
    subtitle: { color: '#7a7a7a', fontSize: 16, marginBottom: 18 },
    fieldLabel: { fontSize: 16, color: '#333', marginBottom: 8 },
    selectBox: { borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 16 },
    selectBoxText: { color: '#333', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', padding: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    optionItem: { paddingVertical: 12, paddingHorizontal: 8 },
    optionText: { fontSize: 16, color: '#222' },
    // 플레이스홀더 스타일에 맞춘 큰 입력 (테두리 없이 연한 텍스트)
    bigInput: { borderWidth: 0, paddingVertical: 18, paddingHorizontal: 8, fontSize: 18, color: '#444', marginBottom: 24 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
    switchRow: { flexDirection: 'row', marginTop: 12 },
    link: { color: '#007AFF' },
    error: { color: 'red', marginBottom: 8 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
    // 큰 녹색 버튼
    bigButton: { backgroundColor: '#8FAF6B', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 8 },
    bigButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    logo: { width: '100%', height: 160, marginBottom: 40, alignSelf: 'center' },
    loginInput: { borderWidth: 0, paddingVertical: 18, paddingHorizontal: 8, fontSize: 18, color: '#444', marginBottom: 24, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 10 },
});