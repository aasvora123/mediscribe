import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Modal, TextInput, Platform, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useApp, Session, SessionStatus } from '../context/AppContext';
import { COLORS, FONT, RADIUS, SHADOW } from '../theme';
import { AbridgeNoteSection } from '../services/groqService';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const STATUS_CONFIG: Record<SessionStatus, { bg: string; text: string; label: string }> = {
  Approved: { bg: COLORS.greenBg,  text: COLORS.green,  label: 'APPROVED' },
  Draft:    { bg: COLORS.amberBg,  text: COLORS.amber,  label: 'DRAFT' },
  Upcoming: { bg: COLORS.warmWhite,text: COLORS.taupe,  label: 'UPCOMING' },
  Recording:{ bg: '#FDECEA',       text: COLORS.accent, label: 'LIVE' },
};

export default function HomeScreen({ navigation }: { navigation: HomeScreenNavigationProp }) {
  const { sessions, doctor, logout, approveSession, assignTimeslot, deleteSession } = useApp();
  const doctorName = doctor?.name ?? 'Doctor';
  const specialty  = doctor?.specialty ?? '';
  const initials   = doctor?.initials ?? 'DR';

  const [timeslotModal, setTimeslotModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeslotInput, setTimeslotInput] = useState('');
  const [signOutModal, setSignOutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const approved    = sessions.filter(s => s.status === 'Approved').length;
  const drafts      = sessions.filter(s => s.status === 'Draft').length;
  const totalToday  = sessions.length;

  // ── Filter sessions by search ─────────────────────────────────────────────
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s =>
        s.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.patientNumber && String(s.patientNumber).includes(searchQuery))
      )
    : sessions;

  const handleSessionPress = (s: Session) => {
    if (s.status === 'Upcoming') navigation.navigate('NewPatient', { prefillName: s.patientName, prefillDob: s.dob, sessionId: s.id });
    else navigation.navigate('Summary', { patientName: s.patientName, dob: s.dob, sessionId: s.id });
  };

  const openTimeslot = (id: string, time: string) => { setSelectedId(id); setTimeslotInput(time || ''); setTimeslotModal(true); };
  const saveTimeslot = () => {
    if (selectedId && timeslotInput.trim()) { assignTimeslot(selectedId, timeslotInput.trim()); setTimeslotModal(false); }
    else setTimeslotInput('');
  };

  const handleDelete = (s: Session) => {
    Alert.alert(
      'Delete Session',
      `Remove "${s.patientName}" from the worklist? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(s.id) },
      ]
    );
  };

  // ── Get SOAP preview snippet for a session ──────────────────────────────
  const getSoapPreview = (s: Session): string | null => {
    if (!s.soap) return null;
    const sections = s.soap as AbridgeNoteSection[];
    const hpi = sections.find(sec => sec.title?.toLowerCase().includes('history'));
    if (hpi?.body) return hpi.body.slice(0, 80) + (hpi.body.length > 80 ? '...' : '');
    const first = sections[0];
    if (first?.body) return first.body.slice(0, 80) + (first.body.length > 80 ? '...' : '');
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}><Text style={styles.logoLetter}>M</Text></View>
          <Text style={styles.brandName}>MEDISCRIBE</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.searchToggle} onPress={() => setShowSearch(!showSearch)}>
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => setSignOutModal(true)}
          >
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Patient ID or Name..."
            placeholderTextColor={COLORS.taupe}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.divider} />

      {/* Doctor info */}
      <View style={styles.doctorSection}>
        <Text style={styles.doctorName}>{doctorName}</Text>
        <Text style={styles.doctorSpecialty}>{specialty} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View>

      {/* KPI strip */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiValue}>{totalToday}</Text>
          <Text style={styles.kpiLabel}>TOTAL</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiValue}>{approved}</Text>
          <Text style={styles.kpiLabel}>APPROVED</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, drafts > 0 ? { color: COLORS.accent } : {}]}>{drafts}</Text>
          <Text style={styles.kpiLabel}>PENDING</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiValue}>{Math.round(totalToday * 24.5)}m</Text>
          <Text style={styles.kpiLabel}>SAVED</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Worklist header */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderLabel}>
          {searchQuery ? `RESULTS (${filteredSessions.length})` : "TODAY'S WORKLIST"}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewPatient', {})}>
          <Text style={styles.addBtnText}>+ NEW SESSION</Text>
        </TouchableOpacity>
      </View>

      {/* Patient Cards */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredSessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '📋'}</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching patients' : 'No sessions yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {searchQuery ? 'Try a different Patient ID or Name.' : 'Tap "+ NEW SESSION" to begin your first consultation.'}
            </Text>
          </View>
        )}
        {filteredSessions.map(s => {
          const cfg = STATUS_CONFIG[s.status];
          const soapPreview = getSoapPreview(s);
          return (
            <TouchableOpacity key={s.id} style={styles.card} onPress={() => handleSessionPress(s)} onLongPress={() => handleDelete(s)}>
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
                <View style={styles.cardTopRight}>
                  {s.status === 'Upcoming'
                    ? <TouchableOpacity onPress={() => openTimeslot(s.id, s.time)}>
                        <Text style={styles.timeslotBtn}>{s.time ? `🕐 ${s.time}  ✎` : '+ Assign Time'}</Text>
                      </TouchableOpacity>
                    : s.time ? <Text style={styles.timeText}>{s.time}</Text> : null
                  }
                  {/* Delete button */}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(s)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.patientNameRow}>
                <Text style={styles.patientName}>{s.patientName}</Text>
                {s.patientNumber && (
                  <View style={styles.pidBadge}>
                    <Text style={styles.pidText}>PID: {s.patientNumber}</Text>
                  </View>
                )}
              </View>

              {/* Chief complaint if any */}
              {s.chiefComplaint ? (
                <Text style={styles.chiefComplaintText}>CC: {s.chiefComplaint}</Text>
              ) : null}

              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>DOB: {s.dob}</Text>
                {s.duration !== '--:--' && <Text style={styles.metaText}>{s.duration} min</Text>}
              </View>

              {/* Follow-up badge */}
              {s.followUpDate && (
                <View style={styles.followUpBadge}>
                  <Text style={styles.followUpText}>📅 Follow-up: {s.followUpDate}</Text>
                </View>
              )}

              {/* SOAP preview snippet */}
              {soapPreview && (
                <Text style={styles.soapPreview} numberOfLines={2}>{soapPreview}</Text>
              )}

              {s.status === 'Draft' && (
                <TouchableOpacity style={styles.approveBtn} onPress={() => approveSession(s.id)}>
                  <Text style={styles.approveBtnText}>APPROVE DRAFT →</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal visible={signOutModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={styles.modalCardCenter}>
            <Text style={styles.modalEyebrow}>CONFIRM</Text>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>You are signed in as {doctorName}. Any unsaved session data will remain in the worklist.</Text>
            <View style={[styles.modalBtns, { marginTop: 24 }]}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSignOutModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSignOut} onPress={async () => { setSignOutModal(false); await logout(); }}>
                <Text style={styles.modalSignOutText}>SIGN OUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Timeslot Modal */}
      <Modal visible={timeslotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>ASSIGN TIMESLOT</Text>
            <Text style={styles.modalTitle}>Enter appointment time</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. 3:30 PM" placeholderTextColor={COLORS.border} value={timeslotInput} onChangeText={setTimeslotInput} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTimeslotModal(false)}><Text style={styles.modalCancelText}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveTimeslot}><Text style={styles.modalSaveText}>SAVE</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.lightGray },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 36 : 16, paddingBottom: 16, backgroundColor: COLORS.white },
  brandRow:       { flexDirection: 'row', alignItems: 'center' },
  logoMark:       { width: 26, height: 26, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  logoLetter:     { fontFamily: FONT.extrabold, color: COLORS.white, fontSize: 16 },
  brandName:      { fontFamily: FONT.extrabold, fontSize: 14, color: COLORS.charcoal, letterSpacing: 3 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchToggle:   { padding: 6 },
  searchIcon:     { fontSize: 18 },
  signOutBtn:     { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.sm },
  signOutText:    { fontFamily: FONT.semibold, fontSize: 11, color: COLORS.taupe, letterSpacing: 1 },
  avatar:         { width: 36, height: 36, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', borderRadius: 2 },
  avatarText:     { fontFamily: FONT.bold, color: COLORS.white, fontSize: 13 },
  // Search bar
  searchBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput:    { flex: 1, fontFamily: FONT.regular, fontSize: 14, color: COLORS.black, backgroundColor: COLORS.lightGray, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  searchClear:    { fontFamily: FONT.bold, fontSize: 16, color: COLORS.taupe, paddingLeft: 10 },
  divider:        { height: 1, backgroundColor: COLORS.border },
  doctorSection:  { backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 18 },
  doctorName:     { fontFamily: FONT.bold, fontSize: 22, color: COLORS.charcoal, marginBottom: 4, letterSpacing: -0.25 },
  doctorSpecialty:{ fontFamily: FONT.regular, fontSize: 13, color: COLORS.taupe },
  kpiStrip:       { flexDirection: 'row', backgroundColor: COLORS.white, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  kpiItem:        { flex: 1, alignItems: 'center' },
  kpiValue:       { fontFamily: FONT.extrabold, fontSize: 20, color: COLORS.charcoal },
  kpiLabel:       { fontFamily: FONT.semibold, fontSize: 9, color: COLORS.taupe, letterSpacing: 1, marginTop: 4 },
  kpiDivider:     { width: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  listHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.white },
  listHeaderLabel:{ fontFamily: FONT.semibold, fontSize: 10, color: COLORS.taupe, letterSpacing: 1.5 },
  addBtn:         { borderWidth: 1.5, borderColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.sm },
  addBtnText:     { fontFamily: FONT.bold, fontSize: 11, color: COLORS.accent, letterSpacing: 0.5 },
  list:           { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  // Empty state
  emptyState:     { alignItems: 'center', paddingVertical: 48 },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyTitle:     { fontFamily: FONT.bold, fontSize: 18, color: COLORS.charcoal, marginBottom: 8 },
  emptyBody:      { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24 },
  // Card
  card:           { backgroundColor: COLORS.white, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, ...SHADOW.card },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTopRight:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText:     { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.8 },
  timeslotBtn:    { fontFamily: FONT.semibold, fontSize: 12, color: COLORS.accent },
  timeText:       { fontFamily: FONT.regular, fontSize: 12, color: COLORS.taupe },
  deleteBtn:      { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:  { fontFamily: FONT.bold, fontSize: 12, color: COLORS.taupe },
  patientNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  patientName:    { fontFamily: FONT.bold, fontSize: 20, color: COLORS.charcoal, letterSpacing: -0.25 },
  pidBadge:       { backgroundColor: COLORS.lightGray, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pidText:        { fontFamily: FONT.medium, fontSize: 10, color: COLORS.taupe, letterSpacing: 0.5 },
  chiefComplaintText: { fontFamily: FONT.regular, fontSize: 13, color: COLORS.accent, marginBottom: 6, fontStyle: 'italic' },
  cardMeta:       { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:       { fontFamily: FONT.regular, fontSize: 13, color: COLORS.taupe },
  followUpBadge:  { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, marginTop: 8, alignSelf: 'flex-start' },
  followUpText:   { fontFamily: FONT.semibold, fontSize: 11, color: '#1565C0' },
  soapPreview:    { fontFamily: FONT.regular, fontSize: 12, color: COLORS.taupe, marginTop: 10, lineHeight: 18, borderLeftWidth: 3, borderLeftColor: COLORS.border, paddingLeft: 10 },
  approveBtn:     { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 14 },
  approveBtnText: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.accent, letterSpacing: 0.5 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(20,19,18,0.6)', justifyContent: 'flex-end' },
  modalCardCenter:{ backgroundColor: COLORS.white, padding: 28, margin: 24, borderRadius: RADIUS.sm },
  modalCard:      { backgroundColor: COLORS.white, padding: 28, paddingBottom: 48 },
  modalEyebrow:   { fontFamily: FONT.semibold, fontSize: 10, color: COLORS.accent, letterSpacing: 2, marginBottom: 10 },
  modalTitle:     { fontFamily: FONT.bold, fontSize: 22, color: COLORS.charcoal, marginBottom: 10, letterSpacing: -0.25 },
  modalBody:      { fontFamily: FONT.regular, fontSize: 14, color: COLORS.taupe, lineHeight: 22 },
  modalInput:     { borderWidth: 1, borderColor: COLORS.border, padding: 15, fontSize: 16, fontFamily: FONT.regular, color: COLORS.black, marginBottom: 24 },
  modalBtns:      { flexDirection: 'row', gap: 12 },
  modalCancel:    { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: 'center' },
  modalCancelText:{ fontFamily: FONT.semibold, fontSize: 13, color: COLORS.taupe, letterSpacing: 1 },
  modalSave:      { flex: 1, backgroundColor: COLORS.accent, paddingVertical: 14, alignItems: 'center' },
  modalSaveText:  { fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1 },
  modalSignOut:   { flex: 1, backgroundColor: COLORS.charcoal, paddingVertical: 14, alignItems: 'center' },
  modalSignOutText:{ fontFamily: FONT.bold, fontSize: 13, color: COLORS.white, letterSpacing: 1 },
});
