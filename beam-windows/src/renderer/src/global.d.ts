/// <reference types="vite/client" />
import type { BeamApi } from '../../shared/api'

declare global {
  interface Window {
    beam: BeamApi
  }
}

export {}
