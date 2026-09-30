import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error';

export interface RecorderResult {
  /** Current recorder state */
  state: RecorderState;
  /** Elapsed seconds */
  elapsed: number;
  /** Waveform animation level 0–1 (mock on web) */
  level: number;
  /** Local URI of the saved audio file — set after stopping */
  audioUri: string | null;
  /** Human-readable error message if state === 'error' */
  error: string | null;
  /** Start recording — requests permission first */
  start: () => Promise<void>;
  /** Stop recording and return the audio URI */
  stop: () => Promise<string | null>;
}

/**
 * 010 + 011 + 012 — Audio permissions, recording lifecycle, and file URI management.
 * Works on iOS, Android, and gracefully degrades on web (no native mic API there).
 */
export function useAudioRecorder(): RecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const clearTimers = () => {
    if (timerRef.current)  clearInterval(timerRef.current);
    if (levelRef.current)  clearInterval(levelRef.current);
    timerRef.current = null;
    levelRef.current = null;
  };

  const startTimers = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    // On native expo-av can return real metering; on web we fake it.
    levelRef.current = setInterval(() => {
      setLevel(0.2 + Math.random() * 0.8);
    }, 150);
  };

  // ── 010: Request permissions ──────────────────────────────────────────────

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  };

  // ── 011: Start recording ──────────────────────────────────────────────────

  const start = useCallback(async () => {
    try {
      setState('requesting');
      setError(null);
      setAudioUri(null);

      const granted = await requestPermission();
      if (!granted) {
        setState('error');
        setError('Microphone permission denied. Please allow microphone access and try again.');
        return;
      }

      // Configure audio mode for recording (native only — no-op on web)
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      // 011: Create and start the recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      startTimers();
      setState('recording');
    } catch (err: any) {
      setState('error');
      setError(err?.message ?? 'Failed to start recording. Check microphone permissions.');
    }
  }, []);

  // ── 012: Stop and retrieve the audio file URI ─────────────────────────────

  const stop = useCallback(async (): Promise<string | null> => {
    try {
      clearTimers();

      const recording = recordingRef.current;
      if (!recording) {
        setState('stopped');
        return null;
      }

      await recording.stopAndUnloadAsync();

      // Reset audio mode on native
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }

      // 012: Get the local file URI
      const uri = recording.getURI();
      recordingRef.current = null;

      setAudioUri(uri ?? null);
      setState('stopped');
      return uri ?? null;
    } catch (err: any) {
      setState('error');
      setError(err?.message ?? 'Failed to stop recording.');
      return null;
    }
  }, []);

  return { state, elapsed, level, audioUri, error, start, stop };
}
