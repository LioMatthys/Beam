import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { CaptureState } from '@/data/beam-capture';

const c = Colors.dark;

const MAP: Record<CaptureState, { color: string; label: string; pulse: boolean }> = {
  idle: { color: c.textDim, label: 'OFFLINE', pulse: false },
  starting: { color: c.warning, label: 'STARTING…', pulse: true },
  waiting: { color: c.teal, label: 'WAITING FOR PC', pulse: true },
  streaming: { color: c.accent, label: 'LIVE', pulse: true },
  error: { color: c.danger, label: 'ERROR', pulse: false },
};

export function StatusPill({ state }: { state: CaptureState }) {
  const m = MAP[state];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!m.pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [m.pulse, pulse]);

  return (
    <View style={styles.pill}>
      <Animated.View style={[styles.dot, { backgroundColor: m.color, opacity: m.pulse ? pulse : 1 }]} />
      <Text style={[styles.label, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dot: { width: 9, height: 9, borderRadius: 999 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
