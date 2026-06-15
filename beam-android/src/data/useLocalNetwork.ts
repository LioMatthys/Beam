import { useEffect, useState } from 'react';
import { BeamCapture } from './beam-capture';

/** Single source of truth for local network IP. */
export function useLocalNetwork() {
  const [ip, setIp] = useState('');

  useEffect(() => {
    try {
      setIp(BeamCapture?.getIpAddress?.() ?? '');
    } catch {
      setIp('');
    }
  }, []);

  return ip;
}
