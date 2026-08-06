import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Currency = 'USD' | 'KRW' | 'EUR' | 'JPY';
const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€', JPY: '¥' };
const CURRENCY_OPTIONS = (['USD', 'KRW', 'EUR', 'JPY'] as Currency[]).map((c) => ({ value: c, label: c }));

// finpilot/js/calculators.js의 calculateExchange/fetchExchangeRates(6. 환율 계산기)를 그대로 이식.
// 최근 2주 추이 차트/AI 코멘트는 실데이터가 아닌 연출용 시각화라 이식 대상에서 제외.
export default function ExchangeCalculator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('KRW');
  const [manualMode, setManualMode] = useState(false);
  const [manualRate, setManualRate] = useState(1350);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD,FRX.KRWEUR,FRX.KRWJPY');
        const data = await res.json();
        const usd = data.find((d: any) => d.currencyCode === 'USD');
        const eur = data.find((d: any) => d.currencyCode === 'EUR');
        const jpy = data.find((d: any) => d.currencyCode === 'JPY');
        if (usd) {
          const usdKrw = usd.basePrice / (usd.currencyUnit || 1);
          const next: Record<string, number> = { USD: 1, KRW: usdKrw };
          if (eur) next.EUR = usdKrw / (eur.basePrice / (eur.currencyUnit || 1));
          if (jpy) next.JPY = usdKrw / (jpy.basePrice / (jpy.currencyUnit || 100));
          setRates(next);
          return;
        }
        throw new Error('dunamu empty');
      } catch {
        try {
          const res = await fetch('https://open.er-api.com/v6/latest/USD');
          const data = await res.json();
          if (data?.rates) {
            setRates(data.rates);
            return;
          }
          throw new Error('fallback empty');
        } catch {
          setFetchError(true);
          setManualMode(true);
        }
      }
    })();
  }, []);

  const rate = useMemo(() => {
    if (manualMode) return manualRate > 0 ? manualRate : 1;
    if (!rates) return null;
    const fromToUsd = rates[from];
    const toFromUsd = rates[to];
    if (!fromToUsd || !toFromUsd) return null;
    return toFromUsd / fromToUsd;
  }, [manualMode, manualRate, rates, from, to]);

  const result = rate !== null ? amount * rate : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <View style={styles.currencyRow}>
          <View style={styles.currencyCol}>
            <Text style={styles.label}>보내는 통화</Text>
            <SegmentedControl options={CURRENCY_OPTIONS} value={from} onChange={(v) => setFrom(v as Currency)} />
          </View>
          <Pressable
            style={styles.swapBtn}
            onPress={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <Ionicons name="swap-horizontal-outline" size={20} color={colors.brand} />
          </Pressable>
          <View style={styles.currencyCol}>
            <Text style={styles.label}>받는 통화</Text>
            <SegmentedControl options={CURRENCY_OPTIONS} value={to} onChange={(v) => setTo(v as Currency)} />
          </View>
        </View>

        <NumberField label="금액" value={amount} onChange={setAmount} suffix={from} allowDecimal />

        <Pressable style={styles.manualToggle} onPress={() => setManualMode((v) => !v)}>
          <Ionicons name={manualMode ? 'checkbox' : 'square-outline'} size={20} color={colors.brand} />
          <Text style={styles.manualToggleLabel}>환율 직접 입력</Text>
        </Pressable>
        {manualMode ? (
          <NumberField label={`1 ${from} = ? ${to}`} value={manualRate} onChange={setManualRate} allowDecimal />
        ) : null}

        {fetchError && !manualMode ? <Text style={styles.errorText}>환율을 가져오는데 실패했어요. 직접 입력을 사용해주세요.</Text> : null}
      </InputPanel>

      {result !== null ? (
        <ResultCard
          title="환전 결과"
          mainValue={`${SYMBOLS[to]}${formatResult(result)}`}
          subValue={manualMode ? '(직접 입력 환율 적용)' : `(실시간 환율: 1 ${from} = ${formatResult(rate!)} ${to})`}
        />
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
    currencyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
    currencyCol: { flex: 1 },
    label: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 8 },
    swapBtn: { padding: 10, marginBottom: 18 },
    manualToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    manualToggleLabel: { fontSize: 13.5, fontWeight: '600', color: colors.ink1 },
    errorText: { fontSize: 12.5, color: colors.loss, marginBottom: 12 },
  });
}
