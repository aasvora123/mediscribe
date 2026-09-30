import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const env = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Supabase] Missing env vars — check your eas.json configuration or app config.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Use localStorage on web, AsyncStorage on native (add later)
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
