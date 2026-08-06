import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 renderAveragePrice(4. 평단가/물타기 계산기)를 그대로 이식.
// 시뮬레이션 곡선 차트는 스코프상 제외하고 핵심 전/후 비교만 이식.
export default function AveragePriceCalculator() {
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [currentQty, setCurrentQty] = useState(10);
  const [marketPrice, setMarketPrice] = useState(40000);
  const [addAmount, setAddAmount] = useState(200000);

  const result = useMemo(() => {
    if (currentPrice <= 0 || currentQty <= 0 || marketPrice <= 0) return null;
    const addQty = marketPrice > 0 ? addAmount / marketPrice : 0;

    const beforeInvested = currentPrice * currentQty;
    const beforePnl = (marketPrice - currentPrice) * currentQty;
    const beforeRoi = ((marketPrice - currentPrice) / currentPrice) * 100;

    const afterQty = currentQty + addQty;
    const afterInvested = beforeInvested + addAmount;
    const afterAvgPrice = afterQty > 0 ? afterInvested / afterQty : currentPrice;
    const afterPnl = (marketPrice - afterAvgPrice) * afterQty;
    const afterRoi = afterAvgPrice > 0 ? ((marketPrice - afterAvgPrice) / afterAvgPrice) * 100 : 0;

    return { addQty, beforePnl, beforeRoi, afterQty, afterAvgPrice, afterPnl, afterRoi };
  }, [currentPrice, currentQty, marketPrice, addAmount]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="현재 평단가" value={currentPrice} onChange={setCurrentPrice} suffix="원" />
        <NumberField label="보유 수량" value={currentQty} onChange={setCurrentQty} suffix="주" allowDecimal />
        <NumberField label="현재 시장가" value={marketPrice} onChange={setMarketPrice} suffix="원" />
        <NumberField label="추가 매수 금액" value={addAmount} onChange={setAddAmount} suffix="원" showKoreanHint />
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title="지금 (물타기 전)"
            mainValue={`${result.beforeRoi >= 0 ? '+' : ''}${formatResult(result.beforeRoi)}%`}
            rows={[
              { label: '평단가', value: `${formatResult(currentPrice)}원` },
              { label: '평가손익', value: `${result.beforePnl >= 0 ? '+' : ''}${formatResult(result.beforePnl)}원`, tone: result.beforePnl >= 0 ? 'profit' : 'loss' },
            ]}
          />
          <ResultCard
            title={`추가 매수 후 (약 ${formatResult(result.addQty)}주 매수)`}
            mainValue={`${formatResult(result.afterAvgPrice)}원`}
            subValue={`수익률 ${result.afterRoi >= 0 ? '+' : ''}${formatResult(result.afterRoi)}%`}
            rows={[
              { label: '총 보유 수량', value: `${formatResult(result.afterQty)}주` },
              { label: '예상 평가손익', value: `${result.afterPnl >= 0 ? '+' : ''}${formatResult(result.afterPnl)}원`, tone: result.afterPnl >= 0 ? 'profit' : 'loss' },
            ]}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
