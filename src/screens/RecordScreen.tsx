import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useRecorder } from '../hooks/useRecorder';
import { transcribeAudio } from '../services/transcriptionService';
import { generateReflectionPrompts } from '../services/reflectionService';
import { formatDuration } from '../services/storageService';
import { uploadEntryToDrive, refreshAccessToken } from '../services/driveService';
import { JournalEntry, RootStackParamList } from '../types';
import Waveform from '../components/Waveform';
import RecordButton from '../components/RecordButton';
import MicSelector from '../components/MicSelector';
import ReflectionPrompts from '../components/ReflectionPrompts';
import { colors, radius, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Record'>;

export default function RecordScreen() {
  const navigation = useNavigation<Nav>();
  const { addEntry, updateEntry, settings, entries } = useApp();
  const recorder = useRecorder();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [showMicSelector, setShowMicSelector] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [reflectionPrompts, setReflectionPrompts] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    recorder.refreshInputs().then(() => recorder.startRecording()).catch(err => {
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
      Alert.alert('Could not start recording', msg, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    });

    generateReflectionPrompts(entries, settings.geminiApiKey)
      .then(prompts => setReflectionPrompts(prompts))
      .finally(() => setLoadingPrompts(false));
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

      const entry: JournalEntry = {
        id: entryId,
        title: `Entry — ${new Date(now).toLocaleDateString()}`,
        date: now,
        durationMs,
        audioUri,
        transcript: '',
        isTranscribing: Boolean(settings.geminiApiKey),
      };

      await addEntry(entry);
      navigation.replace('Entry', { entryId });

      if (settings.geminiApiKey) {
        try {
          const transcript = await transcribeAudio(audioUri, settings.geminiApiKey);
          await updateEntry(entryId, { transcript, isTranscribing: false });

          if (settings.autoUploadToDrive && settings.googleAccessToken) {
            const accessToken = await getValidAccessToken(settings);
            if (accessToken) {
              const { audioFileId, transcriptFileId } = await uploadEntryToDrive(
                accessToken, now, audioUri, transcript
              );
              await updateEntry(entryId, { driveAudioFileId: audioFileId, driveTranscriptFileId: transcriptFileId });
            }
          }
        } catch {
          await updateEntry(entryId, { isTranscribing: false });
        }
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Recording failed');
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
  const showPrompts = loadingPrompts || reflectionPrompts.length > 0;

  const statusLabel =
    recorder.status === 'recording' ? 'Recording…' :
    recorder.status === 'paused'    ? 'Paused'      :
    recorder.status === 'processing'? 'Saving…'     : 'Starting…';

  const statusColor =
    recorder.status === 'recording' ? colors.recording :
    recorder.status === 'paused'    ? colors.paused    : colors.textSecondary;

  const Controls = isProcessing ? (
    <View style={styles.processingArea}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.processingLabel}>
        {recorder.status === 'processing' ? 'Saving audio…' : 'Transcribing…'}
      </Text>
    </View>
  ) : (
    <>
      <RecordButton status={recorder.status} onPress={handleRecordButtonPress} size={88} />
      <TouchableOpacity
        style={styles.stopBtn}
        onPress={handleStop}
        disabled={recorder.status === 'idle'}
      >
        <View style={styles.stopIcon} />
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar — same in portrait and landscape */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleCancel} disabled={isProcessing}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.statusBadge}>
          {recorder.status === 'recording' && <View style={styles.recordingDot} />}
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMicSelector(true)} disabled={isProcessing}>
          <Ionicons name="options-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLandscape ? (
        // ── Landscape: side-by-side layout ──────────────────────────
        <View style={styles.bodyLandscape}>
          <ScrollView
            style={styles.leftPanelLandscape}
            contentContainerStyle={styles.leftPanelContentLandscape}
            showsVerticalScrollIndicator={false}
          >
            {showPrompts && (
              <ReflectionPrompts prompts={reflectionPrompts} isLoading={loadingPrompts} />
            )}
            <Waveform
              audioLevel={recorder.audioLevel}
              isActive={recorder.status === 'recording'}
              color={recorder.status === 'paused' ? colors.paused : colors.primary}
            />
            <Text style={[styles.duration, styles.durationLandscape]}>
              {formatDuration(recorder.durationMs)}
            </Text>
          </ScrollView>

          <View style={styles.rightPanelLandscape}>
            {Controls}
          </View>
        </View>
      ) : (
        // ── Portrait: vertical stack ─────────────────────────────────
        <>
          {showPrompts && (
            <ReflectionPrompts prompts={reflectionPrompts} isLoading={loadingPrompts} />
          )}
          <View style={styles.center}>
            <Waveform
              audioLevel={recorder.audioLevel}
              isActive={recorder.status === 'recording'}
              color={recorder.status === 'paused' ? colors.paused : colors.primary}
            />
            <Text style={styles.duration}>{formatDuration(recorder.durationMs)}</Text>
          </View>
          <View style={[styles.controls, Platform.OS === 'web' && styles.controlsWeb]}>
            {Controls}
          </View>
        </>
      )}

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

  // Portrait layout
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
  controls: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  controlsWeb: {
    paddingBottom: 80,
  },

  // Landscape layout
  bodyLandscape: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanelLandscape: {
    flex: 1,
  },
  leftPanelContentLandscape: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  durationLandscape: {
    fontSize: 32,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  rightPanelLandscape: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingRight: spacing.lg,
    paddingLeft: spacing.sm,
  },

  // Shared control elements
  processingArea: {
    alignItems: 'center',
    gap: spacing.md,
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
