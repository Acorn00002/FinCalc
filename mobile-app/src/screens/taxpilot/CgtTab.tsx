import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard, { ResultRow } from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

type AssetType = 'apt' | 'presale' | 'kr-stock' | 'overseas-stock';
type HouseCount = 'one' | 'two' | 'three';

// taxpilot/index.html의 calcCgt(① 양도소득세, 약 2060~2189번째 줄)를 그대로 이식.
// 웹은 취득일/양도일/거주개시일 날짜로 보유·거주기간을 계산하지만, 네이티브에서는
// "보유기간(년)"/"거주기간(년)"을 직접 입력받는다.
export default function CgtTab() {
  const [assetType, setAssetType] = useState<AssetType>('apt');
  const [houseCount, setHouseCount] = useState<HouseCount>('one');
  const [regulated, setRegulated] = useState(false);
  const [resided, setResided] = useState(true);
  const [holdYears, setHoldYears] = useState(5);
  const [resideYears, setResideYears] = useState(3);
  const [isBigHolder, setIsBigHolder] = useState(false);
  const [acqPrice, setAcqPrice] = useState(600000000);
  const [salePrice, setSalePrice] = useState(1000000000);
  const [expenseTotal, setExpenseTotal] = useState(20000000);

  const result = useMemo(() => {
    if (salePrice <= 0) return null;
    const isRealty = assetType === 'apt' || assetType === 'presale';
    const isKrStock = assetType === 'kr-stock';
    const rawGain = Math.max(0, salePrice - acqPrice - expenseTotal);
    const rows: ResultRow[] = [
      { label: '양도(매도)가액', value: `₩ ${formatResult(salePrice)}` },
      { label: '취득가액', value: `₩ ${formatResult(acqPrice)}` },
      { label: '필요경비', value: `- ₩ ${formatResult(expenseTotal)}`, tone: 'profit' },
      { label: '양도차익', value: `₩ ${formatResult(rawGain)}` },
    ];

    if (isKrStock) {
      if (!isBigHolder) {
        return { exempt: true as const, reason: '소액주주 국내 상장주식의 양도차익은 비과세돼요', rows, totalTax: 0 };
      }
      const natBase1 = Math.min(rawGain, 300000000);
      const natBase2 = Math.max(0, rawGain - 300000000);
      const calculatedTax = natBase1 * 0.2 + natBase2 * 0.25;
      const localTax = calculatedTax * 0.1;
      const totalTax = calculatedTax + localTax;
      rows.push({ label: '산출세액 (대주주, 3억 이하 20%/초과 25%)', value: `₩ ${formatResult(calculatedTax)}` });
      rows.push({ label: '지방소득세(10%)', value: `₩ ${formatResult(localTax)}` });
      return { exempt: false as const, rows, totalTax };
    }

    if (!isRealty) {
      const basicDeduction = Math.min(2500000, rawGain);
      const taxBase = Math.max(0, rawGain - basicDeduction);
      const calculatedTax = taxBase * 0.2;
      const localTax = taxBase * 0.02;
      const totalTax = calculatedTax + localTax;
      rows.push({ label: '기본공제(연 250만원)', value: `- ₩ ${formatResult(basicDeduction)}`, tone: 'profit' });
      rows.push({ label: '과세표준', value: `₩ ${formatResult(taxBase)}` });
      rows.push({ label: '산출세액 (20%)', value: `₩ ${formatResult(calculatedTax)}` });
      rows.push({ label: '지방소득세(2%)', value: `₩ ${formatResult(localTax)}` });
      return { exempt: false as const, rows, totalTax };
    }

    // 부동산 (아파트 / 분양권)
    const holdYearsFloor = Math.floor(holdYears);
    const resideYearsFloor = resided ? Math.floor(resideYears) : 0;

    if (houseCount === 'one') {
      const qualifies = regulated ? holdYearsFloor >= 2 && resided && resideYearsFloor >= 2 : holdYearsFloor >= 2;
      if (qualifies && salePrice <= 900000000) {
        return { exempt: true as const, reason: '1세대1주택 비과세 요건(양도가액 9억원 이하)을 충족했어요', rows, totalTax: 0 };
      }

      let taxableGain = rawGain;
      let taxableRatio: number | null = null;
      if (qualifies) {
        taxableRatio = (salePrice - 900000000) / salePrice;
        taxableGain = rawGain * taxableRatio;
      }

      let ltRate: number;
      if (qualifies && resided && resideYearsFloor >= 2) {
        const holdRate = holdYearsFloor >= 3 ? Math.min(40, 12 + (holdYearsFloor - 3) * 4) : 0;
        const resideRate = Math.min(40, 8 + (resideYearsFloor - 2) * 4);
        ltRate = Math.min(80, holdRate + resideRate) / 100;
      } else {
        ltRate = holdYearsFloor >= 3 ? Math.min(0.3, holdYearsFloor * 0.02) : 0;
      }
      const ltDeduction = taxableGain * ltRate;
      const gainAfterLt = Math.max(0, taxableGain - ltDeduction);
      const basicDeduction = Math.min(2500000, gainAfterLt);
      const taxBase = Math.max(0, gainAfterLt - basicDeduction);
      const calculatedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);
      const localTax = calculatedTax * 0.1;
      const totalTax = calculatedTax + localTax;

      if (taxableRatio !== null) {
        rows.push({ label: '과세대상 비율 (9억 초과분)', value: `${(taxableRatio * 100).toFixed(1)}%` });
        rows.push({ label: '과세대상 양도차익', value: `₩ ${formatResult(taxableGain)}` });
      }
      rows.push({ label: `장기보유특별공제 (${(ltRate * 100).toFixed(0)}%)`, value: `- ₩ ${formatResult(ltDeduction)}`, tone: 'profit' });
      rows.push({ label: '기본공제(연 250만원)', value: `- ₩ ${formatResult(basicDeduction)}`, tone: 'profit' });
      rows.push({ label: '과세표준', value: `₩ ${formatResult(taxBase)}` });
      rows.push({ label: '산출세액', value: `₩ ${formatResult(calculatedTax)}` });
      rows.push({ label: '지방소득세(10%)', value: `₩ ${formatResult(localTax)}` });
      return { exempt: false as const, rows, totalTax };
    }

    // 2주택 / 3주택 이상
    let surchargeRate = 0;
    let ltRateMulti = 0;
    if (regulated) {
      surchargeRate = houseCount === 'two' ? 0.2 : 0.3;
    } else {
      ltRateMulti = holdYearsFloor >= 3 ? Math.min(0.3, holdYearsFloor * 0.02) : 0;
    }
    const ltDeductionM = rawGain * ltRateMulti;
    const gainAfterLtM = Math.max(0, rawGain - ltDeductionM);
    const basicDeductionM = Math.min(2500000, gainAfterLtM);
    const taxBaseM = Math.max(0, gainAfterLtM - basicDeductionM);
    const baseTaxM = calcProgressiveTax(taxBaseM, INCOME_TAX_BRACKETS);
    const surchargeAmount = taxBaseM * surchargeRate;
    const calculatedTax = baseTaxM + surchargeAmount;
    const localTax = calculatedTax * 0.1;
    const totalTax = calculatedTax + localTax;

    if (ltRateMulti > 0) rows.push({ label: `장기보유특별공제 (${(ltRateMulti * 100).toFixed(0)}%)`, value: `- ₩ ${formatResult(ltDeductionM)}`, tone: 'profit' });
    rows.push({ label: '기본공제(연 250만원)', value: `- ₩ ${formatResult(basicDeductionM)}`, tone: 'profit' });
    rows.push({ label: '과세표준', value: `₩ ${formatResult(taxBaseM)}` });
    if (surchargeRate > 0) rows.push({ label: `다주택 중과 할증 (+${(surchargeRate * 100).toFixed(0)}%p)`, value: `+ ₩ ${formatResult(surchargeAmount)}`, tone: 'loss' });
    rows.push({ label: '산출세액', value: `₩ ${formatResult(calculatedTax)}` });
    rows.push({ label: '지방소득세(10%)', value: `₩ ${formatResult(localTax)}` });
    return { exempt: false as const, rows, totalTax };
  }, [assetType, houseCount, regulated, resided, holdYears, resideYears, isBigHolder, acqPrice, salePrice, expenseTotal]);

  const isRealty = assetType === 'apt' || assetType === 'presale';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel style={{ borderRadius: 24, padding: 24 }}>
        <SegmentedControl
          options={[
            { value: 'apt', label: '아파트' },
            { value: 'presale', label: '분양권' },
            { value: 'kr-stock', label: '국내주식' },
            { value: 'overseas-stock', label: '해외주식' },
          ]}
          value={assetType}
          onChange={(v) => setAssetType(v as AssetType)}
        />
        {isRealty ? (
          <>
            <SegmentedControl
              options={[
                { value: 'one', label: '1주택' },
                { value: 'two', label: '2주택' },
                { value: 'three', label: '3주택 이상' },
              ]}
              value={houseCount}
              onChange={(v) => setHouseCount(v as HouseCount)}
            />
            <SegmentedControl
              options={[
                { value: 'no', label: '비조정대상지역' },
                { value: 'yes', label: '조정대상지역' },
              ]}
              value={regulated ? 'yes' : 'no'}
              onChange={(v) => setRegulated(v === 'yes')}
            />
            <NumberField label="보유기간" value={holdYears} onChange={setHoldYears} suffix="년" allowDecimal />
            {houseCount === 'one' ? (
              <>
                <SegmentedControl
                  options={[
                    { value: 'yes', label: '거주함' },
                    { value: 'no', label: '거주 안 함' },
                  ]}
                  value={resided ? 'yes' : 'no'}
                  onChange={(v) => setResided(v === 'yes')}
                />
                {resided ? <NumberField label="거주기간" value={resideYears} onChange={setResideYears} suffix="년" allowDecimal /> : null}
              </>
            ) : null}
          </>
        ) : null}
        {assetType === 'kr-stock' ? (
          <SegmentedControl
            options={[
              { value: 'no', label: '소액주주' },
              { value: 'yes', label: '대주주' },
            ]}
            value={isBigHolder ? 'yes' : 'no'}
            onChange={(v) => setIsBigHolder(v === 'yes')}
          />
        ) : null}
        <NumberField label="취득가액" value={acqPrice} onChange={setAcqPrice} suffix="원" showKoreanHint />
        <NumberField label="양도가액" value={salePrice} onChange={setSalePrice} suffix="원" showKoreanHint />
        <NumberField label="필요경비 (선택)" value={expenseTotal} onChange={setExpenseTotal} suffix="원" showKoreanHint />
      </InputPanel>

      {result?.exempt ? (
        <ResultCard title="양도소득세" mainValue="₩ 0" subValue={result.reason} rows={result.rows} />
      ) : result ? (
        <ResultCard title="납부할 총 세액" mainValue={`₩ ${formatResult(result.totalTax)}`} rows={result.rows} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
