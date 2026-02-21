import type { Stage } from '../types'

export const STAGES: Stage[] = ['egg', 'yolk', 'albumen', 'graph', 'music']

export function formatDate(input?: string | number) {
  if (!input) return '—'
  const date = new Date(input)
  if (Number.isNaN(date.valueOf())) return '—'
  return date.toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatPercent(value?: number) {
  if (typeof value !== 'number') return '—'
  return `${Math.round(value * 100)}%`
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
