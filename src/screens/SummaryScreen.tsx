import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Platform, Modal, ActivityIndicator,
  TextInput, Share, Linking, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, FONT, RADIUS } from '../theme';
import { transcribeAudioGroq, AbridgeNoteSection } from '../services/groqService';
import { generateSoapNote } from '../services/soapAgentService';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function SummaryScreen({ route, navigation }: any) {
  const { patientName = 'Patient', dob = '--', sessionId, audioUri: routeUri } = route.params || {};
  const { approveSession, sessions, updateSession } = useApp();
  const [activeTab, setActiveTab] = useState<'NOTE' | 'PATIENT_SUMMARY' | 'TRANSCRIPT'>('NOTE');
  const [approveModal, setApproveModal] = useState(false);
  const [shareModal, setShareModal]     = useState(false);
  const audioRef = useRef<any>(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing]   = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const currentSession = sessions.find(s => s.id === sessionId);
  const isDraft   = currentSession?.status === 'Draft';
  const audioUri  = currentSession?.audioUri ?? routeUri ?? null;
  const liveTranscript = currentSession?.transcript ?? null;
  const detectedLang   = currentSession?.transcriptLanguage ?? null;

  // SOAP state
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [soapError, setSoapError] = useState<string | null>(null);
  const liveSoap = currentSession?.soap as AbridgeNoteSection[] | null | undefined;

  // ── Edit mode: tracks which section index is being edited and edits map ──
  const [editingIdx, setEditingIdx]         = useState<number | null>(null);
  const [editedSoap, setEditedSoap]         = useState<AbridgeNoteSection[]>([]);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // ── Follow-up & Rx state ──────────────────────────────────────────────────
  const [followUpDate, setFollowUpDate]   = useState(currentSession?.followUpDate ?? '');
  const [rxNotes, setRxNotes]             = useState(currentSession?.rxNotes ?? '');
  const [isEditingRx, setIsEditingRx]     = useState(false);
  const [followUpModal, setFollowUpModal] = useState(false);
  const [followUpInput, setFollowUpInput] = useState(currentSession?.followUpDate ?? '');
  const chiefComplaint = currentSession?.chiefComplaint ?? '';

  // Sync editable copy whenever liveSoap changes
  useEffect(() => {
    if (liveSoap) setEditedSoap(JSON.parse(JSON.stringify(liveSoap)));
  }, [liveSoap]);

  // ── Auto-trigger transcription when screen loads with audio ──────────────
  useEffect(() => {
    if (audioUri && !liveTranscript && !isTranscribing) handleTranscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUri]);

  const handleTranscribe = async () => {
    if (!audioUri) return;
    setIsTranscribing(true);
    setTranscriptError(null);
    try {
      // 1. Transcribe audio using Groq Whisper (bypasses 30 sec limit)
      const { transcript, language_code } = await transcribeAudioGroq(audioUri, 'en');
      if (sessionId) updateSession(sessionId, { transcript: transcript, transcriptLanguage: language_code });
      handleGenerateSoap(transcript);
    } catch (err: any) {
      setTranscriptError(err.message ?? 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleGenerateSoap = async (transcript: string) => {
    setIsGeneratingSoap(true);
    setSoapError(null);
    try {
      const agentResult = await generateSoapNote(transcript);
      const sections: AbridgeNoteSection[] = agentResult.sections.map(section => ({
        ...section,
        kind: section.title.toLowerCase().includes('patient summary') ? 'patient_summary' : 'clinical',
      }));

      if (agentResult.reviewItems.length) {
        sections.push({
          title: 'AI Review — Verify with clinician',
          body: agentResult.reviewItems.map(item => `• ${item}`).join('\n'),
          kind: 'agent_review',
        });
      }
      if (agentResult.followUpSuggestions.length) {
        sections.push({
          title: 'Follow-up discussion prompts',
          body: agentResult.followUpSuggestions.map(item => `• ${item}`).join('\n'),
          kind: 'follow_up',
        });
      }

      if (sessionId) updateSession(sessionId, { soap: sections });
    } catch (err: any) {
      setSoapError(err.message ?? 'SOAP generation failed.');
    } finally {
      setIsGeneratingSoap(false);
    }
  };

  const handleApprove = () => {
    // Save edits before approving
    if (sessionId && editedSoap.length) updateSession(sessionId, { soap: editedSoap });
    if (sessionId) { approveSession(sessionId); setApproveModal(false); navigation.navigate('Home'); }
  };

  // ── Save section edits ────────────────────────────────────────────────────
  const saveSectionEdit = (idx: number, newBody: string) => {
    const updated = editedSoap.map((s, i) => i === idx ? { ...s, body: newBody } : s);
    setEditedSoap(updated);
    if (sessionId) updateSession(sessionId, { soap: updated });
    setEditingIdx(null);
  };

  // ── Formatted note text ───────────────────────────────────────────────────
  const getFormattedNote = (scope: 'clinical' | 'patient' | 'all' = 'all') => {
    const soap = editedSoap.length ? editedSoap : (liveSoap ?? []);
    return soap
      .filter(s => {
        const isPatientSummary = s.kind === 'patient_summary' || s.title.includes('Patient Summary');
        const isAgentReview = s.kind === 'agent_review' || s.kind === 'follow_up';
        if (scope === 'clinical') return !isPatientSummary && !isAgentReview;
        if (scope === 'patient') return isPatientSummary;
        return true;
      })
      .map(s => `=== ${s.title} ===\n${s.body}`)
      .join('\n\n');
  };

  // ── Native share sheet ────────────────────────────────────────────────────
  const handleShare = async () => {
    const text = `SOAP Note — ${patientName}\nDOB: ${dob}\n\n${getFormattedNote('clinical')}`;
    try { await Share.share({ message: text, title: `SOAP Note – ${patientName}` }); } catch {}
  };

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    setShareModal(false);
    const soap = editedSoap.length ? editedSoap : (liveSoap ?? []);
    const patientSummary = soap.find(s => s.title.includes('Patient Summary'));
    const text = patientSummary
      ? `🏥 *MediScribe Note — ${patientName}*\n\n*Patient Summary:*\n${patientSummary.body}`
      : `🏥 *MediScribe — ${patientName}*\n\n${getFormattedNote('clinical')}`;
    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encoded}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      // Fallback to web link if app isn't found or registered properly
      try {
        await Linking.openURL(`https://wa.me/?text=${encoded}`);
      } catch (err) {
        Alert.alert('WhatsApp Error', 'Could not open WhatsApp. Please ensure it is installed.');
      }
    }
  };

  // ── Copy with toast ───────────────────────────────────────────────────────
  const copyWithToast = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  // ── Displayed SOAP sections filtered by tab ───────────────────────────────
  const displayedSoap = (editedSoap.length ? editedSoap : (liveSoap ?? [])).filter(s =>
    activeTab === 'NOTE'
      ? s.kind !== 'agent_review' && s.kind !== 'follow_up' &&
        s.kind !== 'patient_summary' && !s.title.includes('Patient Summary')
      : s.kind === 'patient_summary' || s.title.includes('Patient Summary')
  );
  const currentSoap = editedSoap.length ? editedSoap : (liveSoap ?? []);
  const agentReview = currentSoap.find(section => section.kind === 'agent_review');
  const followUpPrompts = currentSoap.find(section => section.kind === 'follow_up');

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backText}>← WORKLIST</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isDraft && <View style={styles.draftBadge}><Text style={styles.draftText}>DRAFT</Text></View>}
          {/* Share icon in header */}
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShareModal(true)}>
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Patient header ───────────────────────────────────────────────── */}
      <View style={styles.patientHeader}>
        <View>
          <View style={styles.patientNameRow}>
            <Text style={styles.patientName}>{patientName}</Text>
            {currentSession?.patientNumber && (
              <View style={styles.pidBadge}>
                <Text style={styles.pidText}>PID: {currentSession.patientNumber}</Text>
              </View>
            )}
          </View>
          <Text style={styles.dobText}>DOB: {dob}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {(['NOTE', 'PATIENT_SUMMARY', 'TRANSCRIPT'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'NOTE' ? 'CLINICAL' : tab === 'PATIENT_SUMMARY' ? 'PATIENT [PVS]' : 'TRANSCRIPT'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TRANSCRIPT TAB ──────────────────────────────────────────────── */}
      {activeTab === 'TRANSCRIPT' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {!isTranscribing && transcriptError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Transcription failed</Text>
              <Text style={styles.errorBody}>{transcriptError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleTranscribe}>
                <Text style={styles.retryBtnText}>RETRY</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isTranscribing && !transcriptError && !audioUri && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>No audio recorded</Text>
              <Text style={styles.errorBody}>This session was created without recording.</Text>
            </View>
          )}
          {!isTranscribing && liveTranscript && (
            <>
              <View style={styles.linkedEvidence}>
                <View>
                  <Text style={styles.linkedText}>Live Transcript</Text>
                  {detectedLang && <Text style={styles.detectedLang}>Detected: {detectedLang}</Text>}
                </View>
                <TouchableOpacity onPress={handleTranscribe}><Text style={styles.linkedClose}>↺ Redo</Text></TouchableOpacity>
              </View>
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptFullText}>{liveTranscript}</Text>
              </View>
              <TouchableOpacity style={styles.copyRowBtn} onPress={() => copyWithToast(liveTranscript)}>
                <Text style={styles.copyRowBtnText}>📋  COPY TRANSCRIPT</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* ── NOTE / PATIENT SUMMARY TABS ─────────────────────────────────── */}
      {(activeTab === 'NOTE' || activeTab === 'PATIENT_SUMMARY') && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'NOTE' && (
            <View style={styles.noteHeader}>
              <Text style={styles.noteTitleLabel}>STANDARD NOTE</Text>
              <Text style={styles.noteTitle}>SOAP Format  ▾</Text>
            </View>
          )}
          <View style={styles.divider} />

          {/* Transcription error shown on NOTE tab too */}
          {!isTranscribing && transcriptError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Transcription Failed</Text>
              <Text style={styles.errorBody}>{transcriptError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleTranscribe}>
                <Text style={styles.retryBtnText}>RETRY</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SOAP error */}
          {!isGeneratingSoap && soapError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Structuring failed</Text>
              <Text style={styles.errorBody}>{soapError}</Text>
              {liveTranscript && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => handleGenerateSoap(liveTranscript)}>
                  <Text style={styles.retryBtnText}>RETRY</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Empty state */}
          {!isGeneratingSoap && !soapError && !liveSoap && !transcriptError && (
            <View style={styles.section}>
              {audioUri ? (
                <TouchableOpacity style={[styles.retryBtn, { alignSelf: 'center', marginTop: 32 }]} onPress={handleTranscribe}>
                  <Text style={styles.retryBtnText}>▶  GENERATE NOTE</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Waiting for Audio</Text>
                  <Text style={styles.sectionBody}>Start recording a session to automatically generate a clinical note.</Text>
                </>
              )}
            </View>
          )}

          {/* ── SOAP Sections ──────────────────────────────────────────── */}
          {!isGeneratingSoap && !soapError && displayedSoap.map((section, idx) => {
            const globalIdx = (editedSoap.length ? editedSoap : (liveSoap ?? [])).indexOf(section);
            const isEditing = editingIdx === globalIdx;
            return (
              <View key={idx} style={styles.section}>
                {/* Section header row */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.sectionActions}>
                    {/* Copy section */}
                    <TouchableOpacity
                      style={styles.sectionActionBtn}
                      onPress={() => copyWithToast(section.body)}
                    >
                      <Text style={styles.sectionActionIcon}>📋</Text>
                    </TouchableOpacity>
                    {/* Edit section */}
                    {!isEditing && (
                      <TouchableOpacity
                        style={styles.sectionActionBtn}
                        onPress={() => setEditingIdx(globalIdx)}
                      >
                        <Text style={styles.sectionActionIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Editable or read-only body */}
                {isEditing ? (
                  <View>
                    <TextInput
                      style={styles.sectionEditInput}
                      value={editedSoap[globalIdx]?.body ?? section.body}
                      onChangeText={text => {
                        const updated = editedSoap.map((s, i) => i === globalIdx ? { ...s, body: text } : s);
                        setEditedSoap(updated);
                      }}
                      multiline
                      autoFocus
                      textAlignVertical="top"
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditingIdx(null)}>
                        <Text style={styles.cancelEditBtnText}>CANCEL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={() => saveSectionEdit(globalIdx, editedSoap[globalIdx]?.body ?? section.body)}>
                        <Text style={styles.saveEditBtnText}>SAVE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  section.highlight ? (
                    <Text style={styles.sectionBody}>
                      {section.body.split(section.highlight).map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && <Text style={styles.highlightText}>{section.highlight}</Text>}
                        </React.Fragment>
                      ))}
                    </Text>
                  ) : (
                    <Text style={styles.sectionBody}>{section.body}</Text>
                  )
                )}
              </View>
            );
          })}

          {activeTab === 'NOTE' && !isGeneratingSoap && agentReview && (
            <View style={styles.agentCard}>
              <Text style={styles.agentCardTitle}>AI REVIEW · VERIFY BEFORE APPROVAL</Text>
              <Text style={styles.agentCardBody}>{agentReview.body}</Text>
              <Text style={styles.agentCardFootnote}>Evidence checks are prompts for clinician review, not medical decisions.</Text>
            </View>
          )}
          {activeTab === 'NOTE' && !isGeneratingSoap && followUpPrompts && (
            <View style={styles.agentCard}>
              <Text style={styles.agentCardTitle}>FOLLOW-UP DISCUSSION PROMPTS</Text>
              <Text style={styles.agentCardBody}>{followUpPrompts.body}</Text>
            </View>
          )}

          {/* ── Chief Complaint Card ─────────────────────────────────── */}
          {chiefComplaint ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>CHIEF COMPLAINT</Text>
              <Text style={styles.infoCardBody}>{chiefComplaint}</Text>
            </View>
          ) : null}

          {/* ── Follow-up Date ───────────────────────────────────────── */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardLabel}>FOLLOW-UP</Text>
              <TouchableOpacity onPress={() => { setFollowUpInput(followUpDate); setFollowUpModal(true); }}>
                <Text style={styles.infoCardAction}>{followUpDate ? '✎ Edit' : '+ Set Date'}</Text>
              </TouchableOpacity>
            </View>
            {followUpDate ? (
              <View style={styles.followUpRow}>
                <Text style={styles.followUpIcon}>📅</Text>
                <Text style={styles.followUpDateText}>{followUpDate}</Text>
                <TouchableOpacity onPress={() => {
                  setFollowUpDate('');
                  if (sessionId) updateSession(sessionId, { followUpDate: null });
                }}>
                  <Text style={styles.followUpClear}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.infoCardMuted}>No follow-up scheduled</Text>
            )}
          </View>

          {/* ── Quick Rx / Prescription Notes ────────────────────────── */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardLabel}>💊 PRESCRIPTION NOTES</Text>
              {!isEditingRx && (
                <TouchableOpacity onPress={() => setIsEditingRx(true)}>
                  <Text style={styles.infoCardAction}>{rxNotes ? '✎ Edit' : '+ Add Rx'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {isEditingRx ? (
              <View>
                <TextInput
                  style={styles.rxInput}
                  value={rxNotes}
                  onChangeText={setRxNotes}
                  placeholder="e.g. Tab Amoxicillin 500mg TID x 7 days\nTab Paracetamol 650mg SOS"
                  placeholderTextColor={COLORS.taupe}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditingRx(false)}>
                    <Text style={styles.cancelEditBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveEditBtn} onPress={() => {
                    setIsEditingRx(false);
                    if (sessionId) updateSession(sessionId, { rxNotes: rxNotes.trim() || null });
                  }}>
                    <Text style={styles.saveEditBtnText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : rxNotes ? (
              <Text style={styles.rxBody}>{rxNotes}</Text>
            ) : (
              <Text style={styles.infoCardMuted}>No prescriptions noted</Text>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* ── Footer action bar ────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => copyWithToast(getFormattedNote(activeTab === 'PATIENT_SUMMARY' ? 'patient' : 'clinical'))}
        >
          <Text style={styles.footerBtnIcon}>📋</Text>
          <Text style={styles.footerBtnLabel}>COPY</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerBtn} onPress={handleWhatsApp}>
          <FontAwesome name="whatsapp" size={28} color="#25D366" />
        </TouchableOpacity>

        {isDraft ? (
          <TouchableOpacity style={styles.sendBtn} onPress={() => setApproveModal(true)}>
            <Text style={styles.sendBtnText}>✓ APPROVE</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.sendBtn, { backgroundColor: COLORS.taupe }]}>
            <Text style={styles.sendBtnText}>SENT</Text>
          </View>
        )}
      </View>

      {/* ── Copy toast ──────────────────────────────────────────────────── */}
      {showCopiedToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✓ Copied to clipboard</Text>
        </View>
      )}

      {/* ── Share options modal ──────────────────────────────────────────── */}
      <Modal visible={shareModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShareModal(false)}>
          <View style={styles.shareSheet}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Share Note</Text>

            <TouchableOpacity style={styles.shareOption} onPress={() => { setShareModal(false); handleShare(); }}>
              <Text style={styles.shareOptionIcon}>↗</Text>
              <View>
                <Text style={styles.shareOptionLabel}>Share via...</Text>
                <Text style={styles.shareOptionDesc}>Email, Messages, or any app</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={handleWhatsApp}>
              <Text style={styles.shareOptionIcon}>💬</Text>
              <View>
                <Text style={styles.shareOptionLabel}>WhatsApp Patient Summary</Text>
                <Text style={styles.shareOptionDesc}>Sends simple language summary to patient</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={() => { setShareModal(false); copyWithToast(getFormattedNote('clinical')); }}>
              <Text style={styles.shareOptionIcon}>📋</Text>
              <View>
                <Text style={styles.shareOptionLabel}>Copy Full Clinical Note</Text>
                <Text style={styles.shareOptionDesc}>Copy SOAP note to clipboard for EMR paste</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={() => { setShareModal(false); if (liveTranscript) copyWithToast(liveTranscript); }}>
              <Text style={styles.shareOptionIcon}>🎙</Text>
              <View>
                <Text style={styles.shareOptionLabel}>Copy Raw Transcript</Text>
                <Text style={styles.shareOptionDesc}>Copy the original spoken transcript</Text>
              </View>
            </TouchableOpacity>

            {liveTranscript && (
              <TouchableOpacity style={styles.shareOption} onPress={() => { setShareModal(false); handleGenerateSoap(liveTranscript); }}>
                <Text style={styles.shareOptionIcon}>🔄</Text>
                <View>
                  <Text style={styles.shareOptionLabel}>Regenerate SOAP Note</Text>
                  <Text style={styles.shareOptionDesc}>Re-run AI structuring on the same transcript</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Full-Screen Loading Overlay ─────────────────────────────────── */}
      <Modal visible={isTranscribing || isGeneratingSoap} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(255,255,255,0.93)' }]}>
          <View style={{ alignItems: 'center', padding: 24 }}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={[styles.modalTitle, { marginTop: 24, textAlign: 'center' }]}>
              {isTranscribing ? 'Transcribing Audio...' : 'LangGraph agent is reviewing the note...'}
            </Text>
            <Text style={[styles.modalBody, { textAlign: 'center', marginBottom: 0 }]}>
              {isTranscribing
                ? 'Sarvam AI is processing the clinical audio.'
                : 'Drafting from the transcript, checking evidence, and revising when needed.'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Follow-up Date Modal ───────────────────────────────────── */}
      <Modal visible={followUpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>FOLLOW-UP DATE</Text>
            <Text style={styles.modalTitle}>When should the patient return?</Text>
            <TextInput
              style={styles.followUpInput}
              placeholder="e.g. 21/04/2026 or 2 weeks"
              placeholderTextColor={COLORS.taupe}
              value={followUpInput}
              onChangeText={setFollowUpInput}
              autoFocus
            />
            <View style={styles.followUpQuick}>
              {['1 Week', '2 Weeks', '1 Month', '3 Months'].map(label => (
                <TouchableOpacity key={label} style={styles.followUpChip} onPress={() => setFollowUpInput(label)}>
                  <Text style={styles.followUpChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFollowUpModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApprove} onPress={() => {
                const val = followUpInput.trim();
                setFollowUpDate(val);
                if (sessionId) updateSession(sessionId, { followUpDate: val || null });
                setFollowUpModal(false);
              }}>
                <Text style={styles.modalApproveText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Approve confirmation modal ───────────────────────────────────── */}
      <Modal visible={approveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>CONFIRM APPROVAL</Text>
            <Text style={styles.modalTitle}>Approve this note?</Text>
            <Text style={styles.modalBody}>The SOAP note for {patientName} will be finalized and added to records.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setApproveModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApprove} onPress={handleApprove}>
                <Text style={styles.modalApproveText}>APPROVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.white },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 24 : 10, paddingBottom: 14 },
  backText:          { fontFamily: FONT.semibold, fontSize: 11, color: COLORS.accent, letterSpacing: 1.5 },
  headerActions:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftBadge:        { backgroundColor: COLORS.amberBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  draftText:         { fontFamily: FONT.bold, fontSize: 10, color: COLORS.amber, letterSpacing: 0.8 },
  menuBtn:           { padding: 4 },
  menuDots:          { fontSize: 22, color: COLORS.charcoal, fontFamily: FONT.bold },
  divider:           { height: 1, backgroundColor: COLORS.border },
  patientHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  patientNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patientName:       { fontFamily: FONT.regular, fontSize: 24, color: COLORS.black, letterSpacing: -0.25 },
  pidBadge:          { backgroundColor: COLORS.lightGray, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pidText:           { fontFamily: FONT.medium, fontSize: 10, color: COLORS.taupe, letterSpacing: 0.5 },
  dobText:           { fontFamily: FONT.medium, fontSize: 13, color: '#90867F', marginTop: 3 },
  quickActions:      { flexDirection: 'row', gap: 10 },
  qaBtn:             { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
  qaIcon:            { fontSize: 16 },
  tabRow:            { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:               { paddingVertical: 8, paddingHorizontal: 10, marginRight: 4 },
  activeTab:         { backgroundColor: COLORS.accent },
  tabText:           { fontFamily: FONT.semibold, fontSize: 9, color: COLORS.accent, letterSpacing: 0.5 },
  activeTabText:     { color: COLORS.white },
  scroll:            { flex: 1, paddingHorizontal: 20 },
  noteHeader:        { paddingBottom: 12, paddingTop: 18 },
  noteTitleLabel:    { fontFamily: FONT.bold, fontSize: 9, color: '#90867F', letterSpacing: 2, marginBottom: 4 },
  noteTitle:         { fontFamily: FONT.semibold, fontSize: 20, color: COLORS.black },
  section:           { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border + '55' },
  sectionHeaderRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle:      { fontFamily: FONT.semibold, fontSize: 17, color: COLORS.black, flex: 1 },
  sectionActions:    { flexDirection: 'row', gap: 4 },
  sectionActionBtn:  { padding: 6, borderRadius: 6, backgroundColor: COLORS.lightGray },
  sectionActionIcon: { fontSize: 14 },
  sectionBody:       { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 24 },
  highlightText:     { backgroundColor: '#D4EBE2', color: COLORS.black },
  sectionEditInput:  { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 24, borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: RADIUS.sm, padding: 12, minHeight: 100, backgroundColor: '#F8F9FF' },
  editActions:       { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'flex-end' },
  cancelEditBtn:     { paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  cancelEditBtnText: { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.taupe, letterSpacing: 0.5 },
  saveEditBtn:       { paddingHorizontal: 18, paddingVertical: 9, backgroundColor: COLORS.accent, borderRadius: 20 },
  saveEditBtnText:   { fontFamily: FONT.bold, fontSize: 12, color: COLORS.white, letterSpacing: 0.5 },
  copyRowBtn:        { alignSelf: 'center', marginTop: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  copyRowBtnText:    { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.charcoal, letterSpacing: 0.5 },
  linkedEvidence:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.warmWhite, padding: 14, marginTop: 16, marginBottom: 12, borderRadius: RADIUS.sm },
  linkedText:        { fontFamily: FONT.semibold, fontSize: 13, color: COLORS.charcoal },
  linkedClose:       { fontFamily: FONT.regular, fontSize: 16, color: COLORS.taupe },
  detectedLang:      { fontFamily: FONT.regular, fontSize: 11, color: COLORS.taupe, marginTop: 3 },
  transcriptBox:     { backgroundColor: COLORS.warmWhite, padding: 20, borderRadius: RADIUS.sm, marginTop: 4 },
  transcriptFullText:{ fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 26 },
  errorCard:         { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  errorTitle:        { fontFamily: FONT.bold, fontSize: 17, color: COLORS.charcoal, marginBottom: 8 },
  errorBody:         { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  retryBtn:          { borderWidth: 1.5, borderColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText:      { fontFamily: FONT.bold, fontSize: 12, color: COLORS.accent, letterSpacing: 1 },
  // Footer
  footer:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, paddingBottom: Platform.OS === 'android' ? 18 : 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  footerBtn:         { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  footerBtnIcon:     { fontSize: 18 },
  footerBtnLabel:    { fontFamily: FONT.semibold, fontSize: 9, color: COLORS.charcoal, letterSpacing: 0.5 },
  sendBtn:           { backgroundColor: COLORS.black, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24 },
  sendBtnText:       { fontFamily: FONT.bold, fontSize: 12, color: COLORS.white, letterSpacing: 0.5 },
  // Toast
  toast:             { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  toastText:         { fontFamily: FONT.semibold, fontSize: 13, color: COLORS.white },
  // Share sheet
  shareSheet:        { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, position: 'absolute', bottom: 0, left: 0, right: 0 },
  shareSheetHandle:  { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  shareSheetTitle:   { fontFamily: FONT.bold, fontSize: 17, color: COLORS.black, marginBottom: 16 },
  shareOption:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  shareOptionIcon:   { fontSize: 24, width: 36, textAlign: 'center' },
  shareOptionLabel:  { fontFamily: FONT.semibold, fontSize: 15, color: COLORS.black },
  shareOptionDesc:   { fontFamily: FONT.regular, fontSize: 12, color: COLORS.taupe, marginTop: 2 },
  // Modals
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(20,19,18,0.5)', justifyContent: 'center' },
  modalCard:         { backgroundColor: COLORS.white, margin: 24, padding: 28, borderRadius: RADIUS.sm },
  modalEyebrow:      { fontFamily: FONT.semibold, fontSize: 10, color: COLORS.accent, letterSpacing: 2, marginBottom: 10 },
  modalTitle:        { fontFamily: FONT.bold, fontSize: 20, color: COLORS.charcoal, marginBottom: 8 },
  modalBody:         { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe, lineHeight: 22, marginBottom: 24 },
  modalBtns:         { flexDirection: 'row', gap: 12 },
  modalCancel:       { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: 'center' },
  modalCancelText:   { fontFamily: FONT.semibold, fontSize: 13, color: COLORS.taupe, letterSpacing: 1 },
  modalApprove:      { flex: 1, backgroundColor: COLORS.accent, paddingVertical: 14, alignItems: 'center' },
  modalApproveText:  { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1 },
  // Info cards (chief complaint, follow-up, Rx)
  infoCard:          { backgroundColor: COLORS.warmWhite, padding: 16, borderRadius: RADIUS.sm, marginTop: 14 },
  infoCardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoCardLabel:     { fontFamily: FONT.bold, fontSize: 10, color: COLORS.taupe, letterSpacing: 1.5 },
  infoCardBody:      { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 22 },
  infoCardAction:    { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.accent },
  infoCardMuted:     { fontFamily: FONT.regular, fontSize: 13, color: COLORS.taupe, fontStyle: 'italic' },
  followUpRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  followUpIcon:      { fontSize: 18 },
  followUpDateText:  { fontFamily: FONT.semibold, fontSize: 16, color: COLORS.charcoal, flex: 1 },
  followUpClear:     { fontFamily: FONT.bold, fontSize: 16, color: COLORS.taupe, paddingHorizontal: 6 },
  followUpInput:     { borderWidth: 1, borderColor: COLORS.border, padding: 14, fontSize: 16, fontFamily: FONT.regular, color: COLORS.black, borderRadius: RADIUS.sm, marginBottom: 12 },
  followUpQuick:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  followUpChip:      { borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  followUpChipText:  { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.accent },
  rxInput:           { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 24, borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: RADIUS.sm, padding: 12, minHeight: 80, backgroundColor: '#FFFDF7' },
  rxBody:            { fontFamily: FONT.regular, fontSize: 15, color: COLORS.black, lineHeight: 24 },
  agentCard:         { backgroundColor: '#F4F7F5', borderWidth: 1, borderColor: '#D4E2DA', borderRadius: RADIUS.sm, padding: 16, marginTop: 14 },
  agentCardTitle:    { fontFamily: FONT.bold, fontSize: 10, color: COLORS.accent, letterSpacing: 1.2, marginBottom: 8 },
  agentCardBody:     { fontFamily: FONT.regular, fontSize: 14, color: COLORS.charcoal, lineHeight: 21 },
  agentCardFootnote: { fontFamily: FONT.regular, fontSize: 11, color: COLORS.taupe, lineHeight: 16, marginTop: 8 },
});
