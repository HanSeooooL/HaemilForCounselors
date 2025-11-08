import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView, UIManager, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { fetchExamScores, type ExamScoreEntry } from '../api';

// SVGs as components (requires react-native-svg-transformer and metro config)
import SafeIcon from '../../assets/safe-icon.svg';
import CautionIcon from '../../assets/caution-icon.svg';
import DangerIcon from '../../assets/danger-icon.svg';

// import LineChart at runtime only (avoid Jest parse errors for ESM libs)
let LineChart: any;

// Question names mapping (1-based index)
const QUESTION_NAMES = [
  '우울한 기분',
  '죄책감',
  '자살',
  '초기 불면증',
  '중기 불면증',
  '말기 불면증',
  '일과 활동',
  '지체',
  '초조',
  '정신적 불안',
  '신체적 불안',
  '위장관계 신체증상',
  '전반적인 신체증상',
  '성적인 증상',
  '건강염려증',
  '체중감소A',
  '체중감소B',
  '병식',
];

export default function TrendsScreen() {
  const insets = useSafeAreaInsets();
  const [chartLoaded, setChartLoaded] = useState(false);
  const [svgAvailable, setSvgAvailable] = useState<boolean | null>(null);
  // modal for per-question trends
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  // per-question statistics for selected index
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ExamScoreEntry[] | null>(null);

  // import chart lib dynamically
  useEffect(() => {
    // try to dynamically load chart lib; ignore failures (e.g., during Jest runs)
    let mountedChart = true;
    (async () => {
      try {
        const mod = await import('react-native-chart-kit');
        LineChart = mod.LineChart ?? (mod as any).default?.LineChart ?? mod.default ?? mod;
        if (mountedChart) setChartLoaded(true);
      } catch (e) {
        // fail silently; chart simply won't render in test environment
      }
    })();
    // check native SVG view availability (RNSVGSvgView)
    try {
      // UIManager.getViewManagerConfig may throw or return undefined if not available
      const cfg = UIManager.getViewManagerConfig ? UIManager.getViewManagerConfig('RNSVGSvgView') : (UIManager as any).RNSVGSvgView;
      setSvgAvailable(Boolean(cfg));
    } catch (err) {
      setSvgAvailable(false);
    }
    return () => { mountedChart = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setError('로그인이 필요합니다');
        setEntries(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExamScores(token);
        if (!mounted) return;
        setEntries(data);
      } catch (e: any) {
        if (!mounted) return;
        console.error('[TrendsScreen] fetchExamScores failed', e);
        // classify known errors
        const msg = e?.message ?? '데이터를 불러오는 중 오류가 발생했습니다';
        setError(msg);
        setEntries(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const sorted = useMemo(() => {
    if (!entries) return [] as ExamScoreEntry[];
    return [...entries].sort((a, b) => a.timestamp - b.timestamp);
  }, [entries]);

  // per-question statistics for selected index (move after `sorted` is available)
  const questionStats = useMemo(() => {
    if (!sorted || sorted.length === 0) return null as null | {
      vals: number[];
      latest: number | null;
      previous: number | null;
      avg: number | null;
      max: number | null;
      min: number | null;
      delta: number | null;
    };
    const vals = sorted.map((it) => {
      const v = Array.isArray(it.scores) && typeof it.scores[selectedQuestionIndex] !== 'undefined' ? it.scores[selectedQuestionIndex] : 0;
      return Number.isFinite(v) ? Number(v) : 0;
    });
    const latest = vals.length ? vals[vals.length - 1] : null;
    const previous = vals.length >= 2 ? vals[vals.length - 2] : null;
    const sum = vals.reduce((s, v) => s + v, 0);
    const avg = vals.length ? Math.round((sum / vals.length) * 10) / 10 : null;
    const max = vals.length ? Math.max(...vals) : null;
    const min = vals.length ? Math.min(...vals) : null;
    const delta = (latest != null && previous != null) ? (latest - previous) : null;
    return { vals, latest, previous, avg, max, min, delta };
  }, [sorted, selectedQuestionIndex]);

  // Ensure chart shows oldest -> newest from left -> right
  const chartData = useMemo(() => {
    if (!sorted || sorted.length === 0) return null;
    // sorted is already ascending by timestamp
    const labels = sorted.map((it) => formatYMD(it.timestamp));
    const data = sorted.map((it) => it.scores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0));
    return { labels, data };
  }, [sorted]);

  // Determine latest sum (most recent entry)
  const latestSum = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return null as number | null;
    return chartData.data[chartData.data.length - 1];
  }, [chartData]);

  // Determine previous sum (one before the most recent)
  const previousSum = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length < 2) return null as number | null;
    return chartData.data[chartData.data.length - 2];
  }, [chartData]);

  // Latest raw entry (most recent)
  const latestEntry = useMemo(() => {
    if (!sorted || sorted.length === 0) return null as ExamScoreEntry | null;
    return sorted[sorted.length - 1];
  }, [sorted]);

  // Find the top question index (1-based) for the latest entry.
  // If multiple questions share the top score, pick the one with the largest question number (내림차순에서 가장 먼저 오는 문항).
  const topQuestion = useMemo(() => {
    if (!latestEntry || !Array.isArray(latestEntry.scores) || latestEntry.scores.length === 0) return null as { question: number; score: number } | null;
    const scores = latestEntry.scores.map((v) => (Number.isFinite(v) ? v : 0));
    const maxScore = Math.max(...scores);
    const indices: number[] = [];
    scores.forEach((v, i) => { if (v === maxScore) indices.push(i); });
    if (indices.length === 0) return null;
    // Choose the smallest question number among ties (오름차순에서 가장 먼저 오는 문항)
    const chosenIndex = Math.min(...indices);
    return { question: chosenIndex + 1, score: maxScore };
  }, [latestEntry]);

  // Compare latest and previous sums and return a message
  function getTrendMessage(latest: number | null, previous: number | null) {
    if (latest == null || previous == null) return null;
    if (latest > previous) return '지난 회기에 비해 우울증 점수가 상승했어요';
    if (latest < previous) return '지난 회기에 비해 우울증 점수가 감소했어요';
    return '지난 회기와 우울증 점수가 동일합니다';
  }

  // Icon selection based on latestSum
  function pickIconForSum(sum: number | null) {
    if (sum == null) return { type: 'safe', Comp: SafeIcon };
    if (sum <= 6) return { type: 'safe', Comp: SafeIcon };
    if (sum <= 17) return { type: 'caution', Comp: CautionIcon };
    return { type: 'danger', Comp: DangerIcon };
  }

  // Determine risk label from sum
  function getRiskLabel(sum: number | null) {
    if (sum == null) return { label: '측정된 점수가 없습니다', color: '#666', weight: '600' as const };
    if (sum <= 6) return { label: '안전', color: '#1DB954', weight: '800' as const };
    if (sum <= 17) return { label: '조금 위험', color: '#FFB648', weight: '800' as const };
    return { label: '매우 위험', color: '#FF4C4C', weight: '800' as const };
  }

  // Simple Icon renderer that tries to render imported component
  function IconRenderer({ Comp, size = 160 }: { Comp: any; size?: number }) {
    try {
      if (Comp && typeof Comp === 'function') {
        const SvgComp = Comp as any;
        return <SvgComp width={size} height={size} />;
      }
    } catch (e) {
      // swallow
    }

    // Fallback circle
    const color = '#1DB954';
    return (
      <View style={[styles.fallbackIcon, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: (size * 0.6) / 2, backgroundColor: 'white' }} />
      </View>
    );
  }

  function formatYMD(ts: number): string {
    if (!ts) return '알 수 없는 날짜';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '알 수 없는 날짜';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  if (!token) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.message}>로그인이 필요합니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>우울증 추이</Text>
      </View>

      {loading ? (
        <View style={styles.containerCenter}>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>불러오는 중…</Text>
        </View>
      ) : error ? (
        <View style={styles.containerCenter}>
          <Text style={[styles.message, { color: 'red' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => {
            // simple retry by re-triggering effect: change entries to null then effect runs due to token dependency? we'll simply call fetch directly
            (async () => {
              setLoading(true); setError(null);
              try {
                const data = await fetchExamScores(token!);
                setEntries(data);
              } catch (e: any) {
                console.error(e);
                setError(e?.message ?? '불러오기 실패');
              } finally { setLoading(false); }
            })();
          }}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : entries && entries.length === 0 ? (
        <View style={styles.containerCenter}>
          <Text style={styles.message}>저장된 우울증 점수가 없습니다.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>

          {/* 중앙 대형 아이콘 영역: 최신 합계 점수 기준으로 아이콘 선택 */}
          <View style={styles.centerIconWrap}>
            {
              (() => {
                const picked = pickIconForSum(latestSum);
                return <IconRenderer Comp={picked.Comp} size={160} />;
              })()
            }
            <View style={{ height: 12 }} />
            {/* 위험도 라벨: latestSum 기준 */}
            {(() => {
              const r = getRiskLabel(latestSum);
              return (
                <Text style={[styles.riskLabel, { color: r.color, fontWeight: r.weight }]}>{r.label}</Text>
              );
            })()}
            <Text style={styles.centerScore}>{latestSum == null ? '-' : `${latestSum}점`}</Text>
            {/* 최근 회차와 직전 회차 비교 메시지 */}
            {(() => {
              const t = getTrendMessage(latestSum, previousSum);
              return t ? <Text style={styles.trendText}>{t}</Text> : null;
            })()}

            {/* 최신 회차에서 가장 높은 점수를 받은 문항 표시 */}
            {(() => {
              if (!topQuestion) return null;
              const name = (topQuestion.question && QUESTION_NAMES[topQuestion.question - 1]) || `${topQuestion.question}번`;
              return <Text style={styles.topQuestion}>이번 회차에서 가장 영향을 많이 받은 문항은 {name}이에요</Text>;
            })()}

            {/* 문항별 추이 조회 버튼 */}
            <TouchableOpacity
              style={styles.questionTrendBtn}
              onPress={() => {
                // open modal and default select topQuestion if available
                if (topQuestion && topQuestion.question) setSelectedQuestionIndex(topQuestion.question - 1);
                else setSelectedQuestionIndex(0);
                setModalVisible(true);
              }}
            >
              <Text style={styles.questionTrendBtnText}>문항별 추이 조회</Text>
            </TouchableOpacity>
          </View>

          {chartData && chartLoaded && LineChart && svgAvailable ? (
            <View style={{ alignItems: 'center' }}>
              <LineChart
                data={{ labels: chartData.labels, datasets: [{ data: chartData.data }] }}
                width={Math.min(Dimensions.get('window').width - 32, 800)}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#fbfbff',
                  backgroundGradientTo: '#f2f6ff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  propsForDots: { r: '3', strokeWidth: '1', stroke: '#007AFF' },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 8 }}
              />
            </View>
          ) : null}

          {/* If chartData exists but native svg is missing, show a helpful message */}
          {chartData && (svgAvailable === false) ? (
            <View style={[styles.containerCenter, { paddingVertical: 16 }] }>
              <Text style={[styles.message, { color: '#cc3b3b' }]}>차트를 표시할 수 없습니다: 네이티브 SVG 모듈이 연결되어 있지 않습니다.</Text>
              <Text style={[styles.message, { fontSize: 12, marginTop: 8 }]}>iOS: ios 디렉터리에서 pod install 후 앱을 재빌드하거나, Android: 앱을 클린 빌드하세요.</Text>
            </View>
          ) : null}

          {/* List of entries below chart */}
          {sorted.map((item) => {
            const label = formatYMD(item.timestamp);
            const sum = item.scores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
            return (
              <View key={`${item.userid}-${item.timestamp}`} style={styles.entry}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryUser}>{item.userid}</Text>
                  <Text style={styles.entryDate}>{label}</Text>
                </View>
                <Text style={styles.entryScores}>점수(18문항): {item.scores.join(', ')}</Text>
                <Text style={styles.entrySummary}>합계: {sum}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal: per-question trend */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        // Make modal fullscreen
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* apply top padding using safe-area inset so header/close are tappable below status bar/notch */}
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.modalContentFull, { paddingTop: insets.top + 12 }] }>
            <View style={[styles.modalHeader, { paddingTop: 4 }]}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>문항별 점수 추이</Text>
              {/* increase pressable touch area */}
              <Pressable onPress={() => setModalVisible(false)} style={[styles.modalClose, { paddingHorizontal: 12, paddingVertical: 8 }]} hitSlop={10}>
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>닫기</Text>
              </Pressable>
            </View>

            {/* question selector (horizontal) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.questionSelector} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {QUESTION_NAMES.map((n, idx) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.qBtn, idx === selectedQuestionIndex ? styles.qBtnSelected : null]}
                  onPress={() => setSelectedQuestionIndex(idx)}
                >
                  <Text style={[styles.qBtnText, idx === selectedQuestionIndex ? styles.qBtnTextSelected : null]} numberOfLines={1}>{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 통계 요약 */}
            {questionStats ? (
              <View>
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { position: 'relative' }]}>
                    <Text style={styles.statLabel}>최신값</Text>
                    <Text style={styles.statValue}>{questionStats.latest == null ? '-' : `${questionStats.latest}점`}</Text>
                    {/* small badge showing trend: ▲ 상승(빨강), ▼ 감소(초록), — 동일(회색) */}
                    {(() => {
                      const d = questionStats.delta;
                      const badgeChar = d == null ? '—' : d > 0 ? '▲' : d < 0 ? '▼' : '—';
                      const badgeStyle = d == null ? styles.neutralBadge : d > 0 ? styles.positiveBadge : d < 0 ? styles.negativeBadge : styles.neutralBadge;
                      return (
                        <View style={[styles.statBadge, badgeStyle]}>
                          <Text style={styles.statBadgeText}>{badgeChar}</Text>
                        </View>
                      );
                    })()}
                  </View>
                   <View style={styles.statCard}><Text style={styles.statLabel}>평균</Text><Text style={styles.statValue}>{questionStats.avg == null ? '-' : `${questionStats.avg}점`}</Text></View>
                   <View style={styles.statCard}><Text style={styles.statLabel}>최고</Text><Text style={styles.statValue}>{questionStats.max == null ? '-' : `${questionStats.max}점`}</Text></View>
                   <View style={styles.statCard}><Text style={styles.statLabel}>최저</Text><Text style={styles.statValue}>{questionStats.min == null ? '-' : `${questionStats.min}점`}</Text></View>
                 </View>
                {questionStats.delta != null ? (
                  <Text style={[styles.changeText, questionStats.delta > 0 ? styles.positive : questionStats.delta < 0 ? styles.negative : null]}>
                    {questionStats.delta > 0 ? `지난 회기에 비해 ${questionStats.delta}점 상승` : questionStats.delta < 0 ? `지난 회기에 비해 ${Math.abs(questionStats.delta)}점 감소` : '지난 회기와 동일'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* chart area */}
            <View style={{ flex: 1, paddingTop: 12 }}>
              {chartLoaded && LineChart && svgAvailable ? (
                (() => {
                  const labels = sorted.map((it) => formatYMD(it.timestamp));
                  const data = sorted.map((it) => {
                    const v = Array.isArray(it.scores) && typeof it.scores[selectedQuestionIndex] !== 'undefined' ? it.scores[selectedQuestionIndex] : 0;
                    return Number.isFinite(v) ? v : 0;
                  });
                  return (
                    <LineChart
                      data={{ labels, datasets: [{ data }] }}
                      // full-width friendly sizing inside fullscreen modal
                      width={Math.min(Dimensions.get('window').width * 0.96, 1400)}
                      height={420}
                      yAxisSuffix=""
                      yAxisLabel=""
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#f6fff9',
                        backgroundGradientTo: '#eefef6',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(0,122,255, ${opacity})`,
                        propsForDots: { r: '4', strokeWidth: '1', stroke: '#007AFF' },
                      }}
                      bezier
                      style={{ borderRadius: 8 }}
                    />
                  );
                })()
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <Text style={{ color: '#666' }}>차트를 표시할 수 없습니다 (네이티브 SVG 필요)</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea', backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '600', padding: 12 },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { marginTop: 8, fontSize: 14 },
  retryBtn: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#007AFF', borderRadius: 6 },
  retryText: { color: 'white', fontWeight: '600' },
  entry: { marginBottom: 12, padding: 12, borderRadius: 8, backgroundColor: '#f9f9fb', borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  entryUser: { fontWeight: '600' },
  entryDate: { color: '#666', fontSize: 12 },
  entryScores: { fontSize: 13, color: '#111' },
  entrySummary: { marginTop: 6, fontWeight: '600' },

  // new styles for center icon area
  centerIconWrap: { alignItems: 'center', paddingVertical: 20, backgroundColor: 'transparent' },
  centerLabel: { fontSize: 14, color: '#666' },
  centerScore: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  trendText: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
  topQuestion: { fontSize: 14, color: '#111', marginTop: 6, textAlign: 'center', fontWeight: '600' },
  riskLabel: { fontSize: 30, marginTop: 6 },
  questionTrendBtn: { marginTop: 10, backgroundColor: '#e8f6f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  questionTrendBtnText: { color: '#0a7f5a', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '98%', maxHeight: '94%', backgroundColor: 'white', borderRadius: 12, padding: 14, overflow: 'hidden' },
  modalContentFull: { flex: 1, width: '100%', backgroundColor: 'white', paddingTop: 12, paddingHorizontal: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalClose: { paddingHorizontal: 8, paddingVertical: 6 },
  questionSelector: { marginTop: 12, maxHeight: 40 },
  // compact question selector buttons that fit text closely
  qBtn: { paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: 6, borderRadius: 12, backgroundColor: '#f2f2f4', minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  qBtnSelected: { backgroundColor: '#007AFF' },
  qBtnText: { fontSize: 14, color: '#333', lineHeight: 18 },
  qBtnTextSelected: { color: 'white', fontWeight: '700' },
  // stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, marginHorizontal: 4, backgroundColor: '#f7fbff', borderRadius: 8 },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  changeText: { textAlign: 'center', marginTop: 8, fontSize: 13 },
  positive: { color: '#d9534f' },
  negative: { color: '#2b9f5b' },
  // badge inside stat card
  statBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  positiveBadge: { backgroundColor: '#d9534f' },
  negativeBadge: { backgroundColor: '#2b9f5b' },
  neutralBadge: { backgroundColor: '#bfc4c9' },
  fallbackIcon: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
});
