import { useState, useCallback } from 'react'
import type { CompanionState } from '../types'

interface EditPanelProps {
  state: CompanionState
  svgCoords: { x: number; y: number } | null
}

export function EditPanel({ state, svgCoords }: EditPanelProps) {
  const [copied, setCopied] = useState(false)

  const copyCoords = useCallback(() => {
    if (!svgCoords) return
    const text = `${Math.round(svgCoords.x)},${Math.round(svgCoords.y)}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }, [svgCoords])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(0,0,0,0.9)',
      color: '#fff',
      padding: '8px 12px',
      fontFamily: 'monospace',
      fontSize: 13,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderBottom: '2px solid #2DD4BF',
    }}>
      <span style={{ color: '#2DD4BF', fontWeight: 700 }}>EDIT</span>
      <span style={{ color: '#888' }}>state: <span style={{ color: '#fff' }}>{state}</span></span>
      {svgCoords && (
        <span
          onClick={copyCoords}
          style={{ cursor: 'pointer', color: copied ? '#2DD4BF' : '#fff' }}
        >
          x: {Math.round(svgCoords.x)} y: {Math.round(svgCoords.y)}
          {copied ? ' (copied)' : ' (click to copy)'}
        </span>
      )}
      <span style={{ color: '#666', marginLeft: 'auto' }}>click SVG for coords</span>
    </div>
  )
}
