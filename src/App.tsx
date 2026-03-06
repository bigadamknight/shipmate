import { useState, useCallback } from 'react'
import { Character } from './components/Character'
import { Controls } from './components/Controls'
import { EditPanel } from './components/EditPanel'
import { useWakeLock } from './hooks/useWakeLock'
import { useFaceTracking } from './hooks/useFaceTracking'
import { useVoiceAgent } from './hooks/useVoiceAgent'
import { useAudioMouth } from './hooks/useAudioMouth'
import type { CompanionState } from './types'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined

export function App() {
  const [state, setState] = useState<CompanionState>('idle')
  const [editMode, setEditMode] = useState(false)
  const [svgCoords, setSvgCoords] = useState<{ x: number; y: number } | null>(null)
  const [faceTrack, setFaceTrack] = useState(false)
  const { eyeOffset, bodyOffset, status: faceTrackStatus } = useFaceTracking(faceTrack)

  const voice = useVoiceAgent({
    agentId: AGENT_ID,
    onStateChange: setState,
  })

  const mouthOpenness = useAudioMouth(voice.isSpeaking, voice.getOutputVolume, voice.getOutputFrequencyData)

  useWakeLock()

  const handleSvgClick = useCallback((coords: { x: number; y: number }) => {
    setSvgCoords(coords)
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {editMode && <EditPanel state={state} svgCoords={svgCoords} />}
      <div style={{ flex: 1, position: 'relative' }}>
        <Character state={state} editMode={editMode} eyeOffset={eyeOffset} bodyOffset={bodyOffset} mouthOpenness={mouthOpenness} faceTrackDebug={faceTrack} faceTrackStatus={faceTrackStatus} onSvgClick={handleSvgClick} />
      </div>
      <Controls
        state={state}
        editMode={editMode}
        faceTrack={faceTrack}
        voiceActive={voice.isActive}
        voiceStatus={voice.status}
        voiceDisconnected={voice.isDisconnected}
        hasAgentId={!!AGENT_ID}
        onStateChange={setState}
        onEditToggle={() => setEditMode(e => !e)}
        onFaceTrackToggle={() => setFaceTrack(f => !f)}
        onVoiceStart={() => voice.start()}
        onVoiceStop={() => voice.stop()}
        onVoiceReconnect={() => voice.reconnect()}
      />
    </div>
  )
}
