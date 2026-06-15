import { useMemo } from 'react';
import type { CaptureState } from '@/data/beam-capture';
import { useT } from '@/i18n';

/** Compute display state from connection state (pure, testable). */
export function useConnectionDisplay(state: CaptureState) {
  const { t } = useT();

  return useMemo(() => {
    const isSharing = state === 'waiting' || state === 'streaming';
    const titleKey = state === 'streaming' ? 'liveTitle' : isSharing ? 'waitingTitle' : 'tagline';

    return {
      isSharing,
      title: t('connect', titleKey),
      hint: state === 'streaming'
        ? t('connect', 'liveHint')
        : isSharing
          ? t('connect', 'waitingHint')
          : undefined,
    };
  }, [state, t]);
}
