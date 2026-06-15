import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useConnection } from '@/data/connection-context';
import { useT } from '@/i18n';

const c = Colors.dark;

const RESOLUTIONS = [
  { label: 'Native', value: 0 },
  { label: '1920', value: 1920 },
  { label: '1280', value: 1280 },
  { label: '960', value: 960 },
];
const BITRATES = [2, 4, 8, 12, 20];
const FPS = [30, 60];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { settings, updateSettings } = useConnection();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('settings', 'eyebrow')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.done}>{t('settings', 'done')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.title}>{t('settings', 'title')}</Text>

        <Group label={t('settings', 'resolution')}>
          <Segmented
            options={RESOLUTIONS.map((r) => ({
              label: r.value === 0 ? t('settings', 'resolutionAuto') : r.label,
              value: r.value,
            }))}
            value={settings.maxSize}
            onChange={(v) => updateSettings({ maxSize: v })}
          />
        </Group>

        <Group label={`${t('settings', 'bitrate')} — ${settings.bitrateMbps} Mb/s`}>
          <Segmented
            options={BITRATES.map((b) => ({ label: `${b}`, value: b }))}
            value={settings.bitrateMbps}
            onChange={(v) => updateSettings({ bitrateMbps: v })}
          />
        </Group>

        <Group label={t('settings', 'fps')}>
          <Segmented
            options={FPS.map((f) => ({ label: `${f}`, value: f }))}
            value={settings.fps}
            onChange={(v) => updateSettings({ fps: v })}
          />
        </Group>

        <Text style={styles.note}>{t('settings', 'note')}</Text>
      </ScrollView>
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.groupLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segItem, active && styles.segItemActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrow: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  done: { color: c.accent, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: c.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },

  groupLabel: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segItem: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  segItemActive: { backgroundColor: c.surfaceElevated },
  segText: { color: c.textMuted, fontSize: 13, fontWeight: '800' },
  segTextActive: { color: c.accent },

  note: { color: c.textDim, fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 28 },
});
