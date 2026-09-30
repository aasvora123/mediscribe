import { assert, assertFalse } from 'jsr:@std/assert@1';
import { shouldReviseTranscript } from './agentPolicy.ts';

Deno.test('revises a transcript flagged for substantive changes', () => {
  assert(shouldReviseTranscript({ needsRevision: true, attempts: 1 }));
});

Deno.test('limits the agent to one revision', () => {
  assertFalse(shouldReviseTranscript({ needsRevision: true, attempts: 2 }));
});

Deno.test('ends when the transcript review finds no substantive changes', () => {
  assertFalse(shouldReviseTranscript({ needsRevision: false, attempts: 1 }));
});
