import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { COLORS, FONT, RADIUS } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Missing Fields', 'Please enter your email and password.'); return; }
    setLoading(true);
    const success = await login(email.trim(), password);
    setLoading(false);
    if (!success) Alert.alert('Login Failed', 'Invalid credentials.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo / Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>M</Text>
            </View>
            <Text style={styles.brandName}>MEDISCRIBE</Text>
          </View>

          <View style={styles.divider} />

          {/* Headline */}
          <View style={styles.headingSection}>
            <Text style={styles.eyebrow}>CLINICIAN LOGIN</Text>
            <Text style={styles.heading}>Intelligence at the{"\n"}point of conversation.</Text>
            <Text style={styles.subheading}>Sign in to access your ambient documentation dashboard.</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="doctor@hospital.com"
              placeholderTextColor={COLORS.border}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.inputPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.border}
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.loginBtnText}>SIGN IN</Text>
              }
            </TouchableOpacity>
          </View>



          <View style={styles.divider} />

          {/* Sign up link */}
          <TouchableOpacity style={styles.signupRow} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupText}>New to MediScribe? </Text>
            <Text style={styles.signupLink}>Create your doctor account →</Text>
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
  brandRow:       { flexDirection: 'row', alignItems: 'center', paddingTop: 44, paddingBottom: 28 },
  logoMark:       { width: 32, height: 32, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoLetter:     { color: COLORS.white, fontFamily: FONT.extrabold, fontSize: 20 },
  brandName:      { fontFamily: FONT.extrabold, fontSize: 18, color: COLORS.charcoal, letterSpacing: 3 },
  divider:        { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  headingSection: { paddingVertical: 32 },
  eyebrow:        { fontFamily: FONT.semibold, fontSize: 11, color: COLORS.accent, letterSpacing: 2, marginBottom: 14 },
  heading:        { fontFamily: FONT.extrabold, fontSize: 32, color: COLORS.charcoal, lineHeight: 40, letterSpacing: -0.5, marginBottom: 14 },
  subheading:     { fontFamily: FONT.regular, fontSize: 15, color: COLORS.taupe, lineHeight: 22 },

  formCard:       { paddingVertical: 4 },
  label:          { fontFamily: FONT.medium, fontSize: 12, color: COLORS.taupe, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  input:          { borderWidth: 1, borderColor: COLORS.border, padding: 15, fontSize: 15, fontFamily: FONT.regular, color: COLORS.black, backgroundColor: COLORS.white, borderRadius: RADIUS.sm },
  passwordRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: COLORS.white },
  inputPassword:  { flex: 1, padding: 15, fontSize: 15, fontFamily: FONT.regular, color: COLORS.black },
  eyeBtn:         { paddingHorizontal: 14 },
  eyeText:        { fontSize: 17 },
  forgotLink:     { alignSelf: 'flex-end', marginTop: 10, marginBottom: 28 },
  forgotText:     { fontFamily: FONT.medium, fontSize: 13, color: COLORS.accent },

  loginBtn:       { backgroundColor: COLORS.accent, paddingVertical: 16, alignItems: 'center', borderRadius: RADIUS.sm, marginBottom: 4 },
  loginBtnText:   { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1.5 },


  signupRow:      { flexDirection: 'row', justifyContent: 'center', paddingVertical: 20 },
  signupText:     { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe },
  signupLink:     { fontFamily: FONT.semibold, fontSize: 14, color: COLORS.accent },
});
