import React from 'react';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from './src/theme';
import TranscriptionMvpScreen from './src/screens/TranscriptionMvpScreen';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.warmWhite }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <TranscriptionMvpScreen />
  );
}
