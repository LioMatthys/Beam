import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { BeamCapture } from '@/data/beam-capture';
import type { CaptureInfo, CaptureState } from '@/data/beam-capture';
import {
  CaptureSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  toConfig,
} from '@/data/storage';

interface ConnectionValue {
  state: CaptureState;
  clients: number;
  secure: boolean;
  info: CaptureInfo | null;
  stats: { fps: number; kbps: number };
  error: string | null;
  settings: CaptureSettings;
  ready: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  updateSettings: (patch: Partial<CaptureSettings>) => void;
}

const Ctx = createContext<ConnectionValue | null>(null);

/**
 * Single source of truth for the capture session. Mirrors the reference app's
 * Context + storage pattern: load persisted settings on mount, subscribe to the
 * native module's events, and expose imperative start/stop.
 */
export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CaptureState>('idle');
  const [clients, setClients] = useState(0);
  const [secure, setSecure] = useState(false);
  const [info, setInfo] = useState<CaptureInfo | null>(null);
  const [stats, setStats] = useState({ fps: 0, kbps: 0 });
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!BeamCapture) return;
    const subs = [
      BeamCapture.addListener('onStatus', (e) => {
        setState(e.state);
        setClients(e.clients);
        setSecure(e.secure ?? false);
      }),
      BeamCapture.addListener('onStats', (e) => setStats({ fps: e.fps, kbps: e.kbps })),
      BeamCapture.addListener('onError', (e) => {
        setError(e.message);
        setState('error');
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const start = useCallback(async () => {
    if (!BeamCapture) {
      setError('Screen capture unavailable: native module missing from this build.');
      setState('error');
      return;
    }
    setError(null);
    setState('starting');
    try {
      const i = await BeamCapture.start(toConfig(settings));
      setInfo(i);
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }, [settings]);

  const stop = useCallback(async () => {
    try {
      await BeamCapture?.stop();
    } finally {
      setInfo(null);
      setState('idle');
      setStats({ fps: 0, kbps: 0 });
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<CaptureSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<ConnectionValue>(
    () => ({ state, clients, secure, info, stats, error, settings, ready, start, stop, updateSettings }),
    [state, clients, secure, info, stats, error, settings, ready, start, stop, updateSettings]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection(): ConnectionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider');
  return ctx;
}
