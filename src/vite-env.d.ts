/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_AGENT_ID?: string
}

interface WakeLockSentinel {
  release(): Promise<void>
  readonly released: boolean
  readonly type: 'screen'
}

interface Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>
  }
}
