import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { COLORS, FONT } from '../theme';

export default function RecordScreen({ route, navigation }: any) {
  const { patientName = 'New Patient', dob = '--', sessionId } = route.params || {};
  const { sessions, updateSession } = useApp();

  const recorder = useAudioRecorder();

  // ── Auto-start recording as soon as the screen mounts ─────────────────────
  useEffect(() => {
    recorder.start();
    return () => {
      // Safety: if user navigates away unexpectedly, stop the mic
      if (recorder.state === 'recording') recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Format mm:ss ────────────────────────────────────────────────────────
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Stop handler: save URI + update session, navigate to Summary ─────────
  const handleStop = async () => {
    const uri = await recorder.stop();
    const durationStr = formatTime(recorder.elapsed);

    // Find the live session and update it
    const match = sessions.find(
      s => (s.id === sessionId) || (s.patientName === patientName && s.status === 'Recording')
    );
    if (match) {
      updateSession(match.id, { status: 'Draft', duration: durationStr, audioUri: uri });
      navigation.replace('Summary', { patientName, dob, sessionId: match.id, audioUri: uri });
    } else if (sessionId) {
      updateSession(sessionId, { status: 'Draft', duration: durationStr, audioUri: uri });
      navigation.replace('Summary', { patientName, dob, sessionId, audioUri: uri });
    } else {
      navigation.replace('Summary', { patientName, dob, audioUri: uri });
    }
  };

  // ── Derive waveform bar heights from live level ──────────────────────────
  const BAR_COUNT = 20;
  const baseHeights = [28, 52, 38, 80, 55, 110, 70, 42, 95, 60, 35, 85, 50, 45, 72, 64, 90, 40, 75, 48];
  const waveHeights = baseHeights.map(h =>
    recorder.state === 'recording'
      ? Math.max(8, h * (0.4 + recorder.level * 0.6))
      : h * 0.25 // idle / stopped — flat
  );

  // ── Permission error state ────────────────────────────────────────────────
  if (recorder.state === 'error') {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={styles.errorIcon}>🎙️</Text>
        <Text style={styles.errorTitle}>Microphone Access Required</Text>
        <Text style={styles.errorBody}>{recorder.error}{'\n\n'}Please enable microphone permissions in your device settings to record consultations.</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.errorBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.errorBtnText}>GO BACK</Text>
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[styles.errorBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => {
                import('react-native').then(rn => rn.Linking.openSettings());
              }}>
              <Text style={styles.errorBtnText}>SETTINGS</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const isLive = recorder.state === 'recording';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>

        {/* Status pill */}
        {recorder.state === 'requesting' ? (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>REQUESTING MIC...</Text>
          </View>
        ) : isLive ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : (
          <View style={[styles.livePill, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.liveText}>STOPPED</Text>
          </View>
        )}
      </View>

      {/* Patient info */}
      <View style={styles.patientSection}>
        <Text style={styles.eyebrow}>RECORDING SESSION</Text>
        <Text style={styles.patientName}>{patientName}</Text>
        <Text style={styles.dobText}>DOB: {dob}</Text>
      </View>

      {/* Waveform */}
      <View style={styles.waveformSection}>
        <View style={styles.waveformRow}>
          {waveHeights.slice(0, BAR_COUNT).map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: Math.round(h), opacity: isLive ? (0.4 + (i % 4) * 0.15) : 0.18 }
              ]}
            />
          ))}
        </View>
        <Text style={styles.ambientLabel}>
          {recorder.state === 'requesting'
            ? 'Requesting microphone access...'
            : isLive
              ? 'Capturing ambient audio  ·  Speak naturally'
              : 'Processing...'}
        </Text>
      </View>

      {/* Timer */}
      <View style={styles.timerSection}>
        <Text style={styles.timerText}>{formatTime(recorder.elapsed)}</Text>
      </View>

      {/* Stop button */}
      <View style={styles.controlSection}>
        <Text style={styles.controlHint}>
          {Platform.OS === 'web'
            ? 'Audio is captured via browser microphone.'
            : 'Audio is captured locally and encrypted.'}
        </Text>
        <TouchableOpacity
          style={[styles.stopBtn, !isLive && { opacity: 0.5 }]}
          onPress={handleStop}
          disabled={!isLive}
          activeOpacity={0.85}
        >
          <View style={styles.stopSquare} />
        </TouchableOpacity>
        <Text style={styles.stopLabel}>TAP TO STOP & GENERATE NOTE</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.accent },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 36 : 16, paddingBottom: 8 },
  backBtn:         { padding: 8 },
  backText:        { fontFamily: FONT.bold, fontSize: 20, color: 'rgba(255,255,255,0.8)' },
  livePill:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2 },
  liveDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.white, marginRight: 7 },
  liveText:        { fontFamily: FONT.bold, fontSize: 11, color: COLORS.white, letterSpacing: 2 },
  pendingPill:     { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2 },
  pendingText:     { fontFamily: FONT.semibold, fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  patientSection:  { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 12 },
  eyebrow:         { fontFamily: FONT.semibold, fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 10 },
  patientName:     { fontFamily: FONT.extrabold, fontSize: 30, color: COLORS.white, letterSpacing: -0.5, marginBottom: 6 },
  dobText:         { fontFamily: FONT.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  waveformSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  waveformRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 130, gap: 4 },
  bar:             { width: 10, backgroundColor: COLORS.white, borderRadius: 3 },
  ambientLabel:    { fontFamily: FONT.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 20, letterSpacing: 0.3 },
  timerSection:    { alignItems: 'center', paddingVertical: 8 },
  timerText:       { fontFamily: FONT.thin, fontSize: 64, color: COLORS.white, letterSpacing: -2 },
  controlSection:  { alignItems: 'center', paddingBottom: 56, paddingTop: 12 },
  controlHint:     { fontFamily: FONT.regular, fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.2, marginBottom: 24, textAlign: 'center', paddingHorizontal: 32 },
  stopBtn:         { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 16 },
  stopSquare:      { width: 30, height: 30, backgroundColor: COLORS.white, borderRadius: 3 },
  stopLabel:       { fontFamily: FONT.semibold, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 },
  errorIcon:       { fontSize: 48, marginBottom: 20 },
  errorTitle:      { fontFamily: FONT.bold, fontSize: 22, color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  errorBody:       { fontFamily: FONT.regular, fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  errorBtn:        { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 28, paddingVertical: 14 },
  errorBtnText:    { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1.5 },
});
