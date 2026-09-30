import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const env = Constants.expoConfig?.extra ?? {};
const GROQ_API_KEY = env.EXPO_PUBLIC_GROQ_API_KEY ?? process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

export interface AbridgeNoteSection {
  title: string;
  body: string;
  highlight?: string;
  kind?: 'clinical' | 'patient_summary' | 'agent_review' | 'follow_up';
}

/** Transcribe audio using Groq Whisper-Large-V3. */
export async function transcribeAudioGroq(
  audioUri: string,
  languageCode: string = 'en',
): Promise<{ transcript: string; language_code: string }> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set.');
  }

  console.log('[Groq STT] Platform:', Platform.OS, '| URI:', audioUri.slice(-50));

  if (Platform.OS !== 'web') {
    const uploadResult = await FileSystem.uploadAsync(GROQ_AUDIO_URL, audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/mp4',
      parameters: {
        model: 'whisper-large-v3',
        language: languageCode === 'unknown' ? 'en' : languageCode.split('-')[0],
      },
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    });

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(`Groq STT error (${uploadResult.status}): ${uploadResult.body}`);
    }

    const data = JSON.parse(uploadResult.body);
    return {
      transcript: data.text ?? '',
      language_code: data.language ?? languageCode,
    };
  }

  const formData = new FormData();
  const audioResponse = await fetch(audioUri);
  if (!audioResponse.ok) {
    throw new Error(`Failed to read audio file: ${audioResponse.status}`);
  }
  const blob = await audioResponse.blob();

  formData.append('file', blob, 'consultation.webm');
  formData.append('model', 'whisper-large-v3');
  if (languageCode && languageCode !== 'unknown') {
    formData.append('language', languageCode.split('-')[0]);
  }

  const response = await fetch(GROQ_AUDIO_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq STT error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    transcript: data.text ?? '',
    language_code: data.language ?? languageCode,
  };
}
