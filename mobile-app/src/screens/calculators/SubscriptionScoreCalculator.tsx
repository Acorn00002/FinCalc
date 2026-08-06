import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Option = { value: number; label: string };

const NO_HOUSE_OPTIONS: Option[] = [
  { value: 2, label: '1년 미만' },
  { value: 4, label: '1~2년' },
  { value: 6, label: '2~3년' },
  { value: 8, label: '3~4년' },
  { value: 10, label: '4~5년' },
  { value: 12, label: '5~6년' },
  { value: 14, label: '6~7년' },
  { value: 16, label: '7~8년' },
  { value: 18, label: '8~9년' },
  { value: 20, label: '9~10년' },
  { value: 22, label: '10~11년' },
  { value: 24, label: '11~12년' },
  { value: 26, label: '12~13년' },
  { value: 28, label: '13~14년' },
  { value: 30, label: '14~15년' },
  { value: 32, label: '15년 이상' },
];
const DEPENDENTS_OPTIONS: Option[] = [
  { value: 5, label: '0명' },
  { value: 10, label: '1명' },
  { value: 15, label: '2명' },
  { value: 20, label: '3명' },
  { value: 25, label: '4명' },
  { value: 30, label: '5명' },
  { value: 35, label: '6명 이상' },
];
const TERM_OPTIONS: Option[] = [
  { value: 1, label: '6개월 미만' },
  { value: 2, label: '6개월~1년' },
  { value: 3, label: '1~2년' },
  { value: 4, label: '2~3년' },
  { value: 5, label: '3~4년' },
  { value: 6, label: '4~5년' },
  { value: 7, label: '5~6년' },
  { value: 8, label: '6~7년' },
  { value: 9, label: '7~8년' },
  { value: 10, label: '8~9년' },
  { value: 11, label: '9~10년' },
  { value: 12, label: '10~11년' },
  { value: 13, label: '11~12년' },
  { value: 14, label: '12~13년' },
  { value: 15, label: '13~14년' },
  { value: 16, label: '14~15년' },
  { value: 17, label: '15년 이상' },
];

// finpilot/js/calculators.js의 calculateSubscriptionScore(26. 청약가점 계산기)를 그대로 이식.
export default function SubscriptionScoreCalculator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [noHouse, setNoHouse] = useState(30);
  const [dependents, setDependents] = useState(20);
  const [term, setTerm] = useState(17);

  const total = noHouse + dependents + term;

  const renderChips = (options: Option[], value: number, onChange: (v: number) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(opt.value)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {opt.label} ({opt.value}점)
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>무주택기간 (최대 32점)</Text>
          {renderChips(NO_HOUSE_OPTIONS, noHouse, setNoHouse)}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부양가족수 (최대 35점)</Text>
          {renderChips(DEPENDENTS_OPTIONS, dependents, setDependents)}
        </View>
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>청약통장 가입기간 (최대 17점)</Text>
          {renderChips(TERM_OPTIONS, term, setTerm)}
        </View>
      </InputPanel>

      <ResultCard
        title="청약가점 총점 (만점 84점)"
        mainValue={`${total}점`}
        rows={[
          { label: '무주택기간', value: `${noHouse}점` },
          { label: '부양가족수', value: `${dependents}점` },
          { label: '청약통장 가입기간', value: `${term}점` },
        ]}
      />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
    section: { marginBottom: 20 },
    lastSection: { marginBottom: 0 },
    sectionTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 10 },
    chipsRow: { gap: 8 },
    chip: { backgroundColor: colors.cardSoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    chipActive: { backgroundColor: colors.brand },
    chipText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    chipTextActive: { color: '#fff' },
  });
}
