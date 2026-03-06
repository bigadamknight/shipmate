import { useRef, useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import type { CompanionState } from '../types'
import type { FaceTrackStatus } from '../hooks/useFaceTracking'

type AccentType = 'waves-both' | 'dots' | 'sparkles' | 'confetti' | 'zzz' | 'brackets' | 'sweat' | 'exclamation' | 'bell' | 'hourglass' | 'notify-waves'

interface CharacterProps {
  state: CompanionState
  editMode?: boolean
  eyeOffset?: { x: number; y: number }
  bodyOffset?: { x: number; y: number } // head rotation -> body position
  mouthOpenness?: MotionValue<number> // 0-1, driven by audio analysis
  faceTrackDebug?: boolean
  faceTrackStatus?: FaceTrackStatus
  onSvgClick?: (coords: { x: number; y: number }) => void
}

// Eye shape paths for different states
const eyePaths = {
  // Default dot eyes (from Illustrator)
  dot: {
    left: 'M115.58,132.02c11.46-4.06,22.83,1.56,26.64,11.68,4.2,11.13-.33,23.78-11.35,28-10.81,4.15-23.52-.93-27.9-12.03-4.13-10.48.75-23.45,12.61-27.65Z',
    right: 'M225.97,132.22c11.86-4.73,23.5,2.01,27.06,11.62,4.18,11.28-.65,23.87-11.24,27.77-10.58,3.89-22.78-.24-27.26-10.52-4.43-10.18-1.18-23.83,11.43-28.87Z',
  },
  // Dot eyes shifted closer together and to the right (listening)
  dotRight: {
    left: 'M140,140 a14,14 0 1,1 0.01,0Z',
    right: 'M230,140 a14,14 0 1,1 0.01,0Z',
  },
  // Happy ^_^ closed arc eyes
  arc: {
    left: 'M105,155 Q120,135 140,155',
    right: 'M220,155 Q235,135 255,155',
  },
  // Thinking eyes - asymmetric with eyebrows
  thinking: {
    left: 'M110,150 a16,16 0 1,1 0.01,0Z',
    right: 'M235,155 a12,12 0 1,1 0.01,0Z',
  },
  // Sleeping flat line eyes
  line: {
    left: 'M105,148 L140,148',
    right: 'M220,148 L255,148',
  },
  // Error X eyes
  x: {
    left: 'M100,133 L140,163 M140,133 L100,163',
    right: 'M220,133 L260,163 M260,133 L220,163',
  },
}

// Mouth paths for different states
const mouthPaths = {
  // Default smile (from Illustrator)
  smile: 'M227.39,213.15c4.02-4.43,8.84-4.77,11.85-3.49,3.82,1.62,7.51,8.88,3.9,13.14-33.51,39.52-94.62,39.97-128.79,1.12-4-4.55-3.49-9.63.28-12.89,3.41-2.95,9.46-2.52,13.21,1.57,26.64,29.09,72.35,30.49,99.56.55Z',
  // Speaking - small rounded rect mouth that scales with audio
  open: 'M160,222 Q160,215 168,215 L188,215 Q196,215 196,222 L196,228 Q196,235 188,235 L168,235 Q160,235 160,228Z',
  // Confused wavy
  wavy: 'M140,230 Q155,220 170,235 Q185,250 200,230 Q215,215 230,230',
  // Flat line (sleeping/focused)
  flat: 'M145,230 L215,230',
  // Flat line offset to the left
  flatLeft: 'M115,230 L185,230',
  // Smirk - flat then curves up on right
  smirk: 'M140,230 L195,230 Q215,230 220,218',
  // Big happy grin
  grin: 'M130,210 Q178,270 230,210',
  // Surprised O mouth (bigger)
  surprised: 'M155,218 Q155,248 178,248 Q201,248 201,218 Q201,192 178,192 Q155,192 155,218Z',
}

// State configs: which eyes, mouth, body transform, and accents to show
const stateConfig: Record<CompanionState, {
  eyes: keyof typeof eyePaths
  eyeStyle: 'fill' | 'stroke'
  eyeStrokeWidth: number
  mouth: keyof typeof mouthPaths
  mouthStyle: 'fill' | 'stroke'
  mouthStrokeWidth: number
  bodyRotate: number
  bodyScale: number
  bodyY: number
  accents: AccentType[]
  glowScale: number
  glowOpacity: number
}> = {
  idle: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'smile', mouthStyle: 'fill', mouthStrokeWidth: 0,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: [],
    glowScale: 1, glowOpacity: 0.15,
  },
  listening: {
    eyes: 'dotRight', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'smirk', mouthStyle: 'stroke', mouthStrokeWidth: 10,
    bodyRotate: -8, bodyScale: 1, bodyY: -5,
    accents: ['waves-both'],
    glowScale: 1.05, glowOpacity: 0.2,
  },
  speaking: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'open', mouthStyle: 'fill', mouthStrokeWidth: 0,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: [],
    glowScale: 1.08, glowOpacity: 0.25,
  },
  thinking: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'flatLeft', mouthStyle: 'stroke', mouthStrokeWidth: 14,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: ['dots'],
    glowScale: 1, glowOpacity: 0.15,
  },
  happy: {
    eyes: 'arc', eyeStyle: 'stroke', eyeStrokeWidth: 12,
    mouth: 'grin', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 1.02, bodyY: -3,
    accents: ['sparkles'],
    glowScale: 1.1, glowOpacity: 0.3,
  },
  confused: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'wavy', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 12, bodyScale: 1, bodyY: 0,
    accents: ['sweat'],
    glowScale: 1, glowOpacity: 0.1,
  },
  celebrating: {
    eyes: 'arc', eyeStyle: 'stroke', eyeStrokeWidth: 12,
    mouth: 'grin', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 1.04, bodyY: -5,
    accents: ['sparkles', 'confetti'],
    glowScale: 1.15, glowOpacity: 0.35,
  },
  focused: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'smirk', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: ['brackets'],
    glowScale: 1.05, glowOpacity: 0.25,
  },
  sleeping: {
    eyes: 'line', eyeStyle: 'stroke', eyeStrokeWidth: 12,
    mouth: 'flat', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 0.98, bodyY: 3,
    accents: ['zzz'],
    glowScale: 0.95, glowOpacity: 0.08,
  },
  error: {
    eyes: 'x', eyeStyle: 'stroke', eyeStrokeWidth: 12,
    mouth: 'wavy', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: ['exclamation'],
    glowScale: 1.1, glowOpacity: 0.2,
  },
  notification: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'surprised', mouthStyle: 'fill', mouthStrokeWidth: 0,
    bodyRotate: -5, bodyScale: 1.01, bodyY: -3,
    accents: ['bell', 'notify-waves'],
    glowScale: 1.1, glowOpacity: 0.3,
  },
  loading: {
    eyes: 'dot', eyeStyle: 'fill', eyeStrokeWidth: 0,
    mouth: 'flat', mouthStyle: 'stroke', mouthStrokeWidth: 12,
    bodyRotate: 0, bodyScale: 1, bodyY: 0,
    accents: ['hourglass'],
    glowScale: 1, glowOpacity: 0.15,
  },
}

// Differentiated springs per element type for organic feel
const bodySpring = { type: 'spring' as const, stiffness: 120, damping: 30, mass: 1 }
const eyeSpring = { type: 'spring' as const, stiffness: 300, damping: 15 }
const mouthSpring = { type: 'spring' as const, stiffness: 180, damping: 12 }
const accentSpring = { type: 'spring' as const, stiffness: 150, damping: 8 }
const TEAL = '#2DD4BF'

function Accents({ types }: { types: AccentType[] }) {
  return (
    <AnimatePresence>
      {types.includes('waves-both') && (
        <motion.g
          key="waves-both"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, rotate: -8, scale: [1, 1.04, 1] }}
          exit={{ opacity: 0 }}
          transition={{ ...accentSpring, scale: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' } }}
          style={{ transformOrigin: '178px 178px' }}
        >
          {/* Right side */}
          <path d="M360,150 Q375,178 360,205" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
          <path d="M382,140 Q402,178 382,215" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
          <path d="M404,132 Q429,178 404,223" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
          {/* Left side */}
          <path d="M-4,150 Q-19,178 -4,205" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
          <path d="M-26,140 Q-46,178 -26,215" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
          <path d="M-48,132 Q-73,178 -48,223" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
        </motion.g>
      )}
      {types.includes('dots') && (
        <motion.g
          key="dots"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          <motion.circle cx="330" cy="30" r="8" fill={TEAL}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          <motion.circle cx="360" cy="30" r="8" fill={TEAL}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
          />
          <motion.circle cx="330" cy="60" r="8" fill={TEAL}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }}
          />
          <motion.circle cx="360" cy="60" r="8" fill={TEAL}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.9 }}
          />
        </motion.g>
      )}
      {types.includes('sparkles') && (
        <motion.g
          key="sparkles"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
        >
          {/* 4-pointed star top-left */}
          <motion.path d="M55,90 L60,75 L65,90 L80,95 L65,100 L60,115 L55,100 L40,95Z" fill={TEAL}
            animate={{ rotate: [0, 15, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ transformOrigin: '60px 95px' }}
          />
          {/* 4-pointed star top-right */}
          <motion.path d="M310,55 L314,44 L318,55 L329,59 L318,63 L314,74 L310,63 L299,59Z" fill={TEAL}
            animate={{ rotate: [0, -20, 0], scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            style={{ transformOrigin: '314px 59px' }}
          />
          {/* 4-pointed star bottom-left */}
          <motion.path d="M45,225 L49,216 L53,225 L62,229 L53,233 L49,242 L45,233 L36,229Z" fill={TEAL}
            animate={{ rotate: [0, 20, 0], scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2, delay: 1 }}
            style={{ transformOrigin: '49px 229px' }}
          />
        </motion.g>
      )}
      {types.includes('confetti') && (
        <motion.g
          key="confetti"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[45, 90, 135, 180, 225, 270, 315, 360].map((angle, i) => (
            <motion.rect
              key={angle}
              x="175" y="60"
              width="4" height="12"
              rx="2"
              fill={TEAL}
              style={{ transformOrigin: '178px 178px' }}
              initial={{ rotate: angle, opacity: 0 }}
              animate={{
                rotate: angle,
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.15 }}
            />
          ))}
        </motion.g>
      )}
      {types.includes('zzz') && (
        <motion.g
          key="zzz"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.text x="274" y="14" fill={TEAL} fontSize="34" fontWeight="bold"
            animate={{ y: [14, 4, 14], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >z</motion.text>
          <motion.text x="304" y="13" fill={TEAL} fontSize="40" fontWeight="bold"
            animate={{ y: [13, 3, 13], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 3, delay: 0.4 }}
          >Z</motion.text>
          <motion.text x="335" y="12" fill={TEAL} fontSize="34" fontWeight="bold"
            animate={{ y: [12, 2, 12], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 3, delay: 0.8 }}
          >Z</motion.text>
        </motion.g>
      )}
      {types.includes('brackets') && (
        <motion.g
          key="brackets"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Left chevron < */}
          <motion.path
            d="M-10,210 L-35,178 L-10,146"
            fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"
            animate={{ x: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          {/* Right chevron > */}
          <motion.path
            d="M366,146 L391,178 L366,210"
            fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"
            animate={{ x: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </motion.g>
      )}
      {types.includes('sweat') && (
        <motion.g
          key="sweat"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          {/* Water drop - pointed top, round bottom */}
          <motion.path
            d="M280,50 Q260,85 260,100 Q260,115 270,122 Q280,130 280,130 Q280,130 290,122 Q300,115 300,100 Q300,85 280,50Z"
            fill={TEAL}
            animate={{ y: [0, 5, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </motion.g>
      )}
      {types.includes('exclamation') && (
        <motion.g
          key="exclamation"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          style={{ transformOrigin: '300px 30px' }}
        >
          {/* Lines radiating from top-right corner */}
          <motion.line x1="320" y1="15" x2="350" y2="-25" stroke={TEAL} strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ transformOrigin: '320px 15px' }}
          />
          <motion.line x1="335" y1="35" x2="375" y2="5" stroke={TEAL} strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
            style={{ transformOrigin: '335px 35px' }}
          />
          <motion.line x1="345" y1="60" x2="385" y2="40" stroke={TEAL} strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
            style={{ transformOrigin: '345px 60px' }}
          />
          {/* White lines radiating from bottom-left corner */}
          <motion.line x1="11" y1="300" x2="-29" y2="320" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ transformOrigin: '11px 300px' }}
          />
          <motion.line x1="21" y1="320" x2="-19" y2="350" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
            style={{ transformOrigin: '21px 320px' }}
          />
          <motion.line x1="36" y1="335" x2="6" y2="375" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
            style={{ transformOrigin: '36px 335px' }}
          />
        </motion.g>
      )}
      {types.includes('bell') && (
        <motion.g
          key="bell"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {/* Bell shape at top-right */}
          <motion.path
            d="M290,-15 Q290,-45 305,-45 Q320,-45 320,-15 L328,-3 L282,-3Z M298,2 Q305,12 312,2"
            fill={TEAL} stroke="#000" strokeWidth="2"
            animate={{ rotate: [-10, 10, -10] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            style={{ transformOrigin: '305px -45px' }}
          />
          {/* Small lines around bell */}
          <line x1="275" y1="-35" x2="268" y2="-42" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
          <line x1="335" y1="-35" x2="342" y2="-42" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
        </motion.g>
      )}
      {types.includes('notify-waves') && (
        <motion.g
          key="notify-waves"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Vibration arcs top-left - rotated 45deg clockwise */}
          <g transform="rotate(45, 15, 35)">
            <motion.g
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ scale: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' } }}
              style={{ transformOrigin: '15px 35px' }}
            >
              <path d="M25,65 Q-5,35 25,5" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
              <path d="M5,75 Q-30,35 5,-5" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
            </motion.g>
          </g>
          {/* Vibration arcs bottom-right - rotated 45deg clockwise */}
          <g transform="rotate(45, 340, 320)">
            <motion.g
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ scale: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' } }}
              style={{ transformOrigin: '340px 320px' }}
            >
              <path d="M330,290 Q360,320 330,350" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
              <path d="M350,280 Q385,320 350,360" fill="none" stroke={TEAL} strokeWidth="10" strokeLinecap="round" />
            </motion.g>
          </g>
        </motion.g>
      )}
      {types.includes('hourglass') && (
        <motion.g
          key="hourglass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.path
            d="M320,270 L375,270 L358,300 L348,315 L338,300Z M320,360 L375,360 L358,330 L348,315 L338,330Z"
            fill={TEAL} stroke="#000" strokeWidth="2"
            animate={{ rotate: [0, 180, 360] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            style={{ transformOrigin: '348px 315px' }}
          />
        </motion.g>
      )}
    </AnimatePresence>
  )
}

export function Character({ state, editMode, eyeOffset, bodyOffset, mouthOpenness, faceTrackDebug, faceTrackStatus, onSvgClick }: CharacterProps) {
  const config = stateConfig[state]
  const eyes = eyePaths[config.eyes]
  const mouth = mouthPaths[config.mouth]
  const svgRef = useRef<SVGSVGElement>(null)

  // Mouth scale driven by MotionValue — no React re-renders
  const zeroMotion = useMotionValue(0)
  const mouthSource = mouthOpenness ?? zeroMotion
  const mouthScaleX = useTransform(mouthSource, (v: number) => state === 'speaking' ? 0.85 + v * 0.3 : 1)
  const mouthScaleY = useTransform(mouthSource, (v: number) => state === 'speaking' ? 0.6 + v * 0.7 : 1)

  // Smooth eye tracking with useMotionValue (no re-renders)
  const eyeXRaw = useMotionValue(0)
  const eyeYRaw = useMotionValue(0)
  const eyeX = useSpring(eyeXRaw, { stiffness: 300, damping: 15 })
  const eyeY = useSpring(eyeYRaw, { stiffness: 300, damping: 15 })

  useEffect(() => {
    if (config.eyeStyle === 'fill' && eyeOffset) {
      eyeXRaw.set(eyeOffset.x * 30) // Reduced 25% from 40
      eyeYRaw.set(eyeOffset.y * 22) // Reduced 25% from 30
    } else {
      eyeXRaw.set(0)
      eyeYRaw.set(0)
    }
  }, [eyeOffset?.x, eyeOffset?.y, config.eyeStyle])

  // Smooth body offset from head rotation
  const bodyXRaw = useMotionValue(0)
  const bodyXSpring = useSpring(bodyXRaw, { stiffness: 120, damping: 20 })

  useEffect(() => {
    if (bodyOffset) {
      bodyXRaw.set(bodyOffset.x * 30) // Max ~30px horizontal shift
    } else {
      bodyXRaw.set(0)
    }
  }, [bodyOffset?.x])

  // Breathing animation - subtle body scale pulse (only when idle)
  const [breathScale, setBreathScale] = useState(1)
  useEffect(() => {
    if (state !== 'idle') {
      setBreathScale(1)
      return
    }
    let frame: number
    const startTime = performance.now()
    function breathe() {
      const t = (performance.now() - startTime) / 1000
      // Gentle sine wave breathing: ~1.5% scale over 4 seconds
      setBreathScale(1 + Math.sin(t * Math.PI / 2) * 0.015)
      frame = requestAnimationFrame(breathe)
    }
    frame = requestAnimationFrame(breathe)
    return () => cancelAnimationFrame(frame)
  }, [state])

  // Blink cycle - occasional blinks for idle/listening/focused
  const [blinking, setBlinking] = useState(false)
  useEffect(() => {
    if (config.eyeStyle !== 'fill') return
    function scheduleBlink() {
      // Random interval between 3-7 seconds
      const delay = 3000 + Math.random() * 4000
      return setTimeout(() => {
        setBlinking(true)
        setTimeout(() => setBlinking(false), 150)
        timer = scheduleBlink()
      }, delay)
    }
    let timer = scheduleBlink()
    return () => clearTimeout(timer)
  }, [config.eyeStyle])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!editMode || !onSvgClick || !svgRef.current) return
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse())
    onSvgClick({ x: svgPt.x, y: svgPt.y })
  }, [editMode, onSvgClick])

  return (
    <svg
      ref={svgRef}
      onClick={handleClick}
      viewBox="-100 -80 560 520"
      style={{
        width: '100%',
        height: '100%',
        maxWidth: 500,
        maxHeight: 500,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        cursor: editMode ? 'crosshair' : 'default',
      }}
    >
      {/* Teal glow behind body - radial gradient instead of blur filter for mobile perf */}
      <defs>
        <radialGradient id="glow-grad">
          <stop offset="0%" stopColor={TEAL} stopOpacity="1" />
          <stop offset="60%" stopColor={TEAL} stopOpacity="0.3" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.ellipse
        cx="178" cy="178"
        rx="220" ry="218"
        fill="url(#glow-grad)"
        animate={{
          opacity: config.glowOpacity * 2.5,
          scale: config.glowScale,
        }}
        transition={bodySpring}
        style={{ transformOrigin: '178px 178px' }}
      />

      {/* Body */}
      <motion.g
        animate={state === 'idle' ? {
          rotate: [-4, 4, -4],
          scale: config.bodyScale * breathScale,
          y: config.bodyY,
        } : {
          rotate: config.bodyRotate,
          scale: config.bodyScale * breathScale,
          y: config.bodyY,
        }}
        transition={state === 'idle' ? {
          rotate: { repeat: Infinity, duration: 8, ease: 'easeInOut' },
          scale: bodySpring,
          y: bodySpring,
        } : bodySpring}
        style={{ transformOrigin: '178px 178px', x: bodyXSpring }}
      >
        {/* White fill for body interior */}
        <path
          d="M279.97,320.28c23.66-7.41,39.15-22.93,44.72-46.97,13.89-59.85,15.13-122.75,2.21-183.14-8.54-39.91-28.77-54.86-69.78-62.65-51.88-9.85-104.56-9.57-156.55-.27-39.02,6.98-61.49,20.91-70.41,59.76-14.01,60.99-13.1,124.99,1.47,185.58,5.64,23.44,19.46,38.64,41.83,46.45,56.03,19.56,147.43,19.74,206.51,1.24Z"
          fill="#FFFFFF"
        />
        {/* Body outline */}
        <path
          d="M289.74,338.63c-62.37,20.6-155.58,20.64-218.07,1.66-28.28-8.59-48.45-27.5-57.48-55.42C-3.44,230.4-3.93,144.74,8.8,89.06,18.98,44.52,37.56,21.29,85.09,10.22c61.03-14.22,167.91-17.08,222.75,14.42,20.32,11.67,32.02,31.68,37.48,55.43,15.06,65.43,14.31,134.72-1.46,199.92-7.07,29.24-26.5,49.51-54.13,58.64ZM279.97,320.28c23.66-7.41,39.15-22.93,44.72-46.97,13.89-59.85,15.13-122.75,2.21-183.14-8.54-39.91-28.77-54.86-69.78-62.65-51.88-9.85-104.56-9.57-156.55-.27-39.02,6.98-61.49,20.91-70.41,59.76-14.01,60.99-13.1,124.99,1.47,185.58,5.64,23.44,19.46,38.64,41.83,46.45,56.03,19.56,147.43,19.74,206.51,1.24Z"
          fill="#090a09"
        />

        {/* Eyes + eyebrows - offset together by face tracking */}
        <motion.g
          style={{ x: eyeX, y: eyeY }}
        >
          {/* Eyebrows (thinking state) — like focused but left raised higher */}
          {state === 'thinking' && (
            <>
              <path d="M105,110 L140,118" fill="none" stroke="#080808" strokeWidth="10" strokeLinecap="round" />
              <path d="M255,115 L220,120" fill="none" stroke="#080808" strokeWidth="10" strokeLinecap="round" />
            </>
          )}
          {/* Eyebrows (focused state) */}
          {state === 'focused' && (
            <>
              <path d="M105,115 L140,123" fill="none" stroke="#080808" strokeWidth="10" strokeLinecap="round" />
              <path d="M255,115 L220,123" fill="none" stroke="#080808" strokeWidth="10" strokeLinecap="round" />
            </>
          )}

          <motion.g
            animate={blinking ? { scaleY: 0.1 } : { scaleY: 1 }}
            transition={{ duration: 0.08 }}
            style={{ transformOrigin: '178px 148px' }}
          >
            <motion.path
              d={eyes.left}
              fill={config.eyeStyle === 'fill' ? '#080808' : 'none'}
              stroke={config.eyeStyle === 'stroke' ? '#080808' : 'none'}
              strokeWidth={config.eyeStrokeWidth}
              strokeLinecap="round"
              transition={eyeSpring}
            />
            <motion.path
              d={eyes.right}
              fill={config.eyeStyle === 'fill' ? '#080808' : 'none'}
              stroke={config.eyeStyle === 'stroke' ? '#080808' : 'none'}
              strokeWidth={config.eyeStrokeWidth}
              strokeLinecap="round"
              transition={eyeSpring}
            />
          </motion.g>
        </motion.g>

        {/* Mouth */}
        <motion.path
          d={mouth}
          fill={config.mouthStyle === 'fill' ? '#090a09' : 'none'}
          stroke={config.mouthStyle === 'stroke' ? '#090a09' : 'none'}
          strokeWidth={config.mouthStrokeWidth}
          strokeLinecap="round"
          transition={mouthSpring}
          style={{ transformOrigin: '178px 220px', scaleX: mouthScaleX, scaleY: mouthScaleY }}
        />
      </motion.g>

      {/* Accent elements */}
      <Accents types={config.accents} />

      {/* Edit mode grid overlay */}
      {editMode && (
        <g opacity="0.15" pointerEvents="none">
          {/* Grid lines every 50px */}
          {Array.from({ length: 12 }, (_, i) => (i - 2) * 50).map(v => (
            <g key={v}>
              <line x1={v} y1="-80" x2={v} y2="440" stroke="#2DD4BF" strokeWidth="0.5" />
              <line x1="-100" y1={v} x2="460" y2={v} stroke="#2DD4BF" strokeWidth="0.5" />
            </g>
          ))}
          {/* Axis labels */}
          {Array.from({ length: 12 }, (_, i) => (i - 2) * 50).map(v => (
            <g key={`label-${v}`}>
              <text x={v + 2} y="-68" fill="#2DD4BF" fontSize="8">{v}</text>
              <text x="-96" y={v + 10} fill="#2DD4BF" fontSize="8">{v}</text>
            </g>
          ))}
        </g>
      )}

      {/* Face tracking debug overlay */}
      {faceTrackDebug && (
        <g>
          {/* Status indicator */}
          <circle
            cx="-80"
            cy="400"
            r="6"
            fill={faceTrackStatus === 'active' ? '#44FF44' : faceTrackStatus === 'calibrating' ? '#FFAA00' : faceTrackStatus === 'no-face' ? '#FF4444' : faceTrackStatus === 'loading' ? '#4488FF' : '#888888'}
          />
          <text x="-68" y="405" fill="#FFFFFF" fontSize="12" fontFamily="monospace">
            {faceTrackStatus} eye=({eyeOffset?.x.toFixed(2)},{eyeOffset?.y.toFixed(2)}) body={bodyOffset?.x.toFixed(2)}
          </text>

          {/* Crosshair showing where face maps to */}
          {eyeOffset && faceTrackStatus === 'active' && (
            <>
              <circle
                cx={178 + (eyeOffset.x * 80)}
                cy={148 + (eyeOffset.y * 60)}
                r="8"
                fill="none"
                stroke="#FF4444"
                strokeWidth="2"
              />
              <line
                x1={178 + (eyeOffset.x * 80) - 12}
                y1={148 + (eyeOffset.y * 60)}
                x2={178 + (eyeOffset.x * 80) + 12}
                y2={148 + (eyeOffset.y * 60)}
                stroke="#FF4444"
                strokeWidth="1"
              />
              <line
                x1={178 + (eyeOffset.x * 80)}
                y1={148 + (eyeOffset.y * 60) - 12}
                x2={178 + (eyeOffset.x * 80)}
                y2={148 + (eyeOffset.y * 60) + 12}
                stroke="#FF4444"
                strokeWidth="1"
              />
            </>
          )}
        </g>
      )}
    </svg>
  )
}
