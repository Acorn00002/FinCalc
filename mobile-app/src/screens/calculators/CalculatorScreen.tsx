import React, { useMemo } from 'react';
import type { ComponentType } from 'react';
import { StyleSheet, Text } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import AppScreen from '../../components/AppScreen';
import ScreenTitleBar from '../../components/ui/ScreenTitleBar';
import ComingSoon from '../../components/ui/ComingSoon';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';
import { CALCULATORS, CalcId } from './registry';
import CompoundSimpleCalculator from './CompoundSimpleCalculator';
import CompoundPeriodicCalculator from './CompoundPeriodicCalculator';
import DepositCalculator from './DepositCalculator';
import SavingsCalculator from './SavingsCalculator';
import LoanCalculator from './LoanCalculator';
import RoiCalculator from './RoiCalculator';
import InflationCalculator from './InflationCalculator';
import PyeongCalculator from './PyeongCalculator';
import ExchangeCalculator from './ExchangeCalculator';
import GoalPlannerCalculator from './GoalPlannerCalculator';
import BrokerageCalculator from './BrokerageCalculator';
import KellyCalculator from './KellyCalculator';
import AveragePriceCalculator from './AveragePriceCalculator';
import DividendCalculator from './DividendCalculator';
import SalaryCalculator from './SalaryCalculator';
import EarlyTerminationCalculator from './EarlyTerminationCalculator';
import LoanLimitCalculator from './LoanLimitCalculator';
import RetirementCalculator from './RetirementCalculator';
import AptBuyCalculator from './AptBuyCalculator';
import AptTaxCalculator from './AptTaxCalculator';
import DepositConversionCalculator from './DepositConversionCalculator';
import SubscriptionScoreCalculator from './SubscriptionScoreCalculator';
import GlobalStockTaxCalculator from './GlobalStockTaxCalculator';
import GlobalNetCalculator from './GlobalNetCalculator';
import FinFuncCalculator from './FinFuncCalculator';
import GiftTaxCalculator from './GiftTaxCalculator';
import InheritanceTaxCalculator from './InheritanceTaxCalculator';
import GainsTaxCalculator from './GainsTaxCalculator';
import SeveranceCalculator from './SeveranceCalculator';
import HomeBudgetCalculator from './HomeBudgetCalculator';
import type { RootStackParamList } from '../../navigation/types';

type CalculatorRouteProp = RouteProp<RootStackParamList, 'Calculator'>;

// calcId별 실제 구현체 — registry.ts의 implemented:true 항목만 여기 등록된다.
const COMPONENTS: Partial<Record<CalcId, ComponentType<{ initialLoanType?: 'mortgage' | 'jeonse' | 'credit' }>>> = {
  'compound-simple': CompoundSimpleCalculator,
  'compound-periodic': CompoundPeriodicCalculator,
  deposit: DepositCalculator,
  savings: SavingsCalculator,
  loan: LoanCalculator,
  roi: RoiCalculator,
  inflation: InflationCalculator,
  pyeong: PyeongCalculator,
  exchange: ExchangeCalculator,
  'goal-planner': GoalPlannerCalculator,
  brokerage: BrokerageCalculator,
  kelly: KellyCalculator,
  'water-ratio': AveragePriceCalculator,
  dividend: DividendCalculator,
  salary: SalaryCalculator,
  'early-termination': EarlyTerminationCalculator,
  'loan-limit': LoanLimitCalculator,
  retirement: RetirementCalculator,
  'apt-buy': AptBuyCalculator,
  'apt-tax': AptTaxCalculator,
  'deposit-calc': DepositConversionCalculator,
  subscription: SubscriptionScoreCalculator,
  'global-stock-tax': GlobalStockTaxCalculator,
  'global-net': GlobalNetCalculator,
  'fin-func': FinFuncCalculator,
  'gift-tax': GiftTaxCalculator,
  'inheritance-tax': InheritanceTaxCalculator,
  'gains-tax': GainsTaxCalculator,
  severance: SeveranceCalculator,
  'home-budget': HomeBudgetCalculator,
};

export default function CalculatorScreen() {
  const route = useRoute<CalculatorRouteProp>();
  const entry = CALCULATORS.find((c) => c.id === route.params.calcId);
  const Component = COMPONENTS[route.params.calcId];
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppScreen>
      <ScreenTitleBar title={entry?.title ?? '계산기'} />
      {/* finpilot의 .section-header 설명 문구 — 있는 계산기만 렌더링(registry.ts 참고) */}
      {entry?.description ? <Text style={styles.description}>{entry.description}</Text> : null}
      {Component ? (
        <Component initialLoanType={route.params.loanType} />
      ) : (
        <ComingSoon icon="construct-outline" title={entry?.title ?? '계산기'} description="이 계산기는 아직 이식 중이에요. 곧 만나보실 수 있어요." />
      )}
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    description: {
      fontSize: 12.5,
      color: colors.ink3,
      paddingHorizontal: 20,
      paddingTop: 2,
      paddingBottom: 8,
      lineHeight: 18,
    },
  });
}
