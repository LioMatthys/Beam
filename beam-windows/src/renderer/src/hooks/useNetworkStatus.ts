import { useMemo } from 'react'

interface NetworkInfo {
  ip: string
  ssid: string
}

/** Compute network status display (same subnet check, display text). */
export function useNetworkStatus(phoneIp: string | undefined, pcNet: NetworkInfo) {
  return useMemo(() => {
    if (!phoneIp || !pcNet.ip) return null

    const netPrefix = (ip: string): string => ip.split('.').slice(0, 2).join('.')
    const sameSubnet = netPrefix(phoneIp) === netPrefix(pcNet.ip)

    return {
      phoneIp,
      pcIp: pcNet.ip,
      ssid: pcNet.ssid,
      sameSubnet,
      statusText: sameSubnet ? 'same network ✓' : 'different network — check Wi-Fi',
    }
  }, [phoneIp, pcNet.ip, pcNet.ssid])
}
