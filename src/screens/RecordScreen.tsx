import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useRecorder } from '../hooks/useRecorder';
import { transcribeAudio } from '../services/transcriptionService';
import { formatDuration } from '../services/storageService';
import { uploadEntryToDrive, refreshAccessToken } from '../services/driveService';
import { JournalEntry, RootStackParamList } from '../types';
import Waveform from '../components/Waveform';
import RecordButton from '../components/RecordButton';
import MicSelector from '../components/MicSelector';
import { colors, radius, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Record'>;

export default function RecordScreen() {
  const navigation = useNavigation<Nav>();
  const { addEntry, updateEntry, settings } = useApp();
  const recorder = useRecorder();
  const [showMicSelector, setShowMicSelector] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const entryIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  // Auto-start recording on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    recorder.refreshInputs().then(() => recorder.startRecording()).catch(err => {
      Alert.alert('Could not start recording', err.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecordButtonPress = useCallback(async () => {
    if (recorder.status === 'recording') {
      await recorder.pauseRecording();
    } else if (recorder.status === 'paused') {
      await recorder.resumeRecording();
    }
  }, [recorder]);

  const handleStop = useCallback(async () => {
    try {
      const audioUri = await recorder.stopRecording();
      if (!audioUri) { navigation.goBack(); return; }

      const now = new Date().toISOString();
      const durationMs = recorder.durationMs;
      const entryId = `entry_${Date.now()}`;
      entryIdRef.current = entryId;

      const entry: JournalEntry = {
        id: entryId,
        title: `Entry — ${new Date(now).toLocaleDateString()}`,
        date: now,
        durationMs,
        audioUri,
        transcript: '',
        isTranscribing: Boolean(settings.openAIApiKey),
      };

      await addEntry(entry);
      setTranscribing(true);
      setTranscribeError('');

      // Navigate to entry immediately so user isn't blocked
      navigation.replace('Entry', { entryId });

      // Transcribe in background
      if (settings.openAIApiKey) {
        try {
          const transcript = await transcribeAudio(audioUri, settings.openAIApiKey);
          await updateEntry(entryId, { transcript, isTranscribing: false });

          // Auto-upload to Drive if enabled
          if (settings.autoUploadToDrive && settings.googleAccessToken) {
            const accessToken = await getValidAccessToken(settings);
            if (accessToken) {
              const { audioFileId, transcriptFileId } = await uploadEntryToDrive(
                accessToken, now, audioUri, transcript
              );
              await updateEntry(entryId, { driveAudioFileId: audioFileId, driveTranscriptFileId: transcriptFileId });
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          await updateEntry(entryId, { isTranscribing: false });
          setTranscribeError(msg);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Recording failed';
      Alert.alert('Error', msg);
    }
  }, [recorder, addEntry, updateEntry, settings, navigation]);

  const handleCancel = useCallback(() => {
    Alert.alert('Discard recording?', 'This recording will be lost.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await recorder.stopRecording().catch(() => {});
          navigation.goBack();
        },
      },
    ]);
  }, [recorder, navigation]);

  const isProcessing = recorder.status === 'processing' || transcribing;

  const statusLabel =
    recorder.status === 'recording' ? 'Recording…' :
    recorder.status === 'paused' ? 'Paused' :
    recorder.status === 'processing' ? 'Saving…' :
    'Starting…';

  const statusColor =
    recorder.status === 'recording' ? colors.recording :
    recorder.status === 'paused' ? colors.paused :
    colors.textSecondary;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleCancel}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.statusBadge}>
          {recorder.status === 'recording' && (
            <View style={styles.recordingDot} />
          )}
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowMicSelector(true)}
          disabled={isProcessing}
        >
          <Ionicons name="options-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Center: Waveform + Duration */}
      <View style={styles.center}>
        <Waveform
          audioLevel={recorder.audioLevel}
          isActive={recorder.status === 'recording'}
          color={
            recorder.status === 'paused' ? colors.paused :
            recorder.status === 'recording' ? colors.primary :
            colors.textMuted
          }
        />

        <Text style={styles.duration}>
          {formatDuration(recorder.durationMs)}
        </Text>

        {transcribeError ? (
          <Text style={styles.errorText}>{transcribeError}</Text>
        ) : null}
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {isProcessing ? (
          <View style={styles.processingArea}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.processingLabel}>
              {recorder.status === 'processing' ? 'Saving audio…' : 'Transcribing…'}
            </Text>
          </View>
        ) : (
          <>
            {/* Pause / Resume button (large central) */}
            <RecordButton
              status={recorder.status}
              onPress={handleRecordButtonPress}
              size={88}
            />

            {/* Stop button */}
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={handleStop}
              disabled={recorder.status === 'idle'}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <MicSelector
        visible={showMicSelector}
        onClose={() => setShowMicSelector(false)}
        inputs={recorder.availableInputs}
        selectedUid={recorder.selectedInputUid}
        onSelect={input => recorder.selectInput(input.uid)}
      />
    </SafeAreaView>
  );
}

async function getValidAccessToken(settings: {
  googleAccessToken: string;
  googleRefreshToken: string;
  googleTokenExpiry: number;
}): Promise<string | null> {
  if (!settings.googleAccessToken) return null;
  if (Date.now() < settings.googleTokenExpiry - 60_000) return settings.googleAccessToken;
  if (!settings.googleRefreshToken) return null;
  try {
    const { accessToken } = await refreshAccessToken(settings.googleRefreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.recording,
  },
  statusLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  duration: {
    ...typography.h1,
    fontSize: 48,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.lg,
    letterSpacing: 2,
  },
  errorText: {
    ...typography.small,
    color: colors.recording,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  controls: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  processingArea: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  processingLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  stopBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.recording,
  },
});
