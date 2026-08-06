import React from 'react';
import AppScreen from '../components/AppScreen';
import ComingSoon from '../components/ui/ComingSoon';

export default function NoticeScreen() {
  return (
    <AppScreen>
      <ComingSoon
        icon="notifications-outline"
        title="공지사항"
        description="자산 파일럿의 새로운 소식과 업데이트를 이곳에서 안내해 드릴게요."
      />
    </AppScreen>
  );
}
