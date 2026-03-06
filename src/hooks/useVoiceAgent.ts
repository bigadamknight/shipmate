import { useRef, useCallback, useEffect, useState } from 'react'
import { useConversation } from '@elevenlabs/react'
import type { CompanionState } from '../types'

export interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface UseVoiceAgentOptions {
  agentId: string | undefined
  onStateChange: (state: CompanionState) => void
}

// In dev, Vite proxies /memory-api -> partner.brainsteam.cloud/api to avoid CORS
const MEMORY_API = import.meta.env.DEV ? '/memory-api' : 'https://partner.brainsteam.cloud/api'

async function recallMemories(query: string, limit = 10): Promise<string> {
  try {
    const res = await fetch(`${MEMORY_API}/recall?q=${encodeURIComponent(query)}&limit=${limit}`)
    if (!res.ok) return ''
    const data = await res.json()
    if (!data.memories?.length) return ''
    return data.memories
      .map((m: { content: string; type: string; similarity: number }) =>
        `[${m.type}] ${m.content}`
      )
      .join('\n')
  } catch (err) {
    console.warn('[Shipmate] Memory recall failed:', err)
    return ''
  }
}

async function storeMemory(content: string, type: 'episodic' | 'semantic' = 'episodic'): Promise<boolean> {
  try {
    const res = await fetch(`${MEMORY_API}/memories/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content, importance: 0.6 }),
    })
    if (!res.ok) console.debug('[Shipmate] Memory store returned', res.status, '(auth required)')
    return res.ok
  } catch (err) {
    console.debug('[Shipmate] Memory store unavailable')
    return false
  }
}

async function getContext(): Promise<string> {
  try {
    const res = await fetch(`${MEMORY_API}/context-prompt`)
    if (!res.ok) return ''
    const data = await res.json()
    return data.prompt || ''
  } catch {
    return ''
  }
}

async function buildStartupContext(): Promise<string> {
  const [context, recentMemories] = await Promise.all([
    getContext(),
    recallMemories('current projects priorities recent activity', 15),
  ])

  const parts: string[] = []
  if (context) parts.push('USER CONTEXT:\n' + context)
  if (recentMemories) parts.push('RELEVANT MEMORIES:\n' + recentMemories)
  if (!parts.length) return 'No additional context available.'
  return parts.join('\n\n')
}

const SYSTEM_PROMPT = `You are Shipmate, a friendly AI companion that lives on the user's phone or screen. You're expressive, warm, and helpful. You have a visual character body that changes expression based on your mood and what's happening.

The user is Adam Knight, a developer working on multiple projects. You have access to his memory system and know about his work.

SPEAKING STYLE:
- Keep responses SHORT. 1-2 sentences is ideal. Never more than 3.
- This is a spoken conversation, not written text.
- One question at a time. Never ask multiple questions in a single turn.
- Brief acknowledgements: "Great", "Interesting", "Got it" - then move on.
- Don't repeat back what the user said.
- Use contractions and informal language.
- Avoid lists, bullet points, or formatted text - you're speaking.

PERSONALITY:
- Curious and enthusiastic but not overwhelming
- Helpful without being pushy
- Can be playful and make light jokes
- Shows genuine interest in what the user is working on

TOOLS:
You have a set_mood tool to change your visual expression. Use it naturally:
- When you're thinking about something, set mood to "thinking"
- When the user shares good news, set mood to "happy" or "celebrating"
- When you're actively listening, set mood to "listening"
- When something is confusing, set mood to "confused"
- When delivering important info, set mood to "notification"
- When there's a problem, set mood to "error"
- When you're done talking and waiting, go back to "idle"
- Don't announce mood changes, just set them naturally

You have a recall_memory tool to search Adam's memory system for relevant information. Use it when:
- Adam asks about a project, person, or past decision
- You need context about something he's mentioned
- He asks "what do you know about..." or similar

You have a remember tool to store important things Adam tells you. Use it when:
- Adam shares a decision, preference, or important fact
- Something worth remembering for future conversations
- He explicitly asks you to remember something

{{companion_context}}`

export function useVoiceAgent({ agentId, onStateChange }: UseVoiceAgentOptions) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isActive, setIsActive] = useState(false)
  const [isDisconnected, setIsDisconnected] = useState(false)
  const wasConnectedRef = useRef(false)
  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  // Client tools - the agent controls character state and accesses memory
  const clientTools = useRef({
    set_mood: (params: { mood: string }) => {
      const mood = params.mood as CompanionState
      onStateChangeRef.current(mood)
      return `Mood set to ${mood}`
    },
    recall_memory: async (params: { query: string }) => {
      const results = await recallMemories(params.query, 8)
      return results || 'No relevant memories found.'
    },
    remember: async (params: { content: string; type?: string }) => {
      const memType = (params.type === 'semantic' ? 'semantic' : 'episodic') as 'episodic' | 'semantic'
      const ok = await storeMemory(params.content, memType)
      return ok ? 'Stored successfully.' : 'Failed to store memory.'
    },
  }).current

  const conversation = useConversation({
    clientTools,
    onMessage: useCallback(({ message, role }: { message: string; role: string }) => {
      const msg: VoiceMessage = {
        role: role === 'agent' ? 'assistant' : 'user',
        content: message,
        timestamp: Date.now(),
      }
      setMessages(prev => {
        const recent = prev.slice(-4)
        if (recent.some(m => m.role === msg.role && m.content === msg.content)) return prev
        return [...prev, msg]
      })
    }, []),
    onError: useCallback((error: unknown) => {
      console.error('[Shipmate] Voice error:', error)
    }, []),
  })

  // Track connection state for reconnect UI
  useEffect(() => {
    if (conversation.status === 'connected') {
      wasConnectedRef.current = true
      setIsDisconnected(false)
      onStateChangeRef.current('listening')
    }
    if (conversation.status === 'disconnected' && wasConnectedRef.current) {
      wasConnectedRef.current = false
      setIsDisconnected(true)
      setIsActive(false)
      onStateChangeRef.current('idle')
    }
  }, [conversation.status])

  // Auto-set speaking state based on agent audio
  useEffect(() => {
    if (conversation.status !== 'connected') return
    if (conversation.isSpeaking) {
      onStateChangeRef.current('speaking')
    } else {
      onStateChangeRef.current('listening')
    }
  }, [conversation.isSpeaking, conversation.status])

  const start = useCallback(async () => {
    if (!agentId) {
      console.warn('[Shipmate] No agent ID configured')
      return
    }
    await navigator.mediaDevices.getUserMedia({ audio: true })
    setIsActive(true)
    setIsDisconnected(false)

    // Fetch memory context before connecting
    const context = await buildStartupContext()

    await conversation.startSession({
      agentId,
      dynamicVariables: {
        companion_context: context,
      },
      overrides: {
        agent: {
          prompt: { prompt: SYSTEM_PROMPT },
          firstMessage: "Hey Adam! What's up?",
          language: 'en',
        },
      },
    } as any)
  }, [agentId, conversation])

  const stop = useCallback(async () => {
    await conversation.endSession()
    setIsActive(false)
    onStateChangeRef.current('idle')
  }, [conversation])

  const reconnect = useCallback(async () => {
    if (!agentId) return
    setIsDisconnected(false)
    setIsActive(true)

    const context = await buildStartupContext()

    await conversation.startSession({
      agentId,
      dynamicVariables: {
        companion_context: context,
      },
      overrides: {
        agent: {
          prompt: { prompt: SYSTEM_PROMPT },
          firstMessage: "I'm back! Where were we?",
          language: 'en',
        },
      },
    } as any)
  }, [agentId, conversation])

  // Push context updates mid-conversation
  const sendContext = useCallback((context: string) => {
    if (conversation.status === 'connected') {
      conversation.sendContextualUpdate(context)
    }
  }, [conversation])

  // Expose volume getters for mouth animation
  const getOutputVolume = useCallback(() => {
    return conversation.getOutputVolume()
  }, [conversation])

  const getOutputFrequencyData = useCallback(() => {
    return conversation.getOutputByteFrequencyData()
  }, [conversation])

  return {
    isActive,
    isDisconnected,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status,
    messages,
    start,
    stop,
    reconnect,
    sendContext,
    getOutputVolume,
    getOutputFrequencyData,
  }
}
