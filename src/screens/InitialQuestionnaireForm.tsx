import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppStack';
import { UserFlags } from '../storage/userFlags';
import { postFirstCheck } from '../api';
import { useAuth } from '../auth/AuthContext';
import LottieView from 'lottie-react-native';

// 설계: 각 문항은 동일한 레이아웃. options 배열의 순서는 화면 노출 순서.
// value/score 구조로 확장 가능. 현재는 label 중심.
// 문항 11은 다중 증상군에 대한 단일 중증도 선택으로 평가.

// 문항 11 중증도 옵션 정의
const Q11_SEVERITY_OPTIONS = [
  { value: 0, label: '없음' },
  { value: 1, label: '경도' },
  { value: 2, label: '중등도' },
  { value: 3, label: '고도' },
  { value: 4, label: '최고도' },
];

const QUESTIONS = [
  {
    id: 'q1',
    text: '최근 2주동안 기분이 가라앉거나,\n우울하거나 희망이 없다고\n느낀 적이 있나요?',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '4일 이상' },
      { value: 2, label: '일주일 이상' },
      { value: 3, label: '거의 매일' },
    ],
  },
  {
    id: 'q2',
    text: '내가 잘못했거나, 실패했다는 생각 혹은\n자신과 가족을 실망시켰다고 생각하신 적이 있나요?',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '4일 이상' },
      { value: 2, label: '일주일 이상' },
      { value: 3, label: '10일 이상' },
      { value: 4, label: '거의 매일' },
    ],
  },
  {
    id: 'q3',
    text: '최근 2주동안 죽고싶다는 생각 혹은\n자해할 생각을 해본 적이 있나요?',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '4일 이상' },
      { value: 2, label: '일주일 이상' },
      { value: 3, label: '10일 이상' },
      { value: 4, label: '거의 매일' },
    ],
  },
  {
    id: 'q4',
    text: '최근 2주동안 잠들기가 힘든 날이 며칠이었나요?',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '절반 이하' },
      { value: 2, label: '거의 매일' },
    ],
  },
  {
    id: 'q5',
    text: '잠에 들 때 깊게 잠들기 어려운 편이신가요?',
    options: [
      { value: 0, label: '아님' },
      { value: 1, label: '가끔 그렇다' },
      { value: 2, label: '자주 그렇다' },
    ],
  },
  {
    id: 'q6',
    text: '새벽에 이유 없이 중간에 깨셨을 때\n다시 잠들기가 어려우신 편인가요?',
    options: [
      { value: 0, label: '아님' },
      { value: 1, label: '30분 내에 잠에 든다' },
      { value: 2, label: '다시 잠에 들지 못한다' },
    ],
  },
  {
    id: 'q7',
    text: '해야 하는 일(공부, 직장 등)을 할 때\n몸이 무겁거나 피로하다고 느껴지시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
    ],
  },
  // 조건부 문항 7-1: q7이 "그렇다"일 때만 노출
  {
    id: 'q7_1',
    text: '일이나 취미 활동에 대한 흥미가 사라졌나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
    ],
    showIf: (answers: Record<string, any>) => answers.q7 === 1,
  },
  // 조건부 문항 7-2: q7_1이 "그렇다"일 때만 노출
  {
    id: 'q7_2',
    text: '최근 2주동안 일에 집중하지 못한 날이 며칠인가요?',
    options: [
      { value: 0, label: '거의 없다' },
      { value: 1, label: '3일 이상 일주일 이하' },
      { value: 2, label: '일주일 이상' },
    ],
    showIf: (answers: Record<string, any>) => answers.q7_1 === 1,
  },
  // 문항 8: 느려짐에 대한 타인지적
  {
    id: 'q8',
    text: '주위 사람들로부터 평소보다 말이나 행동이 느려진 것 같다는 이야기를 들으신 적이 있으신가요?',
    options: [
      { value: 0, label: '전혀 아니다' },
      { value: 1, label: '아니다' },
      { value: 2, label: '가끔 그렇다' },
      { value: 3, label: '그렇다' },
      { value: 4, label: '매우 그렇다' },
    ],
  },
  // 문항 9: 안절부절/과다운동성 자각
  {
    id: 'q9',
    text: '다른 사람이 눈치챌 정도로 안절부절 못하고 가만히 있지 못하고 몸을 자꾸 움직이시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '가끔 그렇다' },
      { value: 2, label: '그렇다' },
      { value: 3, label: '자주 그렇다' },
      { value: 4, label: '매우 그렇다' },
    ],
  },
  // 문항 10: 긴장/공포 경험
  {
    id: 'q10',
    text: '주기적으로 긴장감 혹은 알 수 없는 공포를 느끼시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '가끔 그렇다' },
      { value: 2, label: '그렇다' },
      { value: 3, label: '자주 그렇다' },
      { value: 4, label: '매우 그렇다' },
    ],
  },
  // 문항 11: 다중 신체증상 중증도 평가 (단일 선택)
  {
    id: 'q11',
    text: '다음에 해당되는 신체증상들 중 영향을 받고 있는지,\n받고 있다면 얼마나 받으시나요?\n(증상: 입마름, 방귀, 소화불량, 설사, 심한 복통, 트림, 심계항진, 두통, 과호흡, 한숨, 빈뇨, 발한)\n하나라도 해당되면 전체적으로 어느 정도 영향을 받는지 선택해주세요.',
    options: Q11_SEVERITY_OPTIONS,
  },
  // 문항 12: 식욕 저하/속 더부룩함 빈도
  {
    id: 'q12',
    text: '최근 2주동안 입맛이 없어 끼니를 거르거나\n속이 더부룩하다고 느끼신 적이 있나요?',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '일주일 이하' },
      { value: 2, label: '거의 매일' },
    ],
  },
  // 문항 13: 신체 무거움/통증 빈도 평가
  {
    id: 'q13',
    text: '몸이 무겁다고 느끼시거나 통증(두통, 근육통 등)을 자주 느끼시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
      { value: 2, label: '매우 그렇다' },
    ],
  },
  // 문항 14: 성적 증상 평가
  {
    id: 'q14',
    text: '성욕 감퇴, 월경 불순 등의 성적인 증상이 있다.',
    options: [
      { value: 0, label: '없음' },
      { value: 1, label: '그렇다' },
      { value: 2, label: '매우 그렇다' },
    ],
  },
  // 문항 15: 신체 건강 관심도 평가
  {
    id: 'q15',
    text: '나는 내 몸 건강에 관심이 많다.',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
      { value: 2, label: '매우 그렇다' },
    ],
  },
  // 조건부 문항 15-1: q15가 "매우 그렇다"일 때만 노출
  {
    id: 'q15_1',
    text: '나는 내 건강이 좋지 않다고 느낀다.',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
      { value: 2, label: '매우 그렇다' },
    ],
    showIf: (answers: Record<string, any>) => answers.q15 === 2,
  },
  // 문항 16: 최근 2주 체중 변화 정도
  {
    id: 'q16',
    text: '최근 2주동안 어느정도의 체중 변화가 있으셨나요?',
    options: [
      { value: 0, label: '0.5kg 미만' },
      { value: 1, label: '1kg 미만' },
      { value: 2, label: '1kg 이상' },
    ],
  },
  // 문항 17: 마음의 병 자각 여부
  {
    id: 'q17',
    text: '현재 본인에게 마음의 병이 있다고 생각하시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '잘 모르겠다' },
      { value: 2, label: '그렇다' },
    ],
  },
  // 조건부 문항 17-1: q17이 "그렇다"일 때만 노출
  {
    id: 'q17_1',
    text: '마음의 병의 원인이 내면의 문제가 아닌 외부(음식, 날씨, 과로 등)의 문제가 원인이라고 생각하시나요?',
    options: [
      { value: 0, label: '아니다' },
      { value: 1, label: '그렇다' },
    ],
    showIf: (answers: Record<string, any>) => answers.q17 === 2,
  },
];

export function aggregateAnswers(answers: Record<string, any>): Record<string, number> {
  // parent -> { parent: number; children: number }
  const grouped: Record<string, { parent: number; children: number }> = {};
  for (const [key, rawVal] of Object.entries(answers)) {
    if (typeof rawVal !== 'number') continue;
    const childMatch = key.match(/^(q\d+)_\d+$/);
    if (childMatch) {
      const parentKey = childMatch[1];
      if (!grouped[parentKey]) grouped[parentKey] = { parent: 0, children: 0 };
      grouped[parentKey].children += rawVal;
    } else {
      if (!grouped[key]) grouped[key] = { parent: 0, children: 0 };
      grouped[key].parent = rawVal;
    }
  }
  const aggregated: Record<string, number> = {};
  for (const [parentKey, { parent, children }] of Object.entries(grouped)) {
    aggregated[parentKey] = parent + children;
  }
  return aggregated;
}

export default function InitialQuestionnaireForm() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { token } = useAuth();
  const [index, setIndex] = useState(0); // 질문 인덱스 (요약 화면은 별도 state)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showSummary, setShowSummary] = useState(false); // 최종 제출 화면
  const [submitting, setSubmitting] = useState(false);

  const visibleQuestions = useMemo(() => QUESTIONS.filter(q => !("showIf" in q) || (q as any).showIf(answers)), [answers]);

  // index가 visibleQuestions 범위를 벗어나지 않도록 보정
  useEffect(() => {
    if (!showSummary && index >= visibleQuestions.length) {
      setIndex(visibleQuestions.length - 1);
    }
  }, [visibleQuestions, index, showSummary]);

  const current = visibleQuestions[index];

  const handleSelect = useCallback((val: number) => {
    // q11 단일 선택 포함 일반 처리
    setAnswers(prev => {
      const next: Record<string, any> = { ...prev, [current.id]: val };
      if (current.id === 'q7' && val === 0) {
        delete next.q7_1;
        delete next.q7_2;
      }
      if (current.id === 'q7_1' && val === 0) {
        delete next.q7_2;
      }
      // q15가 조건을 해제(0 또는 1)하면 q15_1 답변 제거
      if (current.id === 'q15' && val !== 2) {
        delete next.q15_1;
      }
      // q17이 조건을 해제(0 또는 1)하면 q17_1 답변 제거
      if (current.id === 'q17' && val !== 2) {
        delete next.q17_1;
      }
      const nextVisible = QUESTIONS.filter(q => !("showIf" in q) || (q as any).showIf(next));
      const currentIsLast = nextVisible[nextVisible.length - 1].id === current.id;
      if (currentIsLast) {
        setShowSummary(true);
      } else {
        setShowSummary(false);
        setIndex(i => i + 1);
      }
      return next;
    });
  }, [current]);

  const goPrev = () => {
    if (showSummary) {
      setShowSummary(false);
      setTimeout(() => setIndex(visibleQuestions.length - 1), 0);
      return;
    }
    if (index > 0) setIndex(i => i - 1);
  };

  const onSubmit = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const aggregated = aggregateAnswers(answers);
      // Auth 토큰(JWT) 확보
      if (!token) throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
      const payload = { jwt: token, ...aggregated };
      await postFirstCheck(payload);
      await UserFlags.setInitialQuestionnaireCompleted();
      Alert.alert('제출 완료', '감사합니다. 홈으로 이동합니다.', [
        { text: '확인', onPress: () => navigation.replace('RootTabs') }
      ]);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <Text style={styles.questionTitle}>{showSummary ? '제출 전 확인' : `문항 ${index + 1}`}</Text>
          {(index > 0 || showSummary) && (
            <TouchableOpacity onPress={goPrev} hitSlop={8} style={styles.prevBtn}><Text style={styles.prevBtnText}>이전</Text></TouchableOpacity>
          )}
        </View>
        {/* Lottie 안내 애니메이션 */}
        <View style={styles.lottieWrapper}>
          <LottieView
            source={require('../../assets/firstcheck-icon.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>
        {/* 본문 */}
        {!showSummary && (
          <>
            <Text style={styles.questionText}>{current.text}</Text>
            <View style={{ height: 32 }} />
            {/* 단일 선택 문항 (모든 문항 공용) */}
            {current.options && current.options.map(opt => {
              const selected = typeof answers[current.id] === 'number' && answers[current.id] === opt.value;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                  activeOpacity={0.85}
                  onPress={() => handleSelect(opt.value)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {showSummary && (
          <View style={styles.summaryWrapper}>
            <Text style={styles.summaryText}>모든 문항에 답변하셨습니다. 제출하기를 눌러 완료해주세요.</Text>
            <View style={{ height: 24 }} />
            <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} activeOpacity={0.9} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? '전송 중...' : '제출하기'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  questionTitle: { fontSize: 36, fontWeight: '900', color: '#111' },
  prevBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  prevBtnText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  questionText: { fontSize: 18, lineHeight: 26, fontWeight: '500', color: '#333', marginTop: 24 },
  optionBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#94AF78', borderRadius: 10, paddingVertical: 18, paddingHorizontal: 16, marginBottom: 14 },
  optionBtnSelected: { backgroundColor: '#94AF78' },
  optionText: { fontSize: 18, textAlign: 'center', fontWeight: '600', color: '#111' },
  optionTextSelected: { color: '#fff' },
  submitBtn: { backgroundColor: '#8FAF6B', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  summaryWrapper: { marginTop: 40 },
  summaryText: { fontSize: 16, lineHeight: 24, color: '#222', fontWeight: '500' },
  lottieWrapper: { marginTop: 12, alignItems: 'center' },
  lottie: { width: 160, height: 160 },
});
