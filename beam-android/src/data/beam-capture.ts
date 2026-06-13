/**
 * App-facing re-export of the local native module so screens import it via the
 * `@/` alias instead of a long relative path into `modules/`.
 *
 * `BeamCapture` is null when the native module isn't present (Expo Go, or a
 * build where it wasn't linked); use `isCaptureAvailable` to guard.
 */
import { BeamCapture } from '../../modules/beam-capture';

export { BeamCapture };
export const isCaptureAvailable = BeamCapture != null;

export type {
  CaptureConfig,
  CaptureInfo,
  CaptureState,
  StatusEvent,
  StatsEvent,
  ErrorEvent,
} from '../../modules/beam-capture';
