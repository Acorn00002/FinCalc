import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import BrandArrowIcon from './BrandArrowIcon';
import { useAppTheme } from '../context/ThemeContext';

type Props = { onDone: () => void };

// 네이티브 OS 스플래시(아이콘)를 내리자마자 이 화면이 그 자리를 그대로 이어받아 화살표가
// 날아가는 인트로를 재생한다 — 홈 화면(헤더+웹뷰+하단바)은 이 애니메이션이 끝난 뒤에야 보여준다.
// 예전엔 이 모션을 웹페이지(index.html의 .app-splash) CSS 애니메이션에 맡겼는데, 웹뷰가 로딩되는
// 동안 이미 네이티브 헤더/하단바가 먼저 마운트돼 있어서 "홈 화면 안에서 아이콘이 움직이는" 것처럼
// 보이는 문제가 있었다 — 웹뷰 로딩 속도와 무관하게 항상 같은 타이밍으로 재생되도록 완전히
// 네이티브(Animated)로 옮겼다.
export default function AppIntroSplash({ onDone }: Props) {
  const { colors } = useAppTheme();
  // 아이콘 자체(셸+링)는 등장 애니메이션 없이 처음부터 완전히 보이는 상태로 그린다 — 네이티브 OS
  // 스플래시가 마지막으로 보여준 정지 아이콘과 그대로 이어지도록. 페이드인/스케일인을 넣으면 그
  // 자체가 "가만히 있다가" 처럼 보여서(사용자 피드백) 아예 없앴다.
  const shellOpacity = useRef(new Animated.Value(1)).current;
  // 화살표만 마운트되는 즉시(딜레이 없이) 조준 위치에서 시작해 발사 동작을 재생한다 — 화면에
  // 그려지는 첫 프레임부터 이미 "조준 중"인 자세라 정지한 것처럼 보이는 프레임이 없다.
  const arrowX = useRef(new Animated.Value(-3)).current;
  const arrowY = useRef(new Animated.Value(3)).current;
  const arrowScale = useRef(new Animated.Value(0.9)).current;
  const arrowRotate = useRef(new Animated.Value(-6)).current;
  const arrowOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 페이드아웃 구간을 다시 2배로 늘렸다(375ms→750ms, 465ms→930ms) — 이동/회전/확대 구간도 그 끝
    // 시점(1250ms)까지 같이 늘려서, 다 사라질 때까지 화살표가 계속 날아가는 채로 보이게 했다.
    Animated.parallel([
      Animated.timing(arrowX, { toValue: 190, duration: 1250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(arrowY, { toValue: -190, duration: 1250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(arrowScale, { toValue: 2.4, duration: 1250, useNativeDriver: true }),
      Animated.timing(arrowRotate, { toValue: 8, duration: 1250, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(arrowOpacity, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(shellOpacity, { toValue: 0, duration: 930, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]} pointerEvents="none">
      <View style={styles.stack}>
        <Animated.View style={[styles.shell, { opacity: shellOpacity }]}>
          <View style={styles.ring} />
        </Animated.View>
        <Animated.View
          style={{
            opacity: arrowOpacity,
            transform: [
              { translateX: arrowX },
              { translateY: arrowY },
              { scale: arrowScale },
              { rotate: arrowRotate.interpolate({ inputRange: [-6, 8], outputRange: ['-6deg', '8deg'] }) },
            ],
          }}
        >
          <BrandArrowIcon size={38} color="#ffffff" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  stack: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#585CE5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#585CE5',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  ring: { width: 62, height: 62, borderRadius: 31, borderWidth: 5, borderColor: '#ffffff' },
});
