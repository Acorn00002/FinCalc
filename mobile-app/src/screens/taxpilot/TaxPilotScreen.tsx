import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppScreen from '../../components/AppScreen';
import ScreenTitleBar from '../../components/ui/ScreenTitleBar';
import SegmentedControl from '../../components/calc/SegmentedControl';
import CgtTab from './CgtTab';
import GiftInheritTab from './GiftInheritTab';
import YearEndTab from './YearEndTab';
import RetireTab from './RetireTab';

type MainTab = 'cgt' | 'gift' | 'yearend' | 'retire';

// taxpilot/index.html의 4개 탭(양도소득세/증여·상속세/연말정산/퇴직소득세)을 그대로 이식.
export default function TaxPilotScreen() {
  const [tab, setTab] = useState<MainTab>('cgt');
  const styles = useMemo(() => createStyles(), []);

  return (
    <AppScreen>
      <ScreenTitleBar title="해외주식 절세계산기" />
      <View style={styles.tabBar}>
        <SegmentedControl
          options={[
            { value: 'cgt', label: '양도소득세' },
            { value: 'gift', label: '증여·상속세' },
            { value: 'yearend', label: '연말정산' },
            { value: 'retire', label: '퇴직소득세' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as MainTab)}
        />
      </View>
      {tab === 'cgt' ? <CgtTab /> : null}
      {tab === 'gift' ? <GiftInheritTab /> : null}
      {tab === 'yearend' ? <YearEndTab /> : null}
      {tab === 'retire' ? <RetireTab /> : null}
    </AppScreen>
  );
}

function createStyles() {
  return StyleSheet.create({
    tabBar: { paddingHorizontal: 16, paddingTop: 8 },
  });
}
