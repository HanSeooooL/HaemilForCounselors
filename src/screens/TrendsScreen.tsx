import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView, Modal, Pressable, Animated, Easing, Image } from 'react-native';
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
  // modal for per-question trends
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [tooltip, setTooltip] = useState<{ index: number; value: number; label: string; x?: number; y?: number; context: 'main' | 'modal' } | null>(null);
  // animated value for tooltip (0 = hidden, 1 = visible)
  const tooltipAnim = React.useRef(new Animated.Value(0)).current;
  // measured wrapper widths to correctly position tooltip when chart is centered
  const [mainChartWrapperWidth, setMainChartWrapperWidth] = useState<number | null>(null);
  const [modalChartWrapperWidth, setModalChartWrapperWidth] = useState<number | null>(null);
  // dot radius used by chartConfig.propsForDots.r (string) -> numeric constant used for tooltip offset
  const DOT_RADIUS = 6;
  // small compensation to account for internal axis reserved gaps by the chart lib
  const AXIS_COMP = 12;
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

  // clear tooltip when selection changes or modal visibility changes
  useEffect(() => { setTooltip(null); }, [selectedQuestionIndex, modalVisible]);

  // animate tooltip visibility (fade + scale)
  useEffect(() => {
    Animated.timing(tooltipAnim, {
      toValue: tooltip ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tooltip, tooltipAnim]);

  // common chart configuration for a cleaner look
  const chartConfig = useMemo(() => ({
    // make chart background transparent (we'll show only a gray outline)
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    // ensure gradients are fully transparent (some platforms render 'transparent' as black unless opacity is set)
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(2,122,255, ${opacity})`, // main line color
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#ffffff' },
    propsForBackgroundLines: { stroke: '#e6eef0' },
    // disable the area fill shadow under the line (set opacity to 0)
    fillShadowGradient: 'transparent',
    fillShadowGradientOpacity: 0,
  }), []);

  // Ensure chart shows oldest -> newest from left -> right
  const chartData = useMemo(() => {
    if (!sorted || sorted.length === 0) return null;
    // sorted is already ascending with
    const labels = sorted.map((it) => formatYMD(it.timestamp));
    const data = sorted.map((it) => it.scores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0));
    return { labels, data };
  }, [sorted]);

  const latestSum = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return null;
    return chartData.data[chartData.data.length - 1];
  }, [chartData]);

  const previousSum = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length < 2) return null;
    return chartData.data[chartData.data.length - 2];
  }, [chartData]);

  const latestEntry = useMemo(() => {
    if (!sorted || sorted.length === 0) return null;
    return sorted[sorted.length - 1];
  }, [sorted]);

  const topQuestion = useMemo(() => {
    if (!latestEntry || !Array.isArray(latestEntry.scores) || latestEntry.scores.length === 0) return null;
    const scores = latestEntry.scores.map((v) => (Number.isFinite(v) ? v : 0));
    const maxScore = Math.max(...scores);
    const indices: number[] = [];
    scores.forEach((v, i) => { if (v === maxScore) indices.push(i); });
    if (indices.length === 0) return null;
    const chosenIndex = Math.min(...indices);
    return { question: chosenIndex + 1, score: maxScore };
  }, [latestEntry]);

  function getTrendMessage(latest: number | null, previous: number | null) {
    if (latest == null || previous == null) return null;
    if (latest > previous) return '지난 회기에 비해 우울증 점수가 상승했어요';
    if (latest < previous) return '지난 회기에 비해 우울증 점수가 감소했어요';
    return '지난 회기와 우울증 점수가 동일합니다';
  }

  function pickIconForSum(sum: number | null) {
    if (sum == null) return { type: 'safe', Comp: SafeIcon };
    if (sum <= 6) return { type: 'safe', Comp: SafeIcon };
    if (sum <= 17) return { type: 'caution', Comp: CautionIcon };
    return { type: 'danger', Comp: DangerIcon };
  }

  function getRiskLabel(sum: number | null) {
    if (sum == null) return { label: '측정된 점수가 없습니다', color: '#666', weight: '600' as const };
    if (sum <= 6) return { label: '안전', color: '#1DB954', weight: '800' as const };
    if (sum <= 17) return { label: '조금 위험', color: '#FFB648', weight: '800' as const };
    return { label: '매우 위험', color: '#FF4C4C', weight: '800' as const };
  }

  function IconRenderer({ Comp, size = 160 }: { Comp: any; size?: number }) {
    try {
      if (Comp && typeof Comp === 'function') {
        const SvgComp = Comp as any;
        return <SvgComp width={size} height={size} />;
      }
    } catch (e) { }
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
      <View style={styles.containerCenter}><Text style={styles.message}>로그인이 필요합니다.</Text></View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image source={require('../../assets/Haemil-Logo-icon.png')} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>우울증 추이</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.containerCenter}><ActivityIndicator size="large" /><Text style={styles.message}>불러오는 중…</Text></View>
      ) : error ? (
        <View style={styles.containerCenter}><Text style={[styles.message, { color: 'red' }]}>{error}</Text></View>
      ) : entries && entries.length === 0 ? (
        <View style={styles.containerCenter}><Text style={styles.message}>저장된 우울증 점수가 없습니다.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>

          <View style={styles.centerIconWrap}>
            {(() => { const picked = pickIconForSum(latestSum); return <IconRenderer Comp={picked.Comp} size={160} />; })()}
            <View style={{ height: 12 }} />
            {(() => { const r = getRiskLabel(latestSum); return (<Text style={[styles.riskLabel, { color: r.color, fontWeight: r.weight }]}>{r.label}</Text>); })()}
            <Text style={styles.centerScore}>{latestSum == null ? '-' : `${latestSum}점`}</Text>
            {(() => { const t = getTrendMessage(latestSum, previousSum); return t ? <Text style={styles.trendText}>{t}</Text> : null; })()}
            {(() => { if (!topQuestion) return null; const name = (topQuestion.question && QUESTION_NAMES[topQuestion.question - 1]) || `${topQuestion.question}번`; return <Text style={styles.topQuestion}>이번 회차에서 가장 영향을 많이 받은 문항은 {name}이에요</Text>; })()}
            <TouchableOpacity style={styles.questionTrendBtn} onPress={() => { if (topQuestion && topQuestion.question) setSelectedQuestionIndex(topQuestion.question - 1); else setSelectedQuestionIndex(0); setModalVisible(true); }}>
              <Text style={styles.questionTrendBtnText}>문항별 추이 조회</Text>
            </TouchableOpacity>
          </View>

          {chartData && chartLoaded && LineChart ? (() => {
            const mainChartWidth = Math.min(Dimensions.get('window').width - 32, 800);
            const labels = chartData.labels;
            const data = chartData.data;
            return (
              <View style={{ position: 'relative', alignItems: 'center' }} onLayout={(e) => setMainChartWrapperWidth(e.nativeEvent.layout.width)}>
                <Text style={styles.mainChartTitle}>우울증 점수 추이</Text>
                {(() => {
                  const P = 12;
                  // increase SHIFT beyond AXIS_COMP to estimate internal left reserved gap
                  const SHIFT = AXIS_COMP + 8; // estimated reserved amount
                  const SHIFT_HALF = SHIFT / 2; // apply half-shift so we can keep padLeft == padRight
                  const padLeft = P;
                  const padRight = P; // keep left/right visual padding symmetric
                  // compute inner width considering both paddings and AXIS_COMP reserved area
                  const innerWidth = Math.max(40, mainChartWidth - padLeft - padRight - AXIS_COMP);
                  return (
                    <View style={{ width: mainChartWidth, borderRadius: 8, borderWidth: 1, borderColor: '#e5e5ea', backgroundColor: 'transparent', paddingLeft: padLeft, paddingRight: padRight, paddingVertical: P, marginVertical: 8 }}>
                      <LineChart
                         data={{ labels, datasets: [{ data }] }}
                         width={innerWidth}
                         height={220}
                         yAxisLabel=""
                         yAxisSuffix=""
                         chartConfig={chartConfig}
                         bezier
                        // keep chart compact inside wrapper: remove internal margins reserved for axis labels
                        // move chart LEFT by half SHIFT so plotted line sits visually centered inside wrapper
                        style={{ borderRadius: 6, backgroundColor: 'transparent', margin: 0, padding: 0, transform: [{ translateX: -SHIFT_HALF }], marginLeft: -(AXIS_COMP + padLeft - SHIFT_HALF) }}
                        // aggressively collapse any axis reserved space (make more negative to fully collapse)
                        formatYLabel={() => ''}
                        formatXLabel={() => ''}
                        yLabelsOffset={-100}
                        xLabelsOffset={-10}
                         withShadow={false}
                         withInnerLines={false}
                         withVerticalLines={false}
                         withHorizontalLabels={false}
                         withVerticalLabels={false}
                         onDataPointClick={(pt: any) => {
                           const idx = typeof pt.index === 'number' ? pt.index : Number(pt?.index ?? 0);
                           const label = formatYMD(sorted[idx]?.timestamp ?? 0) || (chartData?.labels?.[idx] ?? '알 수 없는 날짜');
                           const value = typeof pt.value === 'number' ? pt.value : Number(pt?.value ?? (data?.[idx] ?? 0));
                           let x: number | undefined = typeof pt.x === 'number' ? pt.x : undefined;
                           let y: number | undefined = typeof pt.y === 'number' ? pt.y : undefined;
                           if (typeof x !== 'number') {
                             const maxIdx = Math.max(1, labels.length - 1);
                             const paddingH = 12;
                             x = paddingH + (idx / maxIdx) * (innerWidth - paddingH * 2);
                           }
                           if (typeof y !== 'number') {
                             try {
                               const ch = 220; const paddingV = 12;
                               const numericData = Array.isArray(data) ? data.map((v: any) => Number.isFinite(v) ? Number(v) : 0) : [];
                               const maxVal = numericData.length ? Math.max(...numericData) : 0;
                               const minVal = numericData.length ? Math.min(...numericData) : 0;
                               const normalized = (maxVal === minVal) ? 0.5 : ((Number(value) - minVal) / (maxVal - minVal));
                               y = paddingV + (1 - normalized) * (ch - paddingV * 2);
                             } catch (err) { y = 80; }
                           }
                           const wrapperW = mainChartWrapperWidth ?? mainChartWidth;
                           const centerOffset = (wrapperW - mainChartWidth) / 2;
                           // chart was shifted left by SHIFT_HALF, so subtract SHIFT_HALF when computing absolute x
                           setTooltip({ index: idx, value, label, x: (x ?? 0) + padLeft + centerOffset - SHIFT_HALF, y, context: 'main' });
                         }}
                       />
                     </View>
                   );
                 })()}

                {tooltip && tooltip.context === 'main' && typeof tooltip.x === 'number' && typeof tooltip.y === 'number' ? (() => {
                  const overlay = (<Pressable onPress={() => setTooltip(null)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} accessible={false} accessibilityLabel="툴팁 닫기" />);
                  const tbW = 140; const tbH = 56; const padding = 8;
                  const rawLeft = tooltip.x - tbW / 2;
                  const left = Math.max(padding, Math.min((mainChartWrapperWidth ?? (Dimensions.get('window').width - 32)) - tbW - padding, rawLeft));
                  const rawTop = tooltip.y - tbH - DOT_RADIUS - 6;
                  const top = Math.max(6, rawTop);
                  const opacity = tooltipAnim;
                  const scale = tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
                  return (<>{overlay}<Animated.View style={{ position: 'absolute', left, top, width: tbW, opacity, transform: [{ scale }] }}><View style={styles.tooltipInner}><View style={{ alignItems: 'center' }}><Text style={[styles.tooltipLabel, { fontWeight: '700' }]} numberOfLines={1}>{tooltip.label}</Text><Text style={[styles.tooltipValue]}>{`${tooltip.value}점`}</Text></View></View></Animated.View></>);
                })() : null}

              </View>
            );
          })() : null}

          {sorted.map((item) => {
            const label = formatYMD(item.timestamp);
            const sum = item.scores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
            return (
              <View key={`${item.userid}-${item.timestamp}`} style={styles.entry}>
                <View style={styles.entryHeader}><Text style={styles.entryUser}>{item.userid}</Text><Text style={styles.entryDate}>{label}</Text></View>
                <Text style={styles.entryScores}>점수(18문항): {item.scores.join(', ')}</Text>
                <Text style={styles.entrySummary}>합계: {sum}점</Text>
              </View>
            );
          })}

        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.modalContentFull, { paddingTop: insets.top + 12 }]}>
            <View style={[styles.modalHeader, { paddingTop: 4 }]}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>문항별 점수 추이</Text>
              <Pressable onPress={() => setModalVisible(false)} style={[styles.modalClose, { paddingHorizontal: 12, paddingVertical: 8 }]} hitSlop={10}><Text style={{ color: '#007AFF', fontWeight: '600' }}>닫기</Text></Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.questionSelector} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {QUESTION_NAMES.map((n, idx) => (
                <TouchableOpacity key={n} style={[styles.qBtn, idx === selectedQuestionIndex ? styles.qBtnSelected : null]} onPress={() => setSelectedQuestionIndex(idx)}>
                  <Text style={[styles.qBtnText, idx === selectedQuestionIndex ? styles.qBtnTextSelected : null]} numberOfLines={1}>{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {questionStats ? (
              <View>
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { position: 'relative' }]}>
                    <Text style={styles.statLabel}>최신값</Text>
                    <Text style={styles.statValue}>{questionStats.latest == null ? '-' : `${questionStats.latest}점`}</Text>
                    {(() => {
                      const d = questionStats.delta;
                      const badgeChar = d == null ? '—' : d > 0 ? '▲' : d < 0 ? '▼' : '—';
                      const badgeStyle = d == null ? styles.neutralBadge : d > 0 ? styles.positiveBadge : d < 0 ? styles.negativeBadge : styles.neutralBadge;
                      return (<View style={[styles.statBadge, badgeStyle]}><Text style={styles.statBadgeText}>{badgeChar}</Text></View>);
                    })()}
                  </View>
                  <View style={styles.statCard}><Text style={styles.statLabel}>평균</Text><Text style={styles.statValue}>{questionStats.avg == null ? '-' : `${questionStats.avg}점`}</Text></View>
                  <View style={styles.statCard}><Text style={styles.statLabel}>최고</Text><Text style={styles.statValue}>{questionStats.max == null ? '-' : `${questionStats.max}점`}</Text></View>
                  <View style={styles.statCard}><Text style={styles.statLabel}>최저</Text><Text style={styles.statValue}>{questionStats.min == null ? '-' : `${questionStats.min}점`}</Text></View>
                </View>
                {questionStats.delta != null ? (<Text style={[styles.changeText, questionStats.delta > 0 ? styles.positive : questionStats.delta < 0 ? styles.negative : null]}>{questionStats.delta > 0 ? `지난 회기에 비해 ${questionStats.delta}점 상승` : questionStats.delta < 0 ? `지난 회기에 비해 ${Math.abs(questionStats.delta)}점 감소` : '지난 회기와 동일'}</Text>) : null}
              </View>
            ) : null}

            <View style={{ flex: 1, paddingTop: 12 }}>
              {chartLoaded && LineChart ? (() => {
                const labels = sorted.map((it) => formatYMD(it.timestamp));
                const data = sorted.map((it) => {
                  const v = Array.isArray(it.scores) && typeof it.scores[selectedQuestionIndex] !== 'undefined' ? it.scores[selectedQuestionIndex] : 0;
                  return Number.isFinite(v) ? v : 0;
                });
                const modalChartWidth = Math.min(Dimensions.get('window').width * 0.96, 1400);
                const Pm = 14;
                const SHIFTm = AXIS_COMP + 8;
                const SHIFTm_HALF = SHIFTm / 2;
                const padLeftM = Pm;
                const padRightM = Pm;
                const innerModalWidth = Math.max(40, modalChartWidth - padLeftM - padRightM - AXIS_COMP);
                return (
                  <View style={{ position: 'relative', alignItems: 'center', width: modalChartWidth, alignSelf: 'center' }} onLayout={(e) => setModalChartWrapperWidth(e.nativeEvent.layout.width)}>
                    <View style={{ width: modalChartWidth, borderRadius: 8, borderWidth: 1, borderColor: '#e5e5ea', backgroundColor: 'transparent', paddingLeft: padLeftM, paddingRight: padRightM, paddingVertical: Pm }}>
                      <LineChart
                         data={{ labels, datasets: [{ data }] }}
                         width={innerModalWidth}
                         height={420}
                         yAxisSuffix=""
                         yAxisLabel=""
                         chartConfig={chartConfig}
                         bezier
                        // tighten internal spacing so axis offsets don't add extra gaps
                        // shift modal chart LEFT by half SHIFT to keep symmetric paddings
                        style={{ borderRadius: 6, backgroundColor: 'transparent', margin: 0, padding: 0, transform: [{ translateX: -SHIFTm_HALF }], marginLeft: -(AXIS_COMP + padLeftM - SHIFTm_HALF) }}
                        formatYLabel={() => ''}
                        formatXLabel={() => ''}
                        yLabelsOffset={-100}
                        xLabelsOffset={-10}
                         withShadow={false}
                         withInnerLines={false}
                         withVerticalLines={false}
                         withHorizontalLabels={false}
                         withVerticalLabels={false}
                         onDataPointClick={(pt: any) => {
                          const idx = typeof pt.index === 'number' ? pt.index : Number(pt?.index ?? 0);
                          const label = formatYMD(sorted[idx]?.timestamp ?? 0) || labels[idx] || '알 수 없는 날짜';
                          const value = typeof pt.value === 'number' ? pt.value : Number(pt?.value ?? (data?.[idx] ?? 0));
                          let x: number | undefined = typeof pt.x === 'number' ? pt.x : undefined;
                          let y: number | undefined = typeof pt.y === 'number' ? pt.y : undefined;
                          if (typeof x !== 'number') {
                            const maxIdx = Math.max(1, labels.length - 1);
                            const padding = 12;
                            x = padding + (idx / maxIdx) * (innerModalWidth - padding * 2);
                          }
                          if (typeof y !== 'number') {
                            try {
                              const ch = 420; const paddingV = 12;
                              const numericData = Array.isArray(data) ? data.map((v: any) => Number.isFinite(v) ? Number(v) : 0) : [];
                              const maxVal = numericData.length ? Math.max(...numericData) : 0;
                              const minVal = numericData.length ? Math.min(...numericData) : 0;
                              const normalized = (maxVal === minVal) ? 0.5 : ((Number(value) - minVal) / (maxVal - minVal));
                              y = paddingV + (1 - normalized) * (ch - paddingV * 2);
                            } catch (err) { y = 120; }
                          }
                          const wrapperW = modalChartWrapperWidth ?? modalChartWidth;
                          const centerOffset = (wrapperW - modalChartWidth) / 2;
                          setTooltip({ index: idx, value, label, x: (x ?? 0) + padLeftM + centerOffset - SHIFTm_HALF, y, context: 'modal' });
                         }}
                       />
                    </View>
                    {tooltip && tooltip.context === 'modal' && typeof tooltip.x === 'number' && typeof tooltip.y === 'number' ? (() => {
                      const tbW = 160; const tbH = 60; const padding = 10;
                      const rawLeft = tooltip.x - tbW / 2;
                      const containerWidth = modalChartWrapperWidth ?? modalChartWidth;
                      const left = Math.max(padding, Math.min(containerWidth - tbW - padding, rawLeft));
                      const rawTop = (tooltip.y ?? 0) - tbH - DOT_RADIUS - 6;
                      const top = Math.max(6, rawTop);
                      const opacity = tooltipAnim;
                      const scale = tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
                      return (
                        <>
                          <Pressable onPress={() => setTooltip(null)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} accessibilityLabel="툴팁 닫기" />
                          <Animated.View style={{ position: 'absolute', left, top, width: tbW, opacity, transform: [{ scale }] }}>
                            <View style={styles.tooltipInner}>
                              <View style={{ alignItems: 'center' }}>
                                <Text style={[styles.tooltipLabel, { fontWeight: '700' }]} numberOfLines={1}>{tooltip.label}</Text>
                                <Text style={styles.tooltipValue}>{`${tooltip.value}점`}</Text>
                              </View>
                            </View>
                          </Animated.View>
                        </>
                      );
                    })() : null}
                   </View>
                );
              })() : (
                <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}><Text style={{ color: '#666' }}>차트 데이터를 표시할 수 없습니다</Text></View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  headerLogo: { width: 28, height: 28, resizeMode: 'contain', marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { marginTop: 8, fontSize: 14 },
  entry: { marginBottom: 12, padding: 12, borderRadius: 8, backgroundColor: '#f9f9fb', borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  entryUser: { fontWeight: '600' },
  entryDate: { color: '#666', fontSize: 12 },
  entryScores: { fontSize: 13, color: '#111' },
  entrySummary: { marginTop: 6, fontWeight: '600' },

  centerIconWrap: { alignItems: 'center', paddingVertical: 20, backgroundColor: 'transparent' },
  centerScore: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  trendText: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
  topQuestion: { fontSize: 14, color: '#111', marginTop: 6, textAlign: 'center', fontWeight: '600' },
  riskLabel: { fontSize: 30, marginTop: 6 },
  questionTrendBtn: { marginTop: 10, backgroundColor: '#e8f6f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  questionTrendBtnText: { color: '#0a7f5a', fontWeight: '700' },

  mainChartTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#0b2545', textAlign: 'center' },

  modalContentFull: { flex: 1, width: '100%', backgroundColor: 'white', paddingTop: 12, paddingHorizontal: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalClose: { paddingHorizontal: 8, paddingVertical: 6 },
  questionSelector: { marginTop: 12, maxHeight: 40 },
  qBtn: { paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: 6, borderRadius: 12, backgroundColor: '#f2f2f4', minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  qBtnSelected: { backgroundColor: '#007AFF' },
  qBtnText: { fontSize: 14, color: '#333', lineHeight: 18 },
  qBtnTextSelected: { color: 'white', fontWeight: '700' },

  tooltipInner: { backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  tooltipLabel: { color: '#fff', fontSize: 12 },
  tooltipValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, marginHorizontal: 4, backgroundColor: '#f7fbff', borderRadius: 8 },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  changeText: { textAlign: 'center', marginTop: 8, fontSize: 13 },
  positive: { color: '#d9534f' },
  negative: { color: '#2b9f5b' },
  statBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  positiveBadge: { backgroundColor: '#d9534f' },
  negativeBadge: { backgroundColor: '#2b9f5b' },
  neutralBadge: { backgroundColor: '#bfc4c9' },
  fallbackIcon: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
});
