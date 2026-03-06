export type CompanionState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'happy'
  | 'confused'
  | 'celebrating'
  | 'focused'
  | 'sleeping'
  | 'error'
  | 'notification'
  | 'loading'

export const ALL_STATES: CompanionState[] = [
  'idle', 'listening', 'speaking', 'thinking',
  'happy', 'confused', 'celebrating', 'focused',
  'sleeping', 'error', 'notification', 'loading',
]
