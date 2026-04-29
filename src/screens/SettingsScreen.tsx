import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useApp } from '../contexts/AppContext';
import { GOOGLE_CONFIG, clearDriveFolderCache } from '../services/driveService';
import { colors, radius, spacing, typography } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings } = useApp();
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.openAIApiKey);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const hasUnsavedKey = apiKeyDraft !== settings.openAIApiKey;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CONFIG.webClientId,
    iosClientId: GOOGLE_CONFIG.iosClientId,
    androidClientId: GOOGLE_CONFIG.androidClientId,
    scopes: GOOGLE_CONFIG.scopes,
  });

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const auth = response.authentication;
      if (auth?.accessToken) {
        const expiry = Date.now() + (auth.expiresIn ?? 3600) * 1000;
        updateSettings({
          googleAccessToken: auth.accessToken,
          googleRefreshToken: auth.refreshToken ?? settings.googleRefreshToken,
          googleTokenExpiry: expiry,
        });
        Alert.alert('Signed in', 'Your journal entries can now be uploaded to Google Drive.');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Sign-in failed', response.error?.message ?? 'Unknown error');
    }
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveApiKey = useCallback(async () => {
    await updateSettings({ openAIApiKey: apiKeyDraft.trim() });
    Alert.alert('Saved', 'OpenAI API key updated.');
  }, [apiKeyDraft, updateSettings]);

  const handleGoogleSignOut = useCallback(async () => {
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
          });
          await clearDriveFolderCache();
        },
      },
    ]);
  }, [updateSettings]);

  const isSignedIntoGoogle = Boolean(settings.googleAccessToken);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Transcription */}
        <Text style={styles.sectionHeader}>Transcription</Text>
        <View style={styles.card}>
          <Text style={styles.label}>OpenAI API Key</Text>
          <Text style={styles.hint}>
            Used to transcribe recordings via Whisper. Get a key at platform.openai.com.
          </Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKeyDraft}
              onChangeText={setApiKeyDraft}
              placeholder="sk-…"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!apiKeyVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setApiKeyVisible(v => !v)}
            >
              <Ionicons
                name={apiKeyVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {hasUnsavedKey && (
            <TouchableOpacity style={styles.saveKeyBtn} onPress={saveApiKey}>
              <Text style={styles.saveKeyBtnText}>Save Key</Text>
            </TouchableOpacity>
          )}
          {settings.openAIApiKey && !hasUnsavedKey && (
            <View style={styles.keySet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.keySetText}>API key is set</Text>
            </View>
          )}
        </View>

        {/* Google Drive */}
        <Text style={styles.sectionHeader}>Cloud Storage</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.label}>Google Drive</Text>
              <Text style={styles.hint}>
                Uploads audio + transcripts to a "Journal App" folder in your Drive.
              </Text>
            </View>
            {isSignedIntoGoogle ? (
              <Ionicons name="cloud-done" size={24} color={colors.success} />
            ) : (
              <Ionicons name="cloud-offline-outline" size={24} color={colors.textMuted} />
            )}
          </View>

          {isSignedIntoGoogle ? (
            <TouchableOpacity style={styles.signOutBtn} onPress={handleGoogleSignOut}>
              <Ionicons name="log-out-outline" size={18} color={colors.recording} />
              <Text style={styles.signOutBtnText}>Sign out of Google</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.signInBtn, !request && styles.signInBtnDisabled]}
              onPress={() => promptAsync()}
              disabled={!request}
            >
              <Ionicons name="logo-google" size={18} color={colors.white} />
              <Text style={styles.signInBtnText}>Sign in with Google</Text>
            </TouchableOpacity>
          )}

          {GOOGLE_CONFIG.webClientId.startsWith('YOUR_') && (
            <View style={styles.setupWarning}>
              <Ionicons name="warning-outline" size={16} color={colors.paused} />
              <Text style={styles.setupWarningText}>
                Google OAuth credentials not configured. See SETUP.md.
              </Text>
            </View>
          )}

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleLabel}>Auto-upload after recording</Text>
              <Text style={styles.toggleHint}>Requires Google sign-in</Text>
            </View>
            <Switch
              value={settings.autoUploadToDrive && isSignedIntoGoogle}
              onValueChange={val => updateSettings({ autoUploadToDrive: val })}
              trackColor={{ true: colors.primary, false: colors.surfaceBorder }}
              thumbColor={colors.white}
              disabled={!isSignedIntoGoogle}
            />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.aboutLabel}>Platform</Text>
            <Text style={styles.aboutValue}>Expo SDK 51</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.small,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.sm,
  },
  apiKeyInput: {
    flex: 1,
    ...typography.mono,
    fontSize: 14,
    padding: spacing.md,
    color: colors.text,
  },
  eyeBtn: {
    padding: spacing.md,
  },
  saveKeyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveKeyBtnText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
  keySet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  keySetText: {
    ...typography.small,
    color: colors.success,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  signInBtnDisabled: {
    opacity: 0.5,
  },
  signInBtnText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.recordingFaded,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  signOutBtnText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.recording,
  },
  setupWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.pausedFaded,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  setupWarningText: {
    ...typography.small,
    color: colors.paused,
    flex: 1,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  toggleLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  toggleHint: {
    ...typography.small,
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  aboutLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  aboutValue: {
    ...typography.body,
    color: colors.text,
  },
});
