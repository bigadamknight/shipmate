import { useEffect, useRef } from 'react'

export function useWakeLock() {
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    async function acquire() {
      if (!('wakeLock' in navigator)) return
      try {
        wakeLock.current = await navigator.wakeLock.request('screen')
      } catch {
        // Wake lock request failed (e.g. low battery)
      }
    }

    acquire()

    // Re-acquire on visibility change (tab/app switch back)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      wakeLock.current?.release()
    }
  }, [])
}
