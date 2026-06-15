import { useEffect, useState } from 'react'

interface NetworkInfo {
  ip: string
  ssid: string
}

/** Single source of truth for this PC's network info. */
export function useNetworkInfo() {
  const [net, setNet] = useState<NetworkInfo>({ ip: '', ssid: '' })

  useEffect(() => {
    void window.beam.netInfo().then(setNet)
  }, [])

  return net
}
