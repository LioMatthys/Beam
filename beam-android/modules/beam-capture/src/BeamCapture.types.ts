/** Lifecycle of a capture session. */
export type CaptureState = 'idle' | 'starting' | 'waiting' | 'streaming' | 'error';

/** Tunables passed to `start()`. All optional — sensible defaults apply natively. */
export interface CaptureConfig {
  /** Cap the longest screen edge (px). Lower = less bandwidth. Default: device resolution. */
  maxSize?: number;
  /** Target video bitrate in megabits/sec. Default: 8. */
  bitrateMbps?: number;
  /** Target frames per second. Default: 60. */
  fps?: number;
}

/** Returned by `start()` once the server is listening. */
export interface CaptureInfo {
  ip: string;
  port: number;
  code: string;
  width: number;
  height: number;
}

export interface StatusEvent {
  state: CaptureState;
  /** Number of connected receivers (0 or 1 in v1). */
  clients: number;
  /** True when the connected receiver is over TLS (encrypted). */
  secure?: boolean;
}

export interface StatsEvent {
  fps: number;
  kbps: number;
}

export interface ErrorEvent {
  message: string;
}

export type BeamCaptureEvents = {
  onStatus: (event: StatusEvent) => void;
  onStats: (event: StatsEvent) => void;
  onError: (event: ErrorEvent) => void;
};
