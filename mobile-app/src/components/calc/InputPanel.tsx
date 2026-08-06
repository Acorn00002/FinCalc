import React from 'react';
import { StyleSheet, ViewProps } from 'react-native';
import Card from '../ui/Card';

// finpilot/css/styles.css의 .input-panel.glass-panel(모바일: radius 20px, padding 20px)에 맞춤.
// 웹은 계산기의 모든 입력 필드를 이 카드 하나로 묶어서 보여주는데, 지금까지 네이티브는 NumberField를
// 배경 위에 그냥 나란히 띄워서(카드 없이) 웹과 화면 구성이 달라 보였다 — 이 컴포넌트로 그 차이를 없앤다.
export default function InputPanel({ style, children, ...rest }: ViewProps) {
  return (
    <Card style={[styles.panel, style]} {...rest}>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, padding: 20, marginBottom: 16 },
});
