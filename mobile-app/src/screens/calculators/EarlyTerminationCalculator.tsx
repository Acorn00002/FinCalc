import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const EARLY_TERM_TAX_RATE = 0.154;

function getPenaltyRatio(x: number): number {
  if (x < 10) return 0.1;
  if (x < 30) return 0.3;
  if (x < 60) return 0.5;
  if (x < 90) return 0.7;
  return 0.85;
}

// finpilot/js/calculators.js의 calculateEarlyTermination(12. 예금중도해지 계산기)을 그대로 이식.
// 웹은 가입일/해지일 두 날짜로 보유일수를 계산하지만, 네이티브에서는 날짜 선택 UI 없이
// "실제 보유일수"를 직접 입력받는다(약정 총일수는 개월수×30일로 근사).
export default function EarlyTerminationCalculator() {
  const [principal, setPrincipal] = useState(10000000);
  const [ratePct, setRatePct] = useState(4);
  const [months, setMonths] = useState(12);
  const [heldDays, setHeldDays] = useState(90);

  const result = useMemo(() => {
    if (principal <= 0 || months <= 0) return null;
    const totalDays = months * 30;
    const isMatured = heldDays >= totalDays;
    const actualDays = isMatured ? totalDays : heldDays;

    const holdRatio = totalDays > 0 ? Math.min(100, (actualDays / totalDays) * 100) : 0;
    const penaltyRatio = isMatured ? 1 : getPenaltyRatio(holdRatio);
    const penaltyRate = ratePct * penaltyRatio;

    const interestPenaltyGross = principal * (penaltyRate / 100) * (actualDays / 365);
    const interestTargetGross = principal * (ratePct / 100) * (months / 12);
    const interestPenaltyNet = interestPenaltyGross * (1 - EARLY_TERM_TAX_RATE);
    const interestTargetNet = interestTargetGross * (1 - EARLY_TERM_TAX_RATE);
    const lostInterest = Math.max(0, interestTargetNet - interestPenaltyNet);
    const finalPayout = principal + interestPenaltyNet;

    return { holdRatio, isMatured, penaltyRate, interestPenaltyNet, lostInterest, finalPayout };
  }, [principal, ratePct, months, heldDays]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="예치 원금" value={principal} onChange={setPrincipal} suffix="원" showKoreanHint />
        <NumberField label="약정 연이율" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="약정 기간" value={months} onChange={setMonths} suffix="개월" />
        <NumberField label="실제 보유일수" value={heldDays} onChange={setHeldDays} suffix="일" />
      </InputPanel>

      {result ? (
        <ResultCard
          title="중도해지 시 실수령액"
          mainValue={`₩ ${formatResult(result.finalPayout)}`}
          subValue={`보유율 ${formatResult(result.holdRatio)}%${result.isMatured ? ' (만기 도달)' : ''} · 적용 이율 연 ${formatResult(result.penaltyRate)}%`}
          rows={[
            { label: '세후 이자 (중도해지)', value: `₩ ${formatResult(result.interestPenaltyNet)}`, tone: 'profit' },
            { label: '만기 대비 손실액', value: `- ₩ ${formatResult(result.lostInterest)}`, tone: 'loss' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
