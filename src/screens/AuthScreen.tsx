import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import type { Gender, RegisterPayload } from '../api';

export default function AuthScreen() {
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');

    // 공통 상태
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');

    // 회원가입용 상태
    const [step, setStep] = useState(0); // 0:id, 1:pw, 2:pwConfirm, 3:email, 4:optionals
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [email, setEmail] = useState('');
    const [gender, setGender] = useState<Gender | undefined>(undefined);
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');

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
        setLoading(true);
        try {
            if (!id.trim() || !password) throw new Error('아이디와 비밀번호를 입력하세요');
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
        if (step === 1) {
            if (!password || password.length < 8) return setErr('비밀번호는 8자 이상이어야 합니다');
            return setStep(2);
        }
        if (step === 2) {
            if (!passwordConfirm) return setErr('비밀번호 확인을 입력하세요');
            if (passwordConfirm !== password) return setErr('비밀번호가 일치하지 않습니다');
            return setStep(3);
        }
        if (step === 3) {
            if (!email.trim()) return setErr('이메일을 입력하세요');
            // 간단한 형식 체크(선택)
            const simple = /.+@.+\..+/;
            if (!simple.test(email.trim())) return setErr('올바른 이메일 형식이 아닙니다');
            return setStep(4);
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
            if (payload.age !== undefined && (isNaN(payload.age) || payload.age <= 0)) throw new Error('나이는 양수여야 합니다');
            if (payload.height !== undefined && (isNaN(payload.height) || payload.height <= 0)) throw new Error('키는 양수여야 합니다');
            if (payload.weight !== undefined && (isNaN(payload.weight) || payload.weight <= 0)) throw new Error('체중은 양수여야 합니다');

            await signUp(payload);
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
                    <Text style={styles.title}>아이디</Text>
                    <TextInput
                        placeholder="아이디"
                        autoCapitalize="none"
                        value={id}
                        onChangeText={setId}
                        style={styles.input}
                    />
                </>
            );
        }
        if (step === 1) {
            return (
                <>
                    <Text style={styles.title}>비밀번호</Text>
                    <TextInput
                        placeholder="비밀번호(8자 이상)"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        style={styles.input}
                    />
                </>
            );
        }
        if (step === 2) {
            return (
                <>
                    <Text style={styles.title}>비밀번호 확인</Text>
                    <TextInput
                        placeholder="비밀번호 확인"
                        secureTextEntry
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        style={styles.input}
                    />
                </>
            );
        }
        if (step === 3) {
            return (
                <>
                    <Text style={styles.title}>이메일</Text>
                    <TextInput
                        placeholder="이메일"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                        style={styles.input}
                    />
                </>
            );
        }
        // step 4: 선택 정보
        return (
            <>
                <Text style={styles.title}>선택 정보</Text>
                <View style={styles.row}>
                    <Button title={`성별: ${gender ?? '선택안함'}`} onPress={() => {
                        // 간단 토글: undefined -> 'male' -> 'female' -> 'other' -> undefined
                        const order: (Gender | undefined)[] = [undefined, 'male', 'female', 'other'];
                        const idx = order.indexOf(gender);
                        setGender(order[(idx + 1) % order.length]);
                    }} />
                </View>
                <TextInput
                    placeholder="나이(선택)"
                    keyboardType="number-pad"
                    value={age}
                    onChangeText={setAge}
                    style={styles.input}
                />
                <TextInput
                    placeholder="키(cm, 선택)"
                    keyboardType="number-pad"
                    value={height}
                    onChangeText={setHeight}
                    style={styles.input}
                />
                <TextInput
                    placeholder="체중(kg, 선택)"
                    keyboardType="number-pad"
                    value={weight}
                    onChangeText={setWeight}
                    style={styles.input}
                />
            </>
        );
    };

    return (
        <View style={styles.container}>
            {mode === 'signin' ? (
                <>
                    <Text style={styles.title}>로그인</Text>
                    <TextInput
                        placeholder="아이디"
                        autoCapitalize="none"
                        value={id}
                        onChangeText={setId}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="비밀번호"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        style={styles.input}
                    />
                    {err ? <Text style={styles.error}>{err}</Text> : null}
                    <Button title={loading ? '처리중...' : '로그인'} onPress={onLogin} disabled={loading} />
                    <View style={styles.switchRow}>
                        <Text>계정이 없나요? </Text>
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
                    <View style={styles.row}>
                        {step > 0 && (
                            <Button title="뒤로" onPress={onSignupBack} disabled={loading} />
                        )}
                        {step < 4 ? (
                            <Button title={loading ? '처리중...' : '다음'} onPress={onSignupNext} disabled={loading} />
                        ) : (
                            <Button title={loading ? '처리중...' : '회원가입 완료'} onPress={onSignupSubmit} disabled={loading} />
                        )}
                    </View>
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
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
    switchRow: { flexDirection: 'row', marginTop: 12 },
    link: { color: '#007AFF' },
    error: { color: 'red', marginBottom: 8 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
});