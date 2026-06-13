import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CaptureConfig } from '@/data/beam-capture';

const KEY_PREFIX = 'beam:';
const SETTINGS_KEY = `${KEY_PREFIX}settings`;

export interface CaptureSettings {
  /** Longest screen edge cap (px). 0 = native resolution. */
  maxSize: number;
  bitrateMbps: number;
  fps: number;
}

export const DEFAULT_SETTINGS: CaptureSettings = { maxSize: 0, bitrateMbps: 8, fps: 60 };

export async function loadSettings(): Promise<CaptureSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return DEFAULT_SETTINGS;
    return {
      maxSize: typeof p.maxSize === 'number' ? p.maxSize : DEFAULT_SETTINGS.maxSize,
      bitrateMbps: typeof p.bitrateMbps === 'number' ? p.bitrateMbps : DEFAULT_SETTINGS.bitrateMbps,
      fps: typeof p.fps === 'number' ? p.fps : DEFAULT_SETTINGS.fps,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: CaptureSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function toConfig(s: CaptureSettings): CaptureConfig {
  return {
    maxSize: s.maxSize > 0 ? s.maxSize : undefined,
    bitrateMbps: s.bitrateMbps,
    fps: s.fps,
  };
}
