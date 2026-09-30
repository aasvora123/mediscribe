import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import { COLORS } from '../theme';

export default function RootNavigator() {
  const { isAuthenticated, authLoading } = useApp();

  // Show a centered spinner while Supabase checks for an existing session.
  // This prevents a flash of the login screen on app restart.
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // key prop forces full remount when auth state changes → clean navigation stack
  return (
    <NavigationContainer key={isAuthenticated ? 'app' : 'auth'}>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
