import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { COLORS, FONT, RADIUS } from '../../theme';

const SPECIALTIES = ['General Practice','Cardiology','Paediatrics','Orthopaedics','Neurology','Dermatology','Gynaecology','Oncology','Psychiatry','Other'];

export default function SignupScreen({ navigation }: any) {
  const { signup } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [license, setLicense] = useState('');
  const [specialty, setSpecialty] = useState('General Practice');
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    setErrorMsg(null);
    if (!name || !email || !license || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.'); return;
    }
    if (password !== confirmPassword) { setErrorMsg('Passwords do not match.'); return; }
    if (password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const ok = await signup({ name: `Dr. ${name.replace(/^Dr\.?\s*/i, '')}`, email: email.trim(), specialty, licenseNumber: license, password });
    setLoading(false);
    if (!ok) setErrorMsg('Sign up failed. This email may already be registered.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>← LOGIN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.headingSection}>
            <Text style={styles.eyebrow}>DOCTOR REGISTRATION</Text>
            <Text style={styles.heading}>Join MediScribe.{"\n"}Clinicians only.</Text>
            <Text style={styles.subheading}>Start capturing ambient consultations in minutes.</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="Aarav Mehta" placeholderTextColor={COLORS.border} value={name} onChangeText={setName} autoCapitalize="words" />

          <Text style={styles.label}>Medical License Number</Text>
          <TextInput style={styles.input} placeholder="MH-12345" placeholderTextColor={COLORS.border} value={license} onChangeText={setLicense} autoCapitalize="characters" />

          <Text style={styles.label}>Specialty</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowSpecialties(!showSpecialties)}>
            <Text style={styles.selectorText}>{specialty}</Text>
            <Text style={{ color: COLORS.taupe, fontFamily: FONT.regular }}>{showSpecialties ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showSpecialties && (
            <View style={styles.dropdown}>
              {SPECIALTIES.map(sp => (
                <TouchableOpacity key={sp} style={[styles.dropdownItem, specialty === sp && styles.dropdownSelected]}
                  onPress={() => { setSpecialty(sp); setShowSpecialties(false); }}>
                  <Text style={[styles.dropdownText, specialty === sp && styles.dropdownTextSelected]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.divider, { marginTop: 28, marginBottom: 4 }]} />
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ACCOUNT CREDENTIALS</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput style={styles.input} placeholder="doctor@hospital.com" placeholderTextColor={COLORS.border} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput style={styles.inputPassword} placeholder="Min. 6 characters" placeholderTextColor={COLORS.border} value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor={COLORS.border} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <View style={styles.consentBox}>
            <Text style={styles.consentText}>By registering, you confirm you are a licensed medical professional and agree to our Terms of Service. Patient data is processed securely and never retained beyond the session.</Text>
          </View>

          {/* Error banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠ {errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.signupBtn, loading && { opacity: 0.6 }]} onPress={handleSignup} disabled={loading}>
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.signupBtnText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginRow} onPress={() => navigation.goBack()}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Text style={styles.loginLink}>Sign In →</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.white },
  scroll:         { flexGrow: 1, paddingHorizontal: 28 },
  topRow:         { paddingTop: 44, paddingBottom: 20 },
  backBtn:        {},
  backText:       { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.accent, letterSpacing: 1.5 },
  divider:        { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  headingSection: { paddingVertical: 28 },
  eyebrow:        { fontFamily: FONT.semibold, fontSize: 11, color: COLORS.accent, letterSpacing: 2, marginBottom: 14 },
  heading:        { fontFamily: FONT.extrabold, fontSize: 30, color: COLORS.charcoal, lineHeight: 38, letterSpacing: -0.5, marginBottom: 12 },
  subheading:     { fontFamily: FONT.regular, fontSize: 15, color: COLORS.taupe, lineHeight: 22 },
  sectionLabel:   { fontFamily: FONT.semibold, fontSize: 10, color: COLORS.taupe, letterSpacing: 2, marginTop: 20, marginBottom: 4 },
  label:          { fontFamily: FONT.medium, fontSize: 12, color: COLORS.taupe, letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  input:          { borderWidth: 1, borderColor: COLORS.border, padding: 15, fontSize: 15, fontFamily: FONT.regular, color: COLORS.black, backgroundColor: COLORS.white, borderRadius: RADIUS.sm },
  passwordRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  inputPassword:  { flex: 1, padding: 15, fontSize: 15, fontFamily: FONT.regular, color: COLORS.black },
  eyeBtn:         { paddingHorizontal: 14 },
  eyeText:        { fontSize: 17 },
  selector:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, padding: 15, borderRadius: RADIUS.sm },
  selectorText:   { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black },
  dropdown:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, marginTop: 4, overflow: 'hidden' },
  dropdownItem:   { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.white },
  dropdownSelected:{ backgroundColor: COLORS.warmWhite },
  dropdownText:   { fontFamily: FONT.regular, fontSize: 14, color: COLORS.black },
  dropdownTextSelected: { fontFamily: FONT.semibold, color: COLORS.accent },
  consentBox:     { backgroundColor: COLORS.warmWhite, padding: 16, marginTop: 24, marginBottom: 24, borderRadius: RADIUS.sm },
  consentText:    { fontFamily: FONT.regular, fontSize: 12, color: COLORS.taupe, lineHeight: 20 },
  signupBtn:      { backgroundColor: COLORS.accent, paddingVertical: 16, alignItems: 'center', borderRadius: RADIUS.sm, marginBottom: 8 },
  signupBtnText:  { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1.5 },
  errorBanner:    { backgroundColor: '#FEE2E2', borderLeftWidth: 3, borderLeftColor: COLORS.accent, padding: 14, borderRadius: RADIUS.sm, marginBottom: 16 },
  errorText:      { fontFamily: FONT.regular, fontSize: 13, color: '#991B1B', lineHeight: 20 },
  loginRow:       { flexDirection: 'row', justifyContent: 'center', paddingVertical: 20 },
  loginText:      { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe },
  loginLink:      { fontFamily: FONT.semibold, fontSize: 14, color: COLORS.accent },
});
