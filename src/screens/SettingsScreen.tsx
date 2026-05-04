import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useApp } from '../contexts/AppContext';
import { GOOGLE_CONFIG, clearDriveFolderCache } from '../services/driveService';
import { AudioFormat } from '../types';
import { colors, radius, spacing, typography } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const AUDIO_FORMATS: { value: AudioFormat; label: string; detail: string }[] = [
  { value: 'compact',  label: 'Compact (M4A)',      detail: '~0.5 MB/min — best for storage' },
  { value: 'standard', label: 'Standard (M4A HQ)',  detail: '~1 MB/min — balanced quality' },
  { value: 'archive',  label: 'Lossless (WAV)',      detail: '~10 MB/min — maximum quality' },
];

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings } = useApp();
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const hasUnsavedKey = apiKeyDraft !== settings.geminiApiKey;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CONFIG.webClientId,
    redirectUri: GOOGLE_CONFIG.redirectUri,
    scopes: [...GOOGLE_CONFIG.scopes, 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const auth = response.authentication;
      if (auth?.accessToken) {
        const expiry = Date.now() + (auth.expiresIn ?? 3600) * 1000;
        // Fetch user profile
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        })
          .then(r => r.json())
          .then((profile: { name?: string; email?: string }) => {
            updateSettings({
              googleAccessToken: auth.accessToken,
              googleRefreshToken: auth.refreshToken ?? settings.googleRefreshToken,
              googleTokenExpiry: expiry,
              googleUserName: profile.name ?? '',
              googleUserEmail: profile.email ?? '',
            });
          })
          .catch(() => {
            updateSettings({
              googleAccessToken: auth.accessToken,
              googleRefreshToken: auth.refreshToken ?? settings.googleRefreshToken,
              googleTokenExpiry: expiry,
            });
          });
        Alert.alert('Signed in', 'Your journal entries can now be uploaded to Google Drive.');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Sign-in failed', response.error?.message ?? 'Unknown error');
    }
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveApiKey = useCallback(async () => {
    await updateSettings({ geminiApiKey: apiKeyDraft.trim() });
    Alert.alert('Saved', 'Google AI Studio API key updated.');
  }, [apiKeyDraft, updateSettings]);

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign out of Google?', 'Entries already uploaded will remain in Drive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await updateSettings({
            googleAccessToken: '',
            googleRefreshToken: '',
            googleTokenExpiry: 0,
            googleUserName: '',
            googleUserEmail: '',
          });
          await clearDriveFolderCache();
        },
      },
    ]);
  }, [updateSettings]);

  const isSignedIn = Boolean(settings.googleAccessToken);
  const userInitial = settings.googleUserName?.[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Account ──────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          {isSignedIn ? (
            <>
              <View style={styles.userRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userInitial}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{settings.googleUserName || 'Google User'}</Text>
                  <Text style={styles.userEmail}>{settings.googleUserEmail}</Text>
                </View>
                <Ionicons name="cloud-done" size={20} color={colors.success} />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Text style={styles.toggleLabel}>Auto-upload after recording</Text>
                  <Text style={styles.toggleHint}>Saves audio + transcript to Drive</Text>
                </View>
                <Switch
                  value={settings.autoUploadToDrive}
                  onValueChange={val => updateSettings({ autoUploadToDrive: val })}
                  trackColor={{ true: colors.primary, false: colors.surfaceBorder }}
                  thumbColor={colors.white}
                />
              </View>
              <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={18} color={colors.recording} />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Google Account</Text>
              <Text style={styles.hint}>
                Sign in to back up recordings and transcripts to Google Drive and keep your journal tied to your account.
              </Text>
              <TouchableOpacity
                style={[styles.signInBtn, !request && styles.btnDisabled]}
                onPress={() => promptAsync()}
                disabled={!request}
              >
                <Ionicons name="logo-google" size={18} color={colors.white} />
                <Text style={styles.signInText}>Sign in with Google</Text>
              </TouchableOpacity>
              {GOOGLE_CONFIG.webClientId.startsWith('YOUR_') && (
                <View style={styles.warning}>
                  <Ionicons name="warning-outline" size={14} color={colors.paused} />
                  <Text style={styles.warningText}>Google OAuth not configured — see SETUP.md</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Transcription ─────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Transcription &amp; Reflections</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Google AI Studio API Key</Text>
          <Text style={styles.hint}>Powers audio transcription (Gemini 2.0 Flash) and reflection prompts (Gemini 1.5 Pro). Get a free key at aistudio.google.com</Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKeyDraft}
              onChangeText={setApiKeyDraft}
              placeholder="AIza…"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!apiKeyVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setApiKeyVisible(v => !v)}>
              <Ionicons name={apiKeyVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {hasUnsavedKey ? (
            <TouchableOpacity style={styles.saveKeyBtn} onPress={saveApiKey}>
              <Text style={styles.saveKeyText}>Save Key</Text>
            </TouchableOpacity>
          ) : settings.geminiApiKey ? (
            <View style={styles.keySet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.keySetText}>API key is set — transcription &amp; reflections enabled</Text>
            </View>
          ) : (
            <View style={styles.keySet}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.keySetText, { color: colors.textMuted }]}>No key — transcription disabled</Text>
            </View>
          )}
        </View>

        {/* ── Recording Format ──────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Recording Format</Text>
        <View style={styles.card}>
          <Text style={[styles.hint, { marginBottom: spacing.md }]}>
            Higher quality means larger files. Compact M4A works best with Gemini transcription.
          </Text>
          {AUDIO_FORMATS.map(fmt => {
            const selected = settings.audioFormat === fmt.value;
            return (
              <TouchableOpacity
                key={fmt.value}
                style={[styles.formatRow, selected && styles.formatRowSelected]}
                onPress={() => updateSettings({ audioFormat: fmt.value })}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.formatText}>
                  <Text style={[styles.formatLabel, selected && { color: colors.text }]}>{fmt.label}</Text>
                  <Text style={styles.formatDetail}>{fmt.detail}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── About ─────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.card}>
          {[['Version', '1.0.0'], ['Platform', 'Expo SDK 52']].map(([k, v], i, arr) => (
            <View key={k} style={[styles.aboutRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.aboutLabel}>{k}</Text>
              <Text style={styles.aboutValue}>{v}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: { ...typography.small, textTransform: 'uppercase', letterSpacing: 1, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  label: { ...typography.body, fontWeight: '600', marginBottom: spacing.xs },
  hint: { ...typography.small, lineHeight: 18, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: spacing.md },
  // User profile
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h3, color: colors.white },
  userInfo: { flex: 1 },
  userName: { ...typography.body, fontWeight: '600' },
  userEmail: { ...typography.small, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flex: 1, marginRight: spacing.md },
  toggleLabel: { ...typography.body, fontWeight: '500' },
  toggleHint: { ...typography.small, marginTop: 2 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.recordingFaded, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md },
  signOutText: { ...typography.body, fontWeight: '600', color: colors.recording },
  signInBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md },
  btnDisabled: { opacity: 0.5 },
  signInText: { ...typography.body, fontWeight: '600', color: colors.white },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.pausedFaded, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  warningText: { ...typography.small, color: colors.paused, flex: 1 },
  // API key
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant, borderRadius: radius.md, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: spacing.sm },
  apiKeyInput: { flex: 1, ...typography.mono, fontSize: 14, padding: spacing.md, color: colors.text },
  eyeBtn: { padding: spacing.md },
  saveKeyBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  saveKeyText: { ...typography.body, fontWeight: '600', color: colors.white },
  keySet: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  keySetText: { ...typography.small, color: colors.success },
  // Audio format
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceVariant },
  formatRowSelected: { backgroundColor: colors.primaryFaded, borderWidth: 1, borderColor: colors.primary },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  formatText: { flex: 1 },
  formatLabel: { ...typography.body, fontWeight: '500', color: colors.textSecondary },
  formatDetail: { ...typography.small, marginTop: 2 },
  // About
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  aboutLabel: { ...typography.body, color: colors.textSecondary },
  aboutValue: { ...typography.body },
});
