import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type FaceTrackStatus = 'off' | 'loading' | 'calibrating' | 'active' | 'no-face' | 'error'

interface FaceTrackResult {
  // Eye offset driven by face POSITION in frame (where you are)
  eyeOffset: { x: number; y: number }
  // Body offset driven by head ROTATION (which way you're turning)
  bodyOffset: { x: number; y: number }
  status: FaceTrackStatus
}

// MediaPipe face landmark indices
const NOSE_TIP = 1
const LEFT_EAR = 234
const RIGHT_EAR = 454
const FOREHEAD = 10
const CHIN = 152

export function useFaceTracking(enabled: boolean): FaceTrackResult {
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const [bodyOffset, setBodyOffset] = useState({ x: 0, y: 0 })
  const [status, setStatus] = useState<FaceTrackStatus>('off')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const frameRef = useRef(0)
  const restingRef = useRef<{ posX: number; posY: number; yaw: number } | null>(null)
  const sampleCountRef = useRef(0)
  const noFaceCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setEyeOffset({ x: 0, y: 0 })
      setBodyOffset({ x: 0, y: 0 })
      setStatus('off')
      restingRef.current = null
      sampleCountRef.current = 0
      return
    }

    let stopped = false
    setStatus('loading')

    async function start() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )

        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        })

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        })

        const video = document.createElement('video')
        video.srcObject = stream
        video.setAttribute('playsinline', '')
        video.muted = true
        await video.play()
        videoRef.current = video

        if (stopped) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        await new Promise<void>(resolve => {
          if (video.videoWidth > 0) { resolve(); return }
          video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        })

        console.log('[FaceTrack] Video ready:', video.videoWidth, 'x', video.videoHeight)
        setStatus('calibrating')

        let detectCount = 0
        let faceFoundCount = 0

        function detect() {
          if (stopped || !videoRef.current || !landmarkerRef.current) return

          frameRef.current++
          if (frameRef.current % 3 === 0) {
            detectCount++
            const now = performance.now()
            const result = landmarkerRef.current.detectForVideo(videoRef.current, now)

            if (detectCount % 60 === 0) {
              console.log(`[FaceTrack] detections: ${faceFoundCount}/${detectCount}, missed: ${noFaceCountRef.current}`)
            }

            if (result.faceLandmarks?.length > 0) {
              faceFoundCount++
              noFaceCountRef.current = 0
              setStatus('active')
              const landmarks = result.faceLandmarks[0]!

              const nose = landmarks[NOSE_TIP]!
              const leftEar = landmarks[LEFT_EAR]!
              const rightEar = landmarks[RIGHT_EAR]!
              const forehead = landmarks[FOREHEAD]!
              const chin = landmarks[CHIN]!

              // --- FACE POSITION (for eyes) ---
              // Nose X/Y in frame: 0..1, center ~0.5
              const posX = nose.x
              const posY = nose.y

              // --- HEAD ROTATION (for body) ---
              // Yaw from ear distance ratio
              const dLeft = Math.hypot(nose.x - leftEar.x, nose.y - leftEar.y)
              const dRight = Math.hypot(nose.x - rightEar.x, nose.y - rightEar.y)
              const yaw = (dLeft / (dLeft + dRight) - 0.5) * 2

              // --- PITCH (for eyes Y) ---
              const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y)
              const noseFromTop = Math.hypot(nose.x - forehead.x, nose.y - forehead.y)
              const pitch = (noseFromTop / faceHeight - 0.55) * 4

              sampleCountRef.current++

              // Calibrate from first 15 samples
              if (sampleCountRef.current <= 15) {
                if (!restingRef.current) {
                  restingRef.current = { posX, posY, yaw }
                } else {
                  restingRef.current.posX += (posX - restingRef.current.posX) * 0.3
                  restingRef.current.posY += (posY - restingRef.current.posY) * 0.3
                  restingRef.current.yaw += (yaw - restingRef.current.yaw) * 0.3
                }
                if (sampleCountRef.current === 15) {
                  console.log('[FaceTrack] Calibrated:', restingRef.current)
                  setStatus('active')
                }
                rafRef.current = requestAnimationFrame(detect)
                return
              }

              const resting = restingRef.current!

              // Eye offset from face POSITION — reduced by 25% (1.5x instead of 2x)
              // Front camera mirrors: moving right in real life = left in image
              // Negate so character eyes follow you
              const eyeX = Math.max(-1, Math.min(1, -(posX - resting.posX) * 1.5))
              const eyeY = Math.max(-1, Math.min(1, (posY - resting.posY) * 1.5))

              // Body offset from head ROTATION (toned down — yaw is quite noisy)
              const bodyX = Math.max(-1, Math.min(1, -(yaw - resting.yaw) * 1.2))

              if (sampleCountRef.current % 30 === 0) {
                console.log(`[FaceTrack] pos=(${posX.toFixed(3)},${posY.toFixed(3)}) yaw=${yaw.toFixed(3)} z=${nose.z.toFixed(4)} eye=(${eyeX.toFixed(2)},${eyeY.toFixed(2)}) body=${bodyX.toFixed(2)}`)
              }

              setEyeOffset(prev => ({
                x: prev.x + (eyeX - prev.x) * 0.3,
                y: prev.y + (eyeY - prev.y) * 0.3,
              }))
              setBodyOffset(prev => ({
                x: prev.x + (bodyX - prev.x) * 0.12,
                y: prev.y + (pitch - prev.y) * 0.12,
              }))
            } else {
              noFaceCountRef.current++
              if (noFaceCountRef.current > 90) {
                setStatus('no-face')
              }
            }
          }

          rafRef.current = requestAnimationFrame(detect)
        }

        detect()
      } catch (err) {
        console.warn('Face tracking failed:', err)
        setStatus('error')
      }
    }

    start()

    return () => {
      stopped = true
      cancelAnimationFrame(rafRef.current)
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(t => t.stop())
        videoRef.current.srcObject = null
        videoRef.current = null
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
    }
  }, [enabled])

  return { eyeOffset, bodyOffset, status }
}
