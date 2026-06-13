import { registerWebModule, NativeModule } from 'expo';

import type {
  BeamCaptureEvents,
  CaptureConfig,
  CaptureInfo,
} from './BeamCapture.types';

/** Web stub — screen capture is Android-only. Methods reject/no-op on web. */
class BeamCaptureModule extends NativeModule<BeamCaptureEvents> {
  getIpAddress(): string {
    return '';
  }
  isRunning(): boolean {
    return false;
  }
  async start(_config: CaptureConfig): Promise<CaptureInfo> {
    throw new Error('Beam capture is only available on Android.');
  }
  async stop(): Promise<void> {
    /* no-op */
  }
}

export default registerWebModule(BeamCaptureModule, 'BeamCaptureModule');
