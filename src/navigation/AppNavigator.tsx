import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import NewPatientScreen from '../screens/NewPatientScreen';
import SummaryScreen from '../screens/SummaryScreen';

export type RootStackParamList = {
  Home: undefined;
  NewPatient: { prefillName?: string; prefillDob?: string; sessionId?: string } | undefined;
  Record: { patientName: string; dob: string; sessionId?: string };
  Summary: { patientName: string; dob: string; sessionId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="NewPatient" component={NewPatientScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Record" component={RecordScreen} />
      <Stack.Screen name="Summary" component={SummaryScreen} />
    </Stack.Navigator>
  );
}
