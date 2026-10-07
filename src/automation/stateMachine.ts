import type { CandidateState } from './model'

const transitions: Record<CandidateState, CandidateState[]> = {
  DRAFTING: ['READY_FOR_REVIEW', 'FAILED'],
  READY_FOR_REVIEW: ['APPROVED', 'REJECTED', 'FAILED'],
  APPROVED: ['PREPARING', 'REJECTED', 'FAILED'],
  PREPARING: ['PREPARED', 'FAILED'],
  PREPARED: [],
  REJECTED: [],
  FAILED: ['READY_FOR_REVIEW'],
}

export function canTransition(from: CandidateState, to: CandidateState): boolean {
  return transitions[from].includes(to)
}

export function assertTransition(from: CandidateState, to: CandidateState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid candidate transition: ${from} -> ${to}`)
  }
}
