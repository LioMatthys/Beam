import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BrandGradient, Colors } from '@/constants/theme';

const c = Colors.dark;

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/**
 * Primary CTA with the brand lime → teal gradient (Tempo GradientButton).
 * Falls back to a flat disabled state.
 */
export function GradientButton({
  label,
  onPress,
  disabled,
  loading,
  size = 'lg',
  style,
}: GradientButtonProps) {
  const sizing = SIZE_STYLES[size];

  if (disabled) {
    return (
      <View style={[styles.disabled, sizing.container, style]}>
        <Text style={[sizing.text, { color: c.textDim }]}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, sizing.container, style, pressed && { opacity: 0.85 }]}>
      <LinearGradient
        colors={BrandGradient.colors}
        start={BrandGradient.start}
        end={BrandGradient.end}
        style={[StyleSheet.absoluteFill, sizing.container]}
      />
      <View style={styles.row}>
        {loading && <ActivityIndicator color={c.background} style={{ marginRight: 8 }} />}
        <Text style={[sizing.text, { color: c.background }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  disabled: {
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const SIZE_STYLES = {
  sm: {
    container: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 } as ViewStyle,
    text: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 } as TextStyle,
  },
  md: {
    container: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 } as ViewStyle,
    text: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8 } as TextStyle,
  },
  lg: {
    container: { paddingVertical: 17, paddingHorizontal: 20, borderRadius: 14 } as ViewStyle,
    text: { fontSize: 15, fontWeight: '900', letterSpacing: 1 } as TextStyle,
  },
} as const;
