import type { CompanionState } from '../types'
import { ALL_STATES } from '../types'

interface ControlsProps {
  state: CompanionState
  editMode: boolean
  faceTrack: boolean
  voiceActive: boolean
  voiceStatus: string
  voiceDisconnected: boolean
  hasAgentId: boolean
  onStateChange: (state: CompanionState) => void
  onEditToggle: () => void
  onFaceTrackToggle: () => void
  onVoiceStart: () => void
  onVoiceStop: () => void
  onVoiceReconnect: () => void
}

function voiceButtonLabel(active: boolean, status: string, disconnected: boolean): string {
  if (disconnected) return 'Reconnect'
  if (status === 'connecting') return 'Connecting...'
  if (active) return 'End'
  return 'Talk'
}

export function Controls({
  state, editMode, faceTrack,
  voiceActive, voiceStatus, voiceDisconnected, hasAgentId,
  onStateChange, onEditToggle, onFaceTrackToggle,
  onVoiceStart, onVoiceStop, onVoiceReconnect,
}: ControlsProps) {
  const handleVoiceClick = () => {
    if (voiceDisconnected) {
      onVoiceReconnect()
    } else if (voiceActive) {
      onVoiceStop()
    } else {
      onVoiceStart()
    }
  }

  return (
    <div style={{
      padding: '12px 12px calc(12px + env(safe-area-inset-bottom))',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      background: '#111',
      borderTop: '1px solid #222',
    }}>
      {/* State buttons - dev controls, will be replaced by voice agent */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ALL_STATES.map(s => (
          <button
            key={s}
            onClick={() => onStateChange(s)}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: state === s ? '#2DD4BF' : '#222',
              color: state === s ? '#000' : '#888',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'capitalize',
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {/* Voice agent toggle */}
        {hasAgentId && (
          <button
            onClick={handleVoiceClick}
            disabled={voiceStatus === 'connecting'}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderRadius: 6,
              background: voiceActive ? '#a33' : voiceDisconnected ? '#553' : '#2DD4BF',
              color: voiceActive ? '#fff' : voiceDisconnected ? '#dda' : '#000',
              fontSize: 13,
              fontWeight: 600,
              cursor: voiceStatus === 'connecting' ? 'wait' : 'pointer',
              opacity: voiceStatus === 'connecting' ? 0.6 : 1,
            }}
          >
            {voiceButtonLabel(voiceActive, voiceStatus, voiceDisconnected)}
          </button>
        )}
        {!hasAgentId && (
          <div style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 6,
            background: '#222',
            color: '#555',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            Set VITE_ELEVENLABS_AGENT_ID in .env
          </div>
        )}
        {/* Face tracking toggle */}
        <button
          onClick={onFaceTrackToggle}
          style={{
            padding: '10px 16px',
            border: faceTrack ? '2px solid #2DD4BF' : 'none',
            borderRadius: 6,
            background: faceTrack ? '#1a3a35' : '#222',
            color: faceTrack ? '#2DD4BF' : '#666',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Eyes
        </button>
        {/* Edit mode toggle */}
        <button
          onClick={onEditToggle}
          style={{
            padding: '10px 16px',
            border: editMode ? '2px solid #2DD4BF' : 'none',
            borderRadius: 6,
            background: editMode ? '#1a3a35' : '#222',
            color: editMode ? '#2DD4BF' : '#666',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
      </div>
    </div>
  )
}
