import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { BrandGradient, Colors } from '@/constants/theme';

const c = Colors.dark;
const SIZE = 200;

/**
 * The "live sharing" indicator: a breathing brand-gradient disc that reads "Sharing",
 * with two staggered radar rings expanding out of it. Shown while a PC is actually
 * watching (replaces the IP/port/code card, which is only needed before connecting).
 */
export function SharingPulse({ label }: { label: string }) {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ring = (v: Animated.Value) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
    const a = ring(ringA);
    a.start();
    // Stagger the second ring so the radar feels continuous.
    const delay = setTimeout(() => ring(ringB).start(), 1200);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breathing.start();
    return () => {
      a.stop();
      breathing.stop();
      clearTimeout(delay);
    };
  }, [ringA, ringB, breathe]);

  const ringStyle = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
  });
  const coreStyle = {
    transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, ringStyle(ringA)]} />
      <Animated.View style={[styles.ring, ringStyle(ringB)]} />
      <Animated.View style={coreStyle}>
        <LinearGradient
          colors={BrandGradient.colors}
          start={BrandGradient.start}
          end={BrandGradient.end}
          style={styles.core}>
          <Text style={styles.text}>{label}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', height: SIZE * 1.7 },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: c.accent,
  },
  core: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: c.background, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
});
