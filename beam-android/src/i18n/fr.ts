export const fr = {
  connect: {
    eyebrow: 'ÉMETTEUR',
    tagline: 'Diffuse ton écran vers ton PC, par Wi-Fi.',
    start: 'Démarrer le partage',
    stop: 'Arrêter le partage',
    instructions: 'Sur le PC, ouvre Beam et saisis :',
    ip: 'Adresse IP',
    port: 'Port',
    code: 'Code',
    waitingTitle: 'En attente du PC',
    waitingHint: 'Garde cet écran ouvert. La capture démarre quand un PC se connecte.',
    liveTitle: 'Un PC regarde ton écran',
    liveHint: 'Tu peux utiliser ton téléphone normalement.',
    sharingNow: 'Partage',
    noWifi: 'Connecte-toi à un réseau Wi-Fi pour partager ton écran.',
    settings: 'Réglages',
    fps: 'i/s',
  },
  settings: {
    eyebrow: 'RÉGLAGES',
    title: 'Qualité du flux',
    resolution: 'Résolution max',
    resolutionAuto: 'Native',
    bitrate: 'Débit',
    fps: 'Images / seconde',
    note: 'Un débit ou une résolution plus bas réduit la latence sur un Wi-Fi lent.',
    done: 'Terminé',
  },
  errors: {
    permissionDenied: 'Permission de capture refusée.',
    generic: 'Une erreur est survenue.',
  },
};

export type Dict = typeof fr;
