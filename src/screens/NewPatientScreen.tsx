import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, FONT, RADIUS } from '../theme';

const SPECIALTIES = ['General Practice','Cardiology','Paediatrics','Orthopaedics','Neurology','Dermatology','Gynaecology','Oncology','Psychiatry','Other'];

// Formats a raw numeric string into DD / MM / YYYY as user types
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
}

// Parses formatted input back to a storable "DD/MM/YYYY" string
function parseDob(formatted: string): string {
  return formatted.replace(/\s/g, '');
}

// Validates day / month make basic sense
function isDobComplete(formatted: string): boolean {
  const digits = formatted.replace(/\D/g, '');
  if (digits.length < 8) return false;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= new Date().getFullYear();
}

export default function NewPatientScreen({ navigation, route }: any) {
  const { prefillName = '', prefillDob = '', sessionId } = route.params || {};
  const [name, setName] = useState(prefillName);
  const [dobRaw, setDobRaw] = useState(prefillDob ? prefillDob.replace(/\//g, ' / ') : '');
  const [specialty, setSpecialty] = useState('General Practice');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [showSpecialties, setShowSpecialties] = useState(false);
  const { addSession, updateSession } = useApp();

  const dobValid = isDobComplete(dobRaw);
  const canStart = !!name && dobValid;

  const handleDobChange = (text: string) => {
    // Allow user to backspace cleanly — strip all non-digits first
    setDobRaw(formatDobInput(text));
  };

  const handleStart = () => {
    if (!canStart) return;
    const dob = parseDob(dobRaw); // store as "DD/MM/YYYY"
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (sessionId) {
      updateSession(sessionId, { status: 'Recording', time: timeStr, patientName: name, dob, chiefComplaint: chiefComplaint.trim() || undefined });
      navigation.replace('Record', { patientName: name, dob, sessionId });
    } else {
      addSession({ patientName: name, dob, time: timeStr, duration: '--:--', status: 'Recording', chiefComplaint: chiefComplaint.trim() || undefined });
      navigation.replace('Record', { patientName: name, dob });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>NEW SESSION</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.headingSection}>
            <Text style={styles.eyebrow}>PATIENT INTAKE</Text>
            <Text style={styles.heading}>Enter patient details before ambient capture begins.</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Patient Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Marcus Coleman"
            placeholderTextColor={COLORS.border}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />

          <Text style={styles.label}>Date of Birth</Text>
          <View style={styles.dobWrapper}>
            <TextInput
              style={[styles.dobInput, dobRaw.length > 0 && !dobValid && styles.dobInputError, dobValid && styles.dobInputValid]}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={COLORS.border}
              value={dobRaw}
              onChangeText={handleDobChange}
              keyboardType="number-pad"
              maxLength={14}
            />
            {/* Calendar icon */}
            <View style={styles.dobIcon}>
              <Text style={styles.dobIconText}>📅</Text>
            </View>
          </View>

          {/* Inline hint / validation */}
          {dobRaw.length > 0 && !dobValid && (
            <Text style={styles.dobHint}>Enter a valid date — DD / MM / YYYY</Text>
          )}
          {dobValid && (
            <Text style={styles.dobSuccess}>✓ Valid date</Text>
          )}

          <Text style={styles.label}>Clinical Context</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowSpecialties(!showSpecialties)}>
            <Text style={styles.selectorText}>{specialty}</Text>
            <Text style={{ color: COLORS.taupe }}>{showSpecialties ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showSpecialties && (
            <View style={styles.dropdown}>
              {SPECIALTIES.map(sp => (
                <TouchableOpacity key={sp} style={[styles.dropdownItem, specialty === sp && { backgroundColor: COLORS.warmWhite }]}
                  onPress={() => { setSpecialty(sp); setShowSpecialties(false); }}>
                  <Text style={[styles.dropdownText, specialty === sp && { color: COLORS.accent, fontFamily: FONT.semibold }]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Chief Complaint / Reason for Visit</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="e.g. Chest pain for 3 days, shortness of breath"
            placeholderTextColor={COLORS.border}
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            multiline
          />

          <View style={styles.privacyBox}>
            <Text style={styles.privacyText}>🔒  Audio is transcribed in real-time and never permanently stored. All data is encrypted in transit.</Text>
          </View>

          <TouchableOpacity style={[styles.startBtn, !canStart && styles.startBtnDisabled]} onPress={handleStart} disabled={!canStart}>
            <Text style={styles.startBtnText}>START AMBIENT CAPTURE</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.white },
  scroll:          { flexGrow: 1, paddingHorizontal: 24 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 36 : 20, paddingBottom: 20 },
  cancelText:      { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.taupe, letterSpacing: 1 },
  headerTitle:     { fontFamily: FONT.bold, fontSize: 12, color: COLORS.charcoal, letterSpacing: 1.5 },
  divider:         { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  headingSection:  { paddingVertical: 28 },
  eyebrow:         { fontFamily: FONT.semibold, fontSize: 10, color: COLORS.accent, letterSpacing: 2, marginBottom: 12 },
  heading:         { fontFamily: FONT.bold, fontSize: 24, color: COLORS.charcoal, lineHeight: 32, letterSpacing: -0.25 },
  label:           { fontFamily: FONT.medium, fontSize: 11, color: COLORS.taupe, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  input:           { borderWidth: 1, borderColor: COLORS.border, padding: 15, fontSize: 15, fontFamily: FONT.regular, color: COLORS.black, borderRadius: RADIUS.sm },
  dobWrapper:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: COLORS.white },
  dobInput:        { flex: 1, padding: 15, fontSize: 16, fontFamily: FONT.medium, color: COLORS.black, letterSpacing: 2 },
  dobInputError:   { color: COLORS.accent },
  dobInputValid:   { color: COLORS.green },
  dobIcon:         { paddingHorizontal: 14 },
  dobIconText:     { fontSize: 18 },
  dobHint:         { fontFamily: FONT.regular, fontSize: 12, color: COLORS.accent, marginTop: 6 },
  dobSuccess:      { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.green, marginTop: 6 },
  selector:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, padding: 15, borderRadius: RADIUS.sm },
  selectorText:    { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black },
  dropdown:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, marginTop: 4, overflow: 'hidden' },
  dropdownItem:    { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  dropdownText:    { fontFamily: FONT.regular, fontSize: 14, color: COLORS.black },
  privacyBox:      { backgroundColor: COLORS.warmWhite, padding: 16, marginTop: 24, marginBottom: 28, borderRadius: RADIUS.sm },
  privacyText:     { fontFamily: FONT.regular, fontSize: 12, color: COLORS.taupe, lineHeight: 20 },
  startBtn:        { backgroundColor: COLORS.accent, paddingVertical: 18, alignItems: 'center', borderRadius: RADIUS.sm },
  startBtnDisabled:{ opacity: 0.4 },
  startBtnText:    { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1.5 },
});
