# Doctor-patient conversation summary MVP

This MVP reuses the app's microphone recorder and Groq speech-to-text service.
After recording stops, a LangGraph workflow uses Gemini 3.8 Flash to produce a
concise summary of what the doctor and patient discussed, check that summary
against the speech recognition transcript, and make at most one correction
pass. It preserves the conversation's language and does not invent diagnoses,
prescriptions, or medical advice.

## Supabase setup

1. Enable **Anonymous Sign-Ins** in Supabase Authentication settings. The MVP
   uses an anonymous Supabase session to call the Edge Function without a
   login screen; JWT verification remains enabled.
2. Set the Gemini key as a server-side Supabase secret:

   ```powershell
   $env:GEMINI_API_KEY = "<your Google AI Studio API key>"
   supabase secrets set GEMINI_API_KEY=$env:GEMINI_API_KEY
   ```

3. Deploy the conversation summary agent:

   ```powershell
   supabase functions deploy transcribe-conversation
   ```

4. Configure the existing Groq transcription key and Supabase URL/publishable
   key for the app as usual. Do not expose the Gemini key as an `EXPO_PUBLIC_*`
   variable.

Audio is sent to Groq for speech recognition. The recognized text is then sent
to the Supabase Edge Function and Gemini for summarization and review. Check
the summary against the original recording before relying on it.
