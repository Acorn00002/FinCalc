import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

// css/styles.css의 .brand-logo-svg(사이드바 로고, 헤더 로고에 쓰이는 화살표)를 그대로 이식 —
// 앱 아이콘과 같은 화살표 모양이지만 원형 테두리는 빼고 화살표만 사용한다.
export default function BrandArrowIcon({ size = 22, color = '#585CE5' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
      <G transform="rotate(-45 512 512)">
        <Path d="M1042 512 L175 73 L354 512 Z" fill={color} />
        <Path d="M1042 512 L354 512 L175 951 Z" fill={color} fillOpacity={0.6} />
      </G>
    </Svg>
  );
}
