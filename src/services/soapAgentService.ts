import { summarizeConversationWithAgent } from './transcriptionAgentService';
import type { AbridgeNoteSection } from './groqService';

export async function generateSoapNote(transcript: string): Promise<{
  sections: AbridgeNoteSection[];
  reviewItems: string[];
  followUpSuggestions: string[];
  draftAttempts: number;
}> {
  const result = await summarizeConversationWithAgent(transcript);
  return {
    sections: [{ title: 'Conversation Summary', body: result.summary }],
    reviewItems: result.reviewItems,
    followUpSuggestions: [],
    draftAttempts: result.draftAttempts,
  };
}
