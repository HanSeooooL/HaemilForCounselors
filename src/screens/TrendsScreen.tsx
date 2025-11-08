import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView, UIManager } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { fetchExamScores, type ExamScoreEntry } from '../api';

// import LineChart at runtime only (avoid Jest parse errors for ESM libs)
let LineChart: any;

export default function TrendsScreen() {
  const [chartLoaded, setChartLoaded] = useState(false);
  const [svgAvailable, setSvgAvailable] = useState<boolean | null>(null);
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ExamScoreEntry[] | null>(null);

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

  // Ensure chart shows oldest -> newest from left -> right
  const chartData = useMemo(() => {
    if (!sorted || sorted.length === 0) return null;
    // sorted is already ascending by timestamp
    const labels = sorted.map((it) => formatYMD(it.timestamp));
    const data = sorted.map((it) => it.scores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0));
    return { labels, data };
  }, [sorted]);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>우울증 추이</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  title: { fontSize: 18, fontWeight: '600' },
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
});
