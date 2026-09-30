export function shouldReviseTranscript(state: {
  needsRevision: boolean;
  attempts: number;
}): boolean {
  return state.needsRevision && state.attempts < 2;
}
