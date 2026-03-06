import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, type MotionValue } from 'motion/react'

// Polls volume from ElevenLabs SDK and returns a spring-driven MotionValue (0-1).
// Using MotionValue avoids React re-renders entirely — updates go straight to the DOM.
export function useAudioMouth(
  isSpeaking: boolean,
  getVolume: (() => number) | undefined,
  getFrequencyData: (() => Uint8Array | undefined) | undefined,
): MotionValue<number> {
  const rawOpenness = useMotionValue(0)
  const openness = useSpring(rawOpenness, { stiffness: 300, damping: 18 })
  const rafRef = useRef(0)

  useEffect(() => {
    if (!isSpeaking) {
      rawOpenness.set(0)
      return
    }

    function sample() {
      let vol = 0

      // Try frequency data first (more reliable)
      if (getFrequencyData) {
        const data = getFrequencyData()
        if (data && data.length > 0) {
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            sum += data[i]!
          }
          vol = sum / data.length / 255
        }
      }

      // Fall back to volume getter
      if (vol === 0 && getVolume) {
        vol = getVolume()
      }

      // Boost for visible mouth movement
      const mapped = Math.min(1, Math.pow(vol * 2.5, 0.6))
      rawOpenness.set(mapped)

      rafRef.current = requestAnimationFrame(sample)
    }

    rafRef.current = requestAnimationFrame(sample)

    return () => {
      cancelAnimationFrame(rafRef.current)
      rawOpenness.set(0)
    }
  }, [isSpeaking, getVolume, getFrequencyData])

  return openness
}
