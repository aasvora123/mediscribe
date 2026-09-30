/**
 * Sarvam AI Speech-to-Text Service
 * Uses expo-file-system uploadAsync for Android to avoid Blob/ArrayBuffer limitations.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

const SARVAM_API_URL = 'https://api.sarvam.ai/speech-to-text';
const env = Constants.expoConfig?.extra ?? {};
const SARVAM_API_KEY =
  env.EXPO_PUBLIC_SARVAM_API_KEY ?? process.env.EXPO_PUBLIC_SARVAM_API_KEY ?? '';

export type SarvamLanguageCode =
  | 'hi-IN' | 'en-IN' | 'ta-IN' | 'te-IN' | 'kn-IN'
  | 'ml-IN' | 'mr-IN' | 'bn-IN' | 'gu-IN' | 'od-IN'
  | 'pa-IN' | 'unknown';

export interface SarvamTranscriptResult {
  transcript: string;
  language_code: string;
}

export interface TranscribeOptions {
  audioUri: string;
  languageCode?: SarvamLanguageCode;
  prompt?: string;
}

export async function transcribeAudio(options: TranscribeOptions): Promise<SarvamTranscriptResult> {
  const { audioUri, languageCode = 'unknown', prompt } = options;

  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not set. Check your .env or eas.json env block.');
  }

  console.log('[Sarvam] Platform:', Platform.OS, '| URI:', audioUri.slice(-50));
  console.log('[Sarvam] Key present:', SARVAM_API_KEY ? `YES (${SARVAM_API_KEY.slice(0, 8)}...)` : 'NO');

  // ── Android / iOS: Use FileSystem.uploadAsync (native multipart upload) ────────
  // This is the ONLY reliable way to upload binary audio files on React Native.
  // JS Blob/ArrayBuffer from binary is not supported in the Hermes engine.
  if (Platform.OS !== 'web') {
    const extraFields: Record<string, string> = {
      model: 'saarika:v2.5',
    };
    if (languageCode && languageCode !== 'unknown') {
      extraFields['language_code'] = languageCode;
    }
    if (prompt) {
      extraFields['prompt'] = prompt;
    }

    console.log('[Sarvam] Using FileSystem.uploadAsync for native upload...');
    const uploadResult = await FileSystem.uploadAsync(SARVAM_API_URL, audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/mp4',
      parameters: extraFields,
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
    });

    console.log('[Sarvam] Upload status:', uploadResult.status);
    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      console.error('[Sarvam] Upload error body:', uploadResult.body);
      throw new Error(`Sarvam STT error (${uploadResult.status}): ${uploadResult.body}`);
    }

    const data = JSON.parse(uploadResult.body);
    console.log('[Sarvam] Transcript:', (data.transcript ?? '').slice(0, 80));
    return {
      transcript: data.transcript ?? '',
      language_code: data.language_code ?? languageCode,
    };
  }

  // ── Web: standard fetch → Blob approach ────────────────────────────────────────
  const formData = new FormData();
  const res = await fetch(audioUri);
  if (!res.ok) throw new Error(`Failed to read audio file: ${res.status}`);
  const blob = await res.blob();
  formData.append('file', blob, 'consultation.webm');
  formData.append('model', 'saarika:v2.5');
  if (languageCode && languageCode !== 'unknown') formData.append('language_code', languageCode);
  if (prompt) formData.append('prompt', prompt);

  console.log('[Sarvam] Sending web request...');
  const response = await fetch(SARVAM_API_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_API_KEY },
    body: formData,
  });

  console.log('[Sarvam] Response status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Sarvam] Error:', errorText);
    throw new Error(`Sarvam STT error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[Sarvam] Transcript:', (data.transcript ?? '').slice(0, 80));
  return {
    transcript: data.transcript ?? '',
    language_code: data.language_code ?? languageCode,
  };
}

export const MEDICAL_PROMPT =
  'Medical consultation between a doctor and patient. May include clinical terms, medication names, anatomical terms, and symptom descriptions.';
