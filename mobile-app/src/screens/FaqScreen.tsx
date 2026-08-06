import React from 'react';
import AppScreen from '../components/AppScreen';
import ComingSoon from '../components/ui/ComingSoon';

export default function FaqScreen() {
  return (
    <AppScreen>
      <ComingSoon
        icon="help-circle-outline"
        title="자주 묻는 질문"
        description="자산 파일럿 이용 중 궁금한 점을 빠르게 찾아볼 수 있도록 준비하고 있어요."
      />
    </AppScreen>
  );
}
