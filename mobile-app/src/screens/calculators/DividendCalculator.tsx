import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import GrowthChart, { ChartPoint } from '../../components/calc/GrowthChart';
import { formatResult } from '../../lib/calc/format';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type TaxType = 'general' | 'tax-free';

function simulateReinvestment(P: number, Q0: number, Ds: number, C: number, taxRate: number, years: number): ChartPoint[] {
  const totalPeriods = years * C;
  let q = Q0;
  const points: ChartPoint[] = [{ label: '0년차', value: q * P }];
  for (let i = 1; i <= totalPeriods; i++) {
    const periodDividendNet = Ds * q * (1 - taxRate);
    const newShares = P > 0 ? periodDividendNet / P : 0;
    q += newShares;
    if (i % C === 0) points.push({ label: `${i / C}년차`, value: q * P });
  }
  return points;
}

// finpilot/js/calculators.js의 calculateDividends(14. 배당금 계산기)를 그대로 이식.
// 고배당주 인사이트 아티클은 고정 마케팅 콘텐츠라 이식 대상에서 제외.
export default function DividendCalculator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [price, setPrice] = useState(50000);
  const [qty, setQty] = useState(100);
  const [perShare, setPerShare] = useState(500);
  const [cycle, setCycle] = useState('4');
  const [taxType, setTaxType] = useState<TaxType>('general');
  const [reinvest, setReinvest] = useState(false);

  const result = useMemo(() => {
    if (price <= 0 || qty <= 0 || perShare <= 0) return null;
    const C = parseInt(cycle, 10);
    const taxRate = taxType === 'general' ? 0.154 : 0;
    const totalInvestment = price * qty;
    const annualDividendGross = perShare * C * qty;
    const tax = annualDividendGross * taxRate;
    const annualDividendNet = annualDividendGross - tax;
    const monthlyDividend = annualDividendNet / 12;
    const projection = reinvest ? simulateReinvestment(price, qty, perShare, C, taxRate, 10) : null;
    return { totalInvestment, annualDividendGross, tax, annualDividendNet, monthlyDividend, projection };
  }, [price, qty, perShare, cycle, taxType, reinvest]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="현재 주가" value={price} onChange={setPrice} suffix="원" />
        <NumberField label="보유 수량" value={qty} onChange={setQty} suffix="주" />
        <NumberField label="주당 배당금" value={perShare} onChange={setPerShare} suffix="원" />
        <SegmentedControl
          options={[
            { value: '12', label: '월배당' },
            { value: '4', label: '분기배당' },
            { value: '1', label: '연배당' },
          ]}
          value={cycle}
          onChange={setCycle}
        />
        <SegmentedControl
          options={[
            { value: 'general', label: '일반과세' },
            { value: 'tax-free', label: '비과세(ISA)' },
          ]}
          value={taxType}
          onChange={(v) => setTaxType(v as TaxType)}
        />
        <Pressable style={styles.reinvestToggle} onPress={() => setReinvest((v) => !v)}>
          <Ionicons name={reinvest ? 'checkbox' : 'square-outline'} size={20} color={colors.brand} />
          <Text style={styles.reinvestLabel}>배당금 재투자 시뮬레이션 (10년)</Text>
        </Pressable>
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title="세후 연간 배당금"
            mainValue={`₩ ${formatResult(result.annualDividendNet)}`}
            subValue={`월평균 ₩ ${formatResult(result.monthlyDividend)}`}
            rows={[
              { label: '총 투자금', value: `₩ ${formatResult(result.totalInvestment)}` },
              { label: '세전 연간 배당금', value: `₩ ${formatResult(result.annualDividendGross)}` },
              { label: '배당소득세', value: `- ₩ ${formatResult(result.tax)}`, tone: 'loss' },
            ]}
          />
          {result.projection ? <GrowthChart points={result.projection} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
    reinvestToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    reinvestLabel: { fontSize: 13.5, fontWeight: '600', color: colors.ink1 },
  });
}
