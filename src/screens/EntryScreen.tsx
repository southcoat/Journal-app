import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { useApp } from '../contexts/AppContext';
import { uploadEntryToDrive, refreshAccessToken } from '../services/driveService';
import { transcribeAudio } from '../services/transcriptionService';
import { formatDate, formatDuration, formatTime } from '../services/storageService';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Entry'>;
type Route = RouteProp<RootStackParamList, 'Entry'>;

export default function EntryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { entries, updateEntry, deleteEntry, settings } = useApp();

  const entry = entries.find(e => e.id === route.params.entryId) ?? route.params.newEntry;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (entry) {
      setDraftTranscript(entry.transcript);
      setDraftTitle(entry.title);
    }
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!entry) return;

    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: entry.audioUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaybackMs(status.positionMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackMs(0);
            soundRef.current?.setPositionAsync(0);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (err) {
      Alert.alert('Playback error', 'Could not play this recording.');
    }
  }, [entry, isPlaying]);

  const handleUploadToDrive = useCallback(async () => {
    if (!entry || !settings.googleAccessToken) {
      Alert.alert(
        'Not signed in',
        'Sign in with Google in Settings to upload entries to Drive.'
      );
      return;
    }

    setIsUploading(true);
    try {
      let accessToken = settings.googleAccessToken;
      if (Date.now() >= settings.googleTokenExpiry - 60_000 && settings.googleRefreshToken) {
        const { accessToken: newToken } = await refreshAccessToken(settings.googleRefreshToken);
        accessToken = newToken;
      }

      const { audioFileId, transcriptFileId } = await uploadEntryToDrive(
        accessToken,
        entry.date,
        entry.audioUri,
        entry.transcript
      );
      await updateEntry(entry.id, { driveAudioFileId: audioFileId, driveTranscriptFileId: transcriptFileId });
      Alert.alert('Uploaded', 'Entry saved to Google Drive / Journal App folder.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload failed', msg);
    } finally {
      setIsUploading(false);
    }
  }, [entry, settings, updateEntry]);

  const handleShare = useCallback(async () => {
    if (!entry) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing not available on this device.');
      return;
    }
    await Sharing.shareAsync(entry.audioUri, { mimeType: 'audio/mp4', UTI: 'public.audio' });
  }, [entry]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete entry?', 'This will permanently delete the recording and transcript.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await soundRef.current?.unloadAsync().catch(() => {});
          if (entry) await deleteEntry(entry.id);
          navigation.goBack();
        },
      },
    ]);
  }, [entry, deleteEntry, navigation]);

  const handleSaveTranscript = useCallback(async () => {
    if (!entry) return;
    await updateEntry(entry.id, { transcript: draftTranscript });
    setEditingTranscript(false);
  }, [entry, draftTranscript, updateEntry]);

  const handleSaveTitle = useCallback(async () => {
    if (!entry) return;
    const trimmed = draftTitle.trim();
    if (trimmed) await updateEntry(entry.id, { title: trimmed });
    setEditingTitle(false);
  }, [entry, draftTitle, updateEntry]);

  const handleRetranscribe = useCallback(async () => {
    if (!entry || !settings.geminiApiKey) return;
    setIsRetranscribing(true);
    await updateEntry(entry.id, { isTranscribing: true });
    try {
      const transcript = await transcribeAudio(entry.audioUri, settings.geminiApiKey);
      await updateEntry(entry.id, { transcript, isTranscribing: false });
    } catch (err) {
      await updateEntry(entry.id, { isTranscribing: false });
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Transcription failed', msg);
    } finally {
      setIsRetranscribing(false);
    }
  }, [entry, settings.geminiApiKey, updateEntry]);

  if (!entry) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={typography.body}>Entry not found.</Text>
      </SafeAreaView>
    );
  }

  const playbackProgress = entry.durationMs > 0 ? playbackMs / entry.durationMs : 0;

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
        <View style={styles.headerMeta}>
          <Text style={styles.headerDate}>{formatDate(entry.date)}</Text>
          <Text style={styles.headerTime}>{formatTime(entry.date)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.recording} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.titleRow}>
          {editingTitle ? (
            <>
              <TextInput
                style={styles.titleInput}
                value={draftTitle}
                onChangeText={setDraftTitle}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveTitle}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={handleSaveTitle} style={styles.titleSaveBtn}>
                <Text style={styles.titleSaveText}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.titlePressable} onPress={() => setEditingTitle(true)} activeOpacity={0.7}>
              <Text style={styles.titleText} numberOfLines={2}>{entry.title}</Text>
              <Ionicons name="pencil-outline" size={16} color={colors.textMuted} style={styles.titleEditIcon} />
            </TouchableOpacity>
          )}
        </View>

        {/* Audio Player */}
        <View style={styles.playerCard}>
          <View style={styles.playerTop}>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={colors.white}
              />
            </TouchableOpacity>
            <View style={styles.playerInfo}>
              <Text style={styles.playerLabel}>Audio Recording</Text>
              <Text style={styles.playerDuration}>{formatDuration(entry.durationMs)}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${playbackProgress * 100}%` }]} />
          </View>
          <View style={styles.progressTimes}>
            <Text style={styles.progressTime}>{formatDuration(playbackMs)}</Text>
            <Text style={styles.progressTime}>{formatDuration(entry.durationMs)}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isUploading && styles.actionBtnDisabled]}
            onPress={handleUploadToDrive}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <Ionicons
                name={entry.driveAudioFileId ? 'cloud-done-outline' : 'cloud-upload-outline'}
                size={20}
                color={entry.driveAudioFileId ? colors.success : colors.primary}
              />
            )}
            <Text style={[styles.actionLabel, entry.driveAudioFileId ? { color: colors.success } : null]}>
              {entry.driveAudioFileId ? 'In Drive' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transcript */}
        <View style={styles.transcriptSection}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.sectionTitle}>Transcript</Text>
            {!entry.isTranscribing && !isRetranscribing && entry.transcript ? (
              <TouchableOpacity
                onPress={() => editingTranscript ? handleSaveTranscript() : setEditingTranscript(true)}
              >
                <Text style={styles.editBtn}>{editingTranscript ? 'Save' : 'Edit'}</Text>
              </TouchableOpacity>
            ) : !entry.isTranscribing && !isRetranscribing && !entry.transcript && settings.geminiApiKey ? (
              <TouchableOpacity onPress={handleRetranscribe}>
                <Text style={styles.editBtn}>Transcribe</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {entry.isTranscribing || isRetranscribing ? (
            <View style={styles.transcribingRow}>
              <ActivityIndicator size="small" color={colors.paused} />
              <Text style={styles.transcribingLabel}>Transcribing audio…</Text>
            </View>
          ) : editingTranscript ? (
            <TextInput
              style={styles.transcriptEditor}
              value={draftTranscript}
              onChangeText={setDraftTranscript}
              multiline
              autoFocus
              placeholder="No transcript yet…"
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
            />
          ) : (
            <Text style={[styles.transcriptText, !entry.transcript && styles.transcriptEmpty]}>
              {entry.transcript || (
                settings.geminiApiKey
                  ? 'No transcript for this entry. Tap Transcribe to generate one.'
                  : 'No transcript available. Add a Google AI Studio API key in Settings to enable transcription.'
              )}
            </Text>
          )}
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
  headerMeta: {
    flex: 1,
    alignItems: 'center',
  },
  headerDate: {
    ...typography.body,
    fontWeight: '600',
  },
  headerTime: {
    ...typography.small,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 40,
  },
  titlePressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleText: {
    ...typography.h3,
    flex: 1,
  },
  titleEditIcon: {
    marginLeft: spacing.xs,
  },
  titleInput: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleSaveBtn: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  titleSaveText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.white,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  playerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  playerInfo: {
    flex: 1,
  },
  playerLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  playerDuration: {
    ...typography.caption,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressTime: {
    ...typography.small,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  transcriptSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  editBtn: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  transcribingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  transcribingLabel: {
    ...typography.caption,
    color: colors.paused,
  },
  transcriptText: {
    ...typography.body,
    lineHeight: 26,
    color: colors.text,
  },
  transcriptEmpty: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  transcriptEditor: {
    ...typography.body,
    lineHeight: 26,
    color: colors.text,
    minHeight: 200,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
