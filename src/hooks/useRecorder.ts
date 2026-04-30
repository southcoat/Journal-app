import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { AudioFormat, AudioInput, RecordingStatus } from '../types';
import { persistAudioFile } from '../services/storageService';

function buildRecordingOptions(format: AudioFormat): Audio.RecordingOptions {
  if (format === 'archive') {
    return {
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 256000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.MAX,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 256000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/wav', bitsPerSecond: 256000 },
      isMeteringEnabled: true,
    };
  }
  const bitRate = format === 'standard' ? 128000 : 64000;
  return {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: { mimeType: 'audio/webm', bitsPerSecond: bitRate },
  isMeteringEnabled: true,
};

interface UseRecorderReturn {
  status: RecordingStatus;
  durationMs: number;
  audioLevel: number; // 0–1 normalized
  availableInputs: AudioInput[];
  selectedInputUid: string | null;
  startRecording: (format?: AudioFormat) => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // returns persisted audio URI
  selectInput: (uid: string) => Promise<void>;
  refreshInputs: () => Promise<void>;
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [availableInputs, setAvailableInputs] = useState<AudioInput[]>([]);
  const [selectedInputUid, setSelectedInputUid] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const refreshInputs = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      // Android Bluetooth is routed automatically by the OS when a device is connected.
      // We show a static "Built-in Mic" entry only.
      setAvailableInputs([{ uid: 'builtin', name: 'Built-in Microphone', type: 'BuiltInMic' }]);
      return;
    }
    try {
      const inputs = await Audio.getAvailableInputsAsync();
      const mapped: AudioInput[] = inputs.map(i => ({
        uid: i.uid,
        name: i.name,
        type: i.type as AudioInput['type'],
      }));
      setAvailableInputs(mapped);
      // Auto-select Bluetooth if available
      const bt = mapped.find(i => i.type === 'BluetoothHFP');
      if (bt && !selectedInputUid) {
        setSelectedInputUid(bt.uid);
      } else if (mapped.length > 0 && !selectedInputUid) {
        setSelectedInputUid(mapped[0].uid);
      }
    } catch {
      setAvailableInputs([{ uid: 'builtin', name: 'Built-in Microphone', type: 'BuiltInMic' }]);
    }
  }, [selectedInputUid]);

  const selectInput = useCallback(async (uid: string) => {
    setSelectedInputUid(uid);
    if (Platform.OS === 'ios') {
      try {
        await Audio.setInputNativeIDAsync(uid);
      } catch {
        // Input may not support native selection — ignore
      }
    }
  }, []);

  const startRecording = useCallback(async (format: AudioFormat = 'compact') => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied.');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    // Apply selected input on iOS
    if (Platform.OS === 'ios' && selectedInputUid) {
      try {
        await Audio.setInputNativeIDAsync(selectedInputUid);
      } catch {
        // ignore
      }
    }

    await refreshInputs();

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(buildRecordingOptions(format));

    recording.setOnRecordingStatusUpdate((s) => {
      if (s.isRecording) {
        setDurationMs(s.durationMillis);
        if (s.metering !== undefined) {
          // dBFS: typically -100 to 0. Map -80..0 → 0..1
          const normalized = Math.max(0, Math.min(1, (s.metering + 80) / 80));
          setAudioLevel(normalized);
        }
      }
    });
    recording.setProgressUpdateInterval(80);

    await recording.startAsync();
    recordingRef.current = recording;
    setStatus('recording');
    setDurationMs(0);
  }, [selectedInputUid, refreshInputs]);

  const pauseRecording = useCallback(async () => {
    if (!recordingRef.current || status !== 'recording') return;
    await recordingRef.current.pauseAsync();
    setStatus('paused');
    setAudioLevel(0);
  }, [status]);

  const resumeRecording = useCallback(async () => {
    if (!recordingRef.current || status !== 'paused') return;
    await recordingRef.current.startAsync();
    setStatus('recording');
  }, [status]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current || status === 'idle') return null;

    setStatus('processing');
    setAudioLevel(0);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const tempUri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!tempUri) return null;
      const persistedUri = await persistAudioFile(tempUri);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setStatus('idle');
      setDurationMs(0);
      return persistedUri;
    } catch (err) {
      setStatus('idle');
      throw err;
    }
  }, [status]);

  return {
    status,
    durationMs,
    audioLevel,
    availableInputs,
    selectedInputUid,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    selectInput,
    refreshInputs,
  };
}
