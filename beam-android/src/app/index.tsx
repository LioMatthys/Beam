import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { StatusPill } from '@/components/status-pill';
import { Colors } from '@/constants/theme';
import { BeamCapture } from '@/data/beam-capture';
import { useConnection } from '@/data/connection-context';
import { useT } from '@/i18n';

const c = Colors.dark;

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { state, info, stats, error, start, stop } = useConnection();

  const [wifiIp, setWifiIp] = useState('');
  useEffect(() => {
    try {
      setWifiIp(BeamCapture ? BeamCapture.getIpAddress() : '');
    } catch {
      setWifiIp('');
    }
  }, [state]);

  // 'starting' stays on the idle view (the Start button shows a spinner) until the
  // service reports 'waiting' and we switch to the connection card.
  const sharing = state === 'waiting' || state === 'streaming';

  const statusLabel =
    state === 'streaming'
      ? t('connect', 'liveTitle')
      : sharing
        ? t('connect', 'waitingTitle')
        : t('connect', 'tagline');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} />
          <Text style={styles.wordmark}>Beam</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={styles.gearBtn}>
          <Image source={require('@/assets/images/gear.png')} style={styles.gearIcon} />
        </Pressable>
      </View>

      {/* Status, below the Beam title/logo. */}
      <View style={styles.statusRow}>
        <StatusPill state={state} />
        <Text style={styles.statusText} numberOfLines={2}>
          {statusLabel}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        {!sharing ? (
          <View style={styles.heroIdle}>
            <GradientButton label={t('connect', 'start')} onPress={start} loading={state === 'starting'} />
            {!wifiIp && <Text style={styles.warn}>{t('connect', 'noWifi')}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        ) : (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardCaption}>{t('connect', 'instructions')}</Text>
              <InfoRow label={t('connect', 'ip')} value={info?.ip ?? wifiIp ?? '—'} />
              <InfoRow label={t('connect', 'port')} value={String(info?.port ?? 8787)} />
              <View style={styles.divider} />
              <Text style={styles.codeLabel}>{t('connect', 'code')}</Text>
              <Text style={styles.code}>{info?.code ?? '••••••'}</Text>
            </View>

            {state === 'streaming' && (
              <Text style={styles.stat}>
                {stats.fps} {t('connect', 'fps')} · {Math.round(stats.kbps / 1000)} Mb/s
              </Text>
            )}

            <View style={{ height: 20 }} />
            <Pressable onPress={stop} style={styles.stopBtn}>
              <Text style={styles.stopText}>{t('connect', 'stop')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
    paddingVertical: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 7 },
  wordmark: { color: c.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  gearBtn: { padding: 4 },
  gearIcon: { width: 26, height: 26, tintColor: c.textMuted },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 2,
    marginBottom: 6,
  },
  statusText: { flex: 1, color: c.textMuted, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },

  heroIdle: { alignItems: 'stretch' },
  eyebrow: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  tagline: {
    color: c.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 30,
  },
  warn: { color: c.warning, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  error: { color: c.danger, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },

  liveTitle: { color: c.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' },
  liveHint: { color: c.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  card: {
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 20,
    marginTop: 24,
  },
  cardCaption: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  infoValue: { color: c.text, fontSize: 18, fontWeight: '800', fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
  codeLabel: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  code: {
    color: c.accent,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 8,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 6,
  },
  stat: { color: c.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 16, fontFamily: 'monospace' },

  stopBtn: {
    borderWidth: 1,
    borderColor: c.dangerSurface,
    backgroundColor: c.dangerSurface,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  stopText: { color: c.danger, fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  settingsRow: { alignItems: 'center', paddingTop: 8 },
  settingsText: { color: c.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
});
