import type { Dict } from './fr';

export const en: Dict = {
  connect: {
    eyebrow: 'SENDER',
    tagline: 'Stream your screen to your PC, over Wi-Fi.',
    start: 'Start sharing',
    stop: 'Stop sharing',
    instructions: 'On the PC, open Beam and enter:',
    ip: 'IP address',
    port: 'Port',
    code: 'Code',
    waitingTitle: 'Waiting for the PC',
    waitingHint: 'Keep this screen open. Capture starts when a PC connects.',
    liveTitle: 'A PC is watching your screen',
    liveHint: 'You can use your phone normally.',
    noWifi: 'Connect to a Wi-Fi network to share your screen.',
    settings: 'Settings',
    fps: 'fps',
  },
  settings: {
    eyebrow: 'SETTINGS',
    title: 'Stream quality',
    resolution: 'Max resolution',
    resolutionAuto: 'Native',
    bitrate: 'Bitrate',
    fps: 'Frames / second',
    note: 'A lower bitrate or resolution reduces latency on a slow Wi-Fi.',
    done: 'Done',
  },
  errors: {
    permissionDenied: 'Screen-capture permission denied.',
    generic: 'Something went wrong.',
  },
};
