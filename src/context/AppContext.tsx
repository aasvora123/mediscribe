import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { createConsultation, updateConsultation, fetchConsultations, deleteConsultation, getPatientNumber } from '../services/consultationService';

export type SessionStatus = 'Upcoming' | 'Recording' | 'Draft' | 'Approved';

export interface Session {
  id: string;
  dbId?: string;              // Supabase row UUID (undefined until saved)
  patientName: string;
  dob: string;
  time: string;
  duration: string;
  status: SessionStatus;
  createdAt: Date;
  audioUri?: string | null;
  transcript?: string | null;
  transcriptLanguage?: string;
  soap?: Record<string, any> | null;
  // ── New doctor-centric fields ──
  chiefComplaint?: string;        // Reason for visit / chief complaint
  followUpDate?: string | null;   // e.g. "2026-04-20"
  rxNotes?: string | null;        // Quick prescription / Rx notes
  patientNumber?: number | null;  // Auto-generated numeric PID (e.g. 1001)
}

export interface DoctorProfile {
  name: string;
  specialty: string;
  licenseNumber: string;
  email: string;
  initials: string;
}

interface AppContextType {
  // Auth
  isAuthenticated: boolean;
  doctor: DoctorProfile | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (profile: Omit<DoctorProfile, 'initials'> & { password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  // Sessions
  sessions: Session[];
  addSession: (session: Omit<Session, 'id' | 'createdAt'>) => void;
  updateSession: (id: string, changes: Partial<Session>) => void;
  approveSession: (id: string) => void;
  assignTimeslot: (id: string, time: string) => void;
  deleteSession: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_SESSIONS: Session[] = [];

function makeInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);

  // ── Boot: Check existing Supabase session ────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadProfile(session.user);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile(session.user);
        setIsAuthenticated(true);
      } else {
        setDoctor(null);
        setIsAuthenticated(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (user: any) => {
    // Fetch doctor profile from profiles table
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setDoctor({
        name: data.name,
        specialty: data.specialty ?? '',
        licenseNumber: data.license_no ?? '',
        email: user.email ?? '',
        initials: makeInitials(data.name),
      });
      setIsAuthenticated(true);

      try {
        const records = await fetchConsultations();
        if (records && records.length > 0) {
          const mappedSessions: Session[] = records.map(r => ({
            id: r.id!,
            dbId: r.id!,
            patientName: r.patient_name,
            dob: r.dob,
            time: r.time_slot ?? '',
            duration: r.duration_seconds ? `${Math.floor(r.duration_seconds / 60)}:${(r.duration_seconds % 60).toString().padStart(2, '0')}` : '--:--',
            status: r.status as SessionStatus,
            createdAt: (r as any).created_at ? new Date((r as any).created_at) : new Date(),
            audioUri: r.audio_uri,
            transcript: r.transcript,
            transcriptLanguage: r.transcript_language,
            soap: r.soap_note,
            chiefComplaint: r.chief_complaint ?? undefined,
            followUpDate: r.follow_up_date ?? undefined,
            rxNotes: r.rx_notes ?? undefined,
            patientNumber: r.patient_number ?? undefined,
          }));
          setSessions(mappedSessions);
        } else {
          setSessions([]); // Clear mock data if logged into an empty account
        }
      } catch (err) {
        console.warn('Failed to load consultations from DB', err);
      }
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;
    await loadProfile(data.user);
    return true;
  };

  // ── Signup ───────────────────────────────────────────────────────────────
  const signup = async (
    data: Omit<DoctorProfile, 'initials'> & { password: string }
  ): Promise<boolean> => {
    const { data: auth, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      console.error('[Auth] signUp error:', error.message);
      return false;
    }
    if (!auth.user) {
      console.error('[Auth] signUp: no user returned');
      return false;
    }

    // Insert profile — use the session from signUp response directly
    // (important when email confirmation is disabled and session is returned immediately)
    const sessionToken = auth.session?.access_token;
    const profileClient = sessionToken
      ? supabase  // already authenticated via onAuthStateChange
      : supabase;

    const { error: profileError } = await profileClient.from('profiles').upsert({
      id: auth.user.id,
      name: data.name,
      specialty: data.specialty,
      license_no: data.licenseNumber,
    });

    if (profileError) {
      console.error('[Auth] profile insert error:', profileError.message);
      // Don't block — user was created in auth, profile can be set later
    }

    // If email confirmation is OFF, Supabase returns a session immediately
    if (auth.session) {
      setDoctor({
        name: data.name,
        specialty: data.specialty,
        licenseNumber: data.licenseNumber,
        email: data.email,
        initials: makeInitials(data.name),
      });
      setIsAuthenticated(true);
    }
    // If email confirmation is ON, session is null — user must confirm email first

    return true;
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setDoctor(null);
    setSessions(INITIAL_SESSIONS);
  };

  // ── Session management (local + async DB sync) ───────────────────────────
  const addSession = (session: Omit<Session, 'id' | 'createdAt'>) => {
    const localId = Date.now().toString();
    const newSession: Session = { ...session, id: localId, createdAt: new Date() };
    setSessions(prev => [newSession, ...prev]);

    // Async DB insert — non-blocking, captures dbId when done
    if (doctor) {
      createConsultation({
        doctor_id: '',  // filled by RLS / trigger
        patient_name: session.patientName,
        dob: session.dob,
        status: session.status,
        time_slot: session.time,
        audio_uri: session.audioUri ?? null,
        transcript: session.transcript ?? null,
        chief_complaint: session.chiefComplaint ?? null,
        follow_up_date: session.followUpDate ?? null,
        rx_notes: session.rxNotes ?? null,
      }).then(res => {
        if (res && res.id) {
          setSessions(prev => prev.map(s => s.id === localId ? { ...s, dbId: res.id, patientNumber: res.patientNumber } : s));
        }
      }).catch(err => console.warn('[DB] addSession error:', err));
    }
  };

  const updateSession = (id: string, changes: Partial<Session>) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...changes };
      // Async DB sync if row exists
      if (updated.dbId) {
        updateConsultation(updated.dbId, {
          status: updated.status,
          transcript: updated.transcript ?? null,
          transcript_language: updated.transcriptLanguage,
          audio_uri: updated.audioUri ?? null,
          soap_note: updated.soap ?? null,
          chief_complaint: updated.chiefComplaint ?? null,
          follow_up_date: updated.followUpDate ?? null,
          rx_notes: updated.rxNotes ?? null,
        }).catch(err => console.warn('[DB] updateSession error:', err));
      }
      return updated;
    }));
  };

  const approveSession = (id: string) => updateSession(id, { status: 'Approved' });
  const assignTimeslot = (id: string, time: string) => updateSession(id, { time });

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const target = prev.find(s => s.id === id);
      if (target?.dbId) {
        deleteConsultation(target.dbId).catch(err => console.warn('[DB] deleteSession error:', err));
      }
      return prev.filter(s => s.id !== id);
    });
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, doctor, authLoading,
      login, signup, logout,
      sessions, addSession, updateSession, approveSession, assignTimeslot, deleteSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
