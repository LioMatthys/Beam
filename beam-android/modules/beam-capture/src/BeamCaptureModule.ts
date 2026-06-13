import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  BeamCaptureEvents,
  CaptureConfig,
  CaptureInfo,
} from './BeamCapture.types';

declare class BeamCaptureModule extends NativeModule<BeamCaptureEvents> {
  /** The device's current Wi-Fi LAN IP, or '' if not on Wi-Fi. */
  getIpAddress(): string;
  isRunning(): boolean;
  /**
   * Prompts for the system screen-capture permission, then starts the
   * foreground capture service and TCP server. Resolves once listening.
   */
  start(config: CaptureConfig): Promise<CaptureInfo>;
  stop(): Promise<void>;
}

// Optional: returns null when the native module isn't present (Expo Go, or a
// build where autolinking didn't include it). Callers MUST guard so the app
// degrades gracefully instead of hard-crashing at startup.
export default requireOptionalNativeModule<BeamCaptureModule>('BeamCapture');
