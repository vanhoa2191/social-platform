import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from './stateMachine'

describe('candidate state machine', () => {
  it('allows review approval and preparation flow', () => {
    expect(canTransition('READY_FOR_REVIEW', 'APPROVED')).toBe(true)
    expect(canTransition('APPROVED', 'PREPARING')).toBe(true)
    expect(canTransition('PREPARING', 'PREPARED')).toBe(true)
  })

  it('blocks skipping review before preparing a comment', () => {
    expect(canTransition('READY_FOR_REVIEW', 'PREPARING')).toBe(false)
    expect(() => assertTransition('READY_FOR_REVIEW', 'PREPARING')).toThrow()
  })
})
