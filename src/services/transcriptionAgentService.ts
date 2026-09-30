import { supabase } from './supabaseClient';

export interface ConversationSummaryResult {
  summary: string;
  reviewItems: string[];
  draftAttempts: number;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export async function summarizeConversationWithAgent(rawTranscript: string): Promise<ConversationSummaryResult> {
  if (!rawTranscript.trim()) {
    throw new Error('Cannot summarize an empty transcript.');
  }

  const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Unable to prepare a secure agent session: ${sessionError.message}`);
  }

  if (!sessionResult.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      if (/failed to fetch|network request failed/i.test(error.message)) {
        throw new Error(
          'Cannot reach Supabase Auth. Check EXPO_PUBLIC_SUPABASE_URL and your network connection.',
        );
      }
      if (/anonymous sign-ins are disabled/i.test(error.message)) {
        throw new Error(
          'Anonymous sign-in is disabled. Enable anonymous sign-ins in Supabase Auth settings.',
        );
      }
      throw new Error(`Anonymous sign-in failed: ${error.message}`);
    }
  }

  const { data, error } = await supabase.functions.invoke('transcribe-conversation', {
    body: { transcript: rawTranscript },
  });

  if (error) {
    throw new Error(`Conversation summary agent failed: ${error.message}`);
  }

  const result: unknown = data;
  if (
    typeof result !== 'object' ||
    result === null ||
    !('summary' in result) ||
    typeof result.summary !== 'string' ||
    !('reviewItems' in result) ||
    !isStringArray(result.reviewItems) ||
    !('draftAttempts' in result) ||
    typeof result.draftAttempts !== 'number'
  ) {
    throw new Error('Conversation summary agent returned an invalid response.');
  }

  return {
    summary: result.summary,
    reviewItems: result.reviewItems,
    draftAttempts: result.draftAttempts,
  };
}
