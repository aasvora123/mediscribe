import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudioGroq } from '../services/groqService';
import { summarizeConversationWithAgent } from '../services/transcriptionAgentService';
import { COLORS, FONT, RADIUS } from '../theme';

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function TranscriptionMvpScreen() {
  const recorder = useAudioRecorder();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [isRawTranscript, setIsRawTranscript] = useState(false);
  const [reviewItems, setReviewItems] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleStart = async () => {
    setError(null);
    setSummary('');
    setIsRawTranscript(false);
    setReviewItems([]);
    setLanguage('');
    setCopied(false);
    await recorder.start();
  };

  const handleStop = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      const audioUri = await recorder.stop();
      if (!audioUri) {
        throw new Error('No recording was saved. Please record again.');
      }

      const result = await transcribeAudioGroq(audioUri, 'en');
      if (!result.transcript.trim()) {
        throw new Error('No speech was detected. Try recording again in a quieter place.');
      }

      setSummary(result.transcript);
      setLanguage(result.language_code);

      try {
        const agentResult = await summarizeConversationWithAgent(result.transcript);
        setSummary(agentResult.summary);
        setReviewItems(agentResult.reviewItems);
      } catch (agentError) {
        setIsRawTranscript(true);
        setError(
          `Speech-to-text succeeded, but Gemini summary could not run. Showing the raw transcript instead. ${
            agentError instanceof Error ? agentError.message : String(agentError)
          }`,
        );
      }
    } catch (transcriptionError) {
      setError(transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(summary);
    setCopied(true);
  };

  const isRecording = recorder.state === 'recording';
  const isRequestingPermission = recorder.state === 'requesting';
  const isBusy = isProcessing || isRequestingPermission;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>CONVERSATION SUMMARIZER</Text>
          <Text style={styles.title}>Record. Summarize. Review.</Text>
          <Text style={styles.subtitle}>
            Record a doctor-patient conversation, then get a concise summary you can review and copy.
          </Text>
        </View>

        <View style={styles.recordCard}>
          <View style={[styles.statusDot, isRecording && styles.statusDotLive]} />
          <Text style={styles.statusText}>
            {isRequestingPermission
              ? 'Waiting for microphone permission…'
              : isRecording
                ? 'Recording conversation'
                : isProcessing
                  ? 'Transcribing and summarizing…'
                  : 'Ready to record'}
          </Text>
          <Text style={styles.timer}>{formatTime(recorder.elapsed)}</Text>
          {isRecording ? (
            <TouchableOpacity
              style={[styles.stopButton, isProcessing && styles.disabledButton]}
              onPress={handleStop}
              disabled={isProcessing}
            >
              <View style={styles.stopSquare} />
              <Text style={styles.stopText}>STOP & SUMMARIZE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.startButton, isBusy && styles.disabledButton]}
              onPress={handleStart}
              disabled={isBusy}
            >
              {isRequestingPermission ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.startText}>START RECORDING</Text>}
            </TouchableOpacity>
          )}
          <Text style={styles.privacyHint}>
            Audio is sent to Groq for speech recognition. Gemini summarizes what the doctor and patient discussed.
          </Text>
        </View>

        {(error || recorder.error) && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Needs attention</Text>
            <Text style={styles.errorText}>{error ?? recorder.error}</Text>
          </View>
        )}

        {isProcessing && (
          <View style={styles.processing}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.processingText}>Transcribing audio, then summarizing the conversation with Gemini…</Text>
          </View>
        )}

        {summary.length > 0 && (
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>{isRawTranscript ? 'RAW TRANSCRIPT' : 'CONVERSATION SUMMARY'}</Text>
                {language ? <Text style={styles.language}>Detected language: {language}</Text> : null}
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyText}>{copied ? 'COPIED' : 'COPY'}</Text>
              </TouchableOpacity>
            </View>
            <Text selectable style={styles.transcript}>{summary}</Text>
          </View>
        )}

        {reviewItems.length > 0 && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>PLEASE REVIEW THESE MOMENTS</Text>
            {reviewItems.map((item, index) => (
              <Text key={`${index}-${item}`} style={styles.reviewItem}>• {item}</Text>
            ))}
            <Text style={styles.reviewFootnote}>Gemini suggestions are not verified facts. Check them against the recording.</Text>
          </View>
        )}

        {summary.length > 0 && !isBusy && (
          <TouchableOpacity style={styles.resetButton} onPress={handleStart}>
            <Text style={styles.resetText}>RECORD ANOTHER CONVERSATION</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.warmWhite },
  content: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingTop: 48 },
  header: { marginBottom: 28 },
  brand: { fontFamily: FONT.bold, fontSize: 11, color: COLORS.accent, letterSpacing: 2 },
  title: { fontFamily: FONT.extrabold, color: COLORS.charcoal, fontSize: 32, marginTop: 12 },
  subtitle: { fontFamily: FONT.regular, color: COLORS.taupe, fontSize: 15, lineHeight: 23, marginTop: 8 },
  recordCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.border, marginBottom: 10 },
  statusDotLive: { backgroundColor: COLORS.accent },
  statusText: { fontFamily: FONT.semibold, color: COLORS.taupe, fontSize: 14 },
  timer: { fontFamily: FONT.thin, color: COLORS.charcoal, fontSize: 56, marginVertical: 18, fontVariant: ['tabular-nums'] },
  startButton: { minHeight: 52, minWidth: 220, borderRadius: RADIUS.sm, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 },
  stopButton: { minHeight: 52, minWidth: 220, borderRadius: RADIUS.sm, backgroundColor: COLORS.charcoal, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 22 },
  stopSquare: { width: 12, height: 12, backgroundColor: COLORS.white, borderRadius: 2 },
  disabledButton: { opacity: 0.55 },
  startText: { fontFamily: FONT.bold, color: COLORS.white, fontSize: 13, letterSpacing: 1 },
  stopText: { fontFamily: FONT.bold, color: COLORS.white, fontSize: 13, letterSpacing: 1 },
  privacyHint: { fontFamily: FONT.regular, fontSize: 11, color: COLORS.taupe, textAlign: 'center', marginTop: 16, lineHeight: 17 },
  errorCard: { backgroundColor: '#FFF1EF', borderColor: '#F1C4BC', borderWidth: 1, padding: 16, borderRadius: RADIUS.sm, marginTop: 18 },
  errorTitle: { fontFamily: FONT.bold, color: COLORS.accent, marginBottom: 6 },
  errorText: { fontFamily: FONT.regular, color: COLORS.charcoal, lineHeight: 21 },
  processing: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 18 },
  processingText: { fontFamily: FONT.medium, color: COLORS.taupe, fontSize: 13 },
  transcriptCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 20, marginTop: 20 },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionEyebrow: { fontFamily: FONT.bold, color: COLORS.accent, fontSize: 10, letterSpacing: 1.5 },
  language: { fontFamily: FONT.regular, color: COLORS.taupe, fontSize: 11, marginTop: 4 },
  copyButton: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm },
  copyText: { fontFamily: FONT.bold, color: COLORS.charcoal, fontSize: 10, letterSpacing: 1 },
  transcript: { fontFamily: FONT.regular, color: COLORS.charcoal, fontSize: 16, lineHeight: 26 },
  reviewCard: { backgroundColor: '#F1F6F3', borderWidth: 1, borderColor: '#D4E2DA', borderRadius: RADIUS.md, padding: 18, marginTop: 16 },
  reviewTitle: { fontFamily: FONT.bold, color: COLORS.accent, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  reviewItem: { fontFamily: FONT.regular, color: COLORS.charcoal, fontSize: 14, lineHeight: 21, marginTop: 4 },
  reviewFootnote: { fontFamily: FONT.regular, color: COLORS.taupe, fontSize: 11, lineHeight: 16, marginTop: 10 },
  resetButton: { alignSelf: 'center', padding: 16, marginTop: 4 },
  resetText: { fontFamily: FONT.bold, color: COLORS.accent, fontSize: 11, letterSpacing: 1 },
});
