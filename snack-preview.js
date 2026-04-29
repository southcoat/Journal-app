/**
 * Journal App — Expo Snack Preview
 * Paste this entire file into snack.expo.dev to preview the full UI.
 * Audio recording is simulated (all visual design is identical to the real app).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, Animated, SafeAreaView, Modal, TextInput, Switch, Alert,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0D0D14',
  surface:     '#1A1A2E',
  surfaceVar:  '#242438',
  border:      '#2D2D48',
  primary:     '#7B68EE',
  primaryFade: 'rgba(123,104,238,0.15)',
  rec:         '#FF4757',
  recFade:     'rgba(255,71,87,0.2)',
  pause:       '#FFA502',
  success:     '#2ED573',
  text:        '#F0F0F8',
  sub:         '#8888AA',
  muted:       '#555566',
  white:       '#FFFFFF',
  overlay:     'rgba(0,0,0,0.75)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_ENTRIES = [
  {
    id: '1',
    date: new Date(Date.now() - 86400000 * 0).toISOString(),
    durationMs: 7 * 60000 + 23000,
    transcript: 'This morning I was thinking about the project deadline and how we might need to restructure the team meetings. It would probably help to have shorter stand-ups and move the longer planning sessions to Fridays when everyone is more relaxed.',
    driveAudioFileId: 'mock-drive-id',
    isTranscribing: false,
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400000 * 1).toISOString(),
    durationMs: 12 * 60000 + 5000,
    transcript: 'Had a great idea on the commute today — what if we redesigned the onboarding flow entirely? The drop-off rate on step three is really high. I want to explore a more conversational approach, maybe skip the form for first-time users.',
    isTranscribing: false,
  },
  {
    id: '3',
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    durationMs: 4 * 60000 + 48000,
    transcript: '',
    isTranscribing: false,
  },
];

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({ isActive, color }) {
  const barColor = color || C.primary;
  const N = 34;
  const bars = useRef(Array.from({ length: N }, () => new Animated.Value(3))).current;
  const histRef = useRef(Array(N).fill(0));
  const lvRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      bars.forEach(b =>
        Animated.spring(b, { toValue: 3, useNativeDriver: false, speed: 8, bounciness: 0 }).start()
      );
      return;
    }
    const id = setInterval(() => {
      lvRef.current = Math.max(0, Math.min(1, lvRef.current + (Math.random() - 0.38) * 0.35));
      histRef.current = [...histRef.current.slice(1), lvRef.current];
      bars.forEach((b, i) => {
        const lv = histRef.current[i];
        const center = N / 2;
        const df = 1 - (Math.abs(i - center) / center) * 0.3;
        Animated.spring(b, {
          toValue: Math.max(3, 3 + 57 * lv * df),
          speed: 42, bounciness: 2, useNativeDriver: false,
        }).start();
      });
    }, 80);
    return () => clearInterval(id);
  }, [isActive, bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 80, paddingHorizontal: 8 }}>
      {bars.map((h, i) => (
        <Animated.View key={i} style={{
          width: 3, marginHorizontal: 1, height: h, borderRadius: 1.5,
          backgroundColor: barColor,
          opacity: isActive ? 0.3 + (i / N) * 0.7 : 0.18,
        }} />
      ))}
    </View>
  );
}

// ─── RecordButton ─────────────────────────────────────────────────────────────

function RecordButton({ status, onPress, size = 88 }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (status === 'recording') {
      loopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.28, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 900, useNativeDriver: true }),
      ]));
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    }
  }, [status, pulse]);

  const bg   = status === 'recording' ? C.rec : status === 'paused' ? C.pause : C.primary;
  const icon = status === 'recording' ? 'pause' : 'mic';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {status === 'recording' && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: size + 32, height: size + 32, borderRadius: (size + 32) / 2,
          borderWidth: 2, borderColor: C.rec,
          transform: [{ scale: pulse }],
          opacity: pulse.interpolate({ inputRange: [1, 1.28], outputRange: [0.5, 0] }),
        }} />
      )}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        disabled={status === 'processing'}
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
        }}
      >
        <Ionicons name={icon} size={size * 0.38} color={C.white} />
      </TouchableOpacity>
    </View>
  );
}

// ─── MicSelector ─────────────────────────────────────────────────────────────

const MIC_INPUTS = [
  { uid: 'builtin', name: 'Built-in Microphone', type: 'Built In Mic',    icon: 'mic' },
  { uid: 'bt',      name: 'Pixel Buds Pro',       type: 'Bluetooth HFP',  icon: 'bluetooth' },
  { uid: 'wired',   name: 'Wired Headset',         type: 'Headset Mic',    icon: 'headset' },
];

function MicSelector({ visible, onClose, selectedUid, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay }}
        activeOpacity={1} onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={{
          backgroundColor: C.surface,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 20, paddingBottom: 36,
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16 }}>
            Select Microphone
          </Text>
          {MIC_INPUTS.map(inp => {
            const sel = inp.uid === selectedUid;
            return (
              <TouchableOpacity key={inp.uid} onPress={() => { onSelect(inp.uid); onClose(); }} activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 12,
                  borderRadius: 12, marginBottom: 8,
                  backgroundColor: sel ? C.primaryFade : C.surfaceVar,
                  borderWidth: sel ? 1 : 0, borderColor: C.primary,
                }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: sel ? C.primary : C.border,
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Ionicons name={inp.icon} size={22} color={sel ? C.white : C.sub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '500' }}>{inp.name}</Text>
                  <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{inp.type}</Text>
                </View>
                {sel && <Ionicons name="checkmark-circle" size={22} color={C.primary} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity onPress={onClose} style={{
            marginTop: 8, backgroundColor: C.primary, borderRadius: 12,
            paddingVertical: 14, alignItems: 'center',
          }}>
            <Text style={{ color: C.white, fontSize: 16, fontWeight: '600' }}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onPress }) {
  const preview = entry.transcript
    ? entry.transcript.slice(0, 120) + (entry.transcript.length > 120 ? '…' : '')
    : '(no transcript)';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{fmtDate(entry.date)}</Text>
          <Text style={{ color: C.sub, fontSize: 14, marginTop: 2 }}>{fmtTime(entry.date)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="time-outline" size={14} color={C.sub} />
          <Text style={{ color: C.sub, fontSize: 14 }}>{fmtDur(entry.durationMs)}</Text>
          {entry.driveAudioFileId && (
            <Ionicons name="cloud-done-outline" size={14} color={C.success} style={{ marginLeft: 4 }} />
          )}
        </View>
      </View>
      <Text
        numberOfLines={3}
        style={{ color: entry.transcript ? C.sub : C.muted, fontSize: 14, lineHeight: 20, fontStyle: entry.transcript ? 'normal' : 'italic' }}
      >
        {preview}
      </Text>
    </TouchableOpacity>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

function HomeScreen({ navigation, route }) {
  const [entries, setEntries] = useState(INITIAL_ENTRIES);

  useEffect(() => {
    if (route.params?.newEntry) {
      setEntries(prev => [route.params.newEntry, ...prev]);
      navigation.setParams({ newEntry: null });
    }
  }, [route.params?.newEntry]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 12 }}>
        <View>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.5 }}>Journal</Text>
          <Text style={{ color: C.sub, fontSize: 14, marginTop: 2 }}>{entries.length} entries</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="settings-outline" size={24} color={C.sub} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <EntryCard entry={item} onPress={() => navigation.navigate('Entry', { entry: item })} />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 36, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Record', {
            onDone: (entry) => setEntries(prev => [entry, ...prev]),
          })}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.primary, paddingVertical: 16, paddingHorizontal: 32,
            borderRadius: 9999, gap: 8,
            shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
          }}
        >
          <Ionicons name="mic" size={28} color={C.white} />
          <Text style={{ color: C.white, fontSize: 16, fontWeight: '600' }}>New Recording</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── RecordScreen ─────────────────────────────────────────────────────────────

function RecordScreen({ navigation, route }) {
  const [status, setStatus] = useState('idle'); // idle | recording | paused | processing
  const [ms, setMs] = useState(0);
  const [micModal, setMicModal] = useState(false);
  const [selectedMic, setSelectedMic] = useState('builtin');
  const timerRef = useRef(null);

  // Auto-start after a brief delay
  useEffect(() => {
    const t = setTimeout(() => setStatus('recording'), 600);
    return () => clearTimeout(t);
  }, []);

  // Tick the timer while recording
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => setMs(m => m + 80), 80);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const handleMainBtn = () => {
    if (status === 'recording') setStatus('paused');
    else if (status === 'paused') setStatus('recording');
  };

  const handleStop = () => {
    setStatus('processing');
    setTimeout(() => {
      const newEntry = {
        id: String(Date.now()),
        date: new Date().toISOString(),
        durationMs: ms,
        transcript: '(Transcript appears here after Whisper processes the audio — add your OpenAI API key in Settings to enable this.)',
        isTranscribing: false,
      };
      route.params?.onDone?.(newEntry);
      navigation.goBack();
    }, 1500);
  };

  const handleCancel = () => {
    Alert.alert('Discard recording?', 'This recording will be lost.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const statusLabel =
    status === 'recording' ? 'Recording…' :
    status === 'paused'    ? 'Paused'      :
    status === 'processing'? 'Saving…'     : 'Starting…';

  const statusColor =
    status === 'recording' ? C.rec :
    status === 'paused'    ? C.pause : C.sub;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
        <TouchableOpacity onPress={handleCancel} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color={C.sub} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999 }}>
          {status === 'recording' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.rec }} />}
          <Text style={{ color: statusColor, fontSize: 14, fontWeight: '600' }}>{statusLabel}</Text>
        </View>
        <TouchableOpacity onPress={() => setMicModal(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={24} color={C.sub} />
        </TouchableOpacity>
      </View>

      {/* Waveform + timer */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Waveform
          isActive={status === 'recording'}
          color={status === 'paused' ? C.pause : C.primary}
        />
        <Text style={{ color: C.text, fontSize: 48, fontWeight: '700', letterSpacing: 2, marginTop: 24 }}>
          {fmtDur(ms)}
        </Text>
      </View>

      {/* Controls */}
      <View style={{ alignItems: 'center', paddingBottom: 48, gap: 28 }}>
        {status === 'processing' ? (
          <Text style={{ color: C.sub, fontSize: 16, paddingBottom: 20 }}>Saving…</Text>
        ) : (
          <>
            <RecordButton status={status} onPress={handleMainBtn} size={88} />
            <TouchableOpacity onPress={handleStop} style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: C.surface, borderWidth: 2, borderColor: C.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: C.rec }} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <MicSelector
        visible={micModal}
        onClose={() => setMicModal(false)}
        selectedUid={selectedMic}
        onSelect={setSelectedMic}
      />
    </SafeAreaView>
  );
}

// ─── EntryScreen ──────────────────────────────────────────────────────────────

function EntryScreen({ navigation, route }) {
  const { entry } = route.params;
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState(entry.transcript);
  const [draft, setDraft] = useState(entry.transcript);
  const timerRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setPosMs(p => {
          if (p >= entry.durationMs) {
            setPlaying(false);
            clearInterval(timerRef.current);
            return 0;
          }
          return p + 250;
        });
      }, 250);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, entry.durationMs]);

  const progress = entry.durationMs > 0 ? posMs / entry.durationMs : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{fmtDate(entry.date)}</Text>
          <Text style={{ color: C.sub, fontSize: 12 }}>{fmtTime(entry.date)}</Text>
        </View>
        <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={22} color={C.rec} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Player card */}
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setPlaying(p => !p)}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={28} color={C.white} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>Audio Recording</Text>
              <Text style={{ color: C.sub, fontSize: 14, marginTop: 2 }}>{fmtDur(entry.durationMs)}</Text>
            </View>
          </View>
          <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: C.primary, borderRadius: 2 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: C.sub, fontSize: 12 }}>{fmtDur(posMs)}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>{fmtDur(entry.durationMs)}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { icon: 'share-outline',       label: 'Share',    color: C.primary },
            { icon: entry.driveAudioFileId ? 'cloud-done-outline' : 'cloud-upload-outline',
              label: entry.driveAudioFileId ? 'In Drive' : 'Upload',
              color: entry.driveAudioFileId ? C.success : C.primary },
          ].map(a => (
            <TouchableOpacity key={a.label} style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: C.surface, borderRadius: 12, paddingVertical: 14,
              borderWidth: 1, borderColor: C.border,
            }}>
              <Ionicons name={a.icon} size={20} color={a.color} />
              <Text style={{ color: a.color, fontSize: 14, fontWeight: '600' }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transcript */}
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '600' }}>Transcript</Text>
            <TouchableOpacity onPress={() => {
              if (editing) { setTranscript(draft); setEditing(false); }
              else { setDraft(transcript); setEditing(true); }
            }}>
              <Text style={{ color: C.primary, fontSize: 14, fontWeight: '600' }}>{editing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          {editing ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline autoFocus
              placeholderTextColor={C.muted}
              textAlignVertical="top"
              style={{ color: C.text, fontSize: 16, lineHeight: 26, minHeight: 200, backgroundColor: C.surfaceVar, borderRadius: 8, padding: 12 }}
            />
          ) : (
            <Text style={{ color: transcript ? C.text : C.muted, fontSize: 16, lineHeight: 26, fontStyle: transcript ? 'normal' : 'italic' }}>
              {transcript || 'No transcript available. Add an OpenAI API key in Settings to enable transcription.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

function SettingsScreen({ navigation }) {
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);
  const [signedIn, setSignedIn]   = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingBottom: 4 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '600' }}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Transcription */}
        <Text style={{ color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8, marginLeft: 4 }}>
          Transcription
        </Text>
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>OpenAI API Key</Text>
          <Text style={{ color: C.sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
            Used to transcribe recordings via Whisper. Get a key at platform.openai.com
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceVar, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 }}>
            <TextInput
              value={apiKey} onChangeText={setApiKey}
              placeholder="sk-…" placeholderTextColor={C.muted}
              secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false}
              style={{ flex: 1, color: C.text, fontSize: 14, padding: 14, fontFamily: 'monospace' }}
            />
            <TouchableOpacity onPress={() => setShowKey(v => !v)} style={{ padding: 14 }}>
              <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.sub} />
            </TouchableOpacity>
          </View>
          {apiKey.length > 0 && (
            <TouchableOpacity style={{ backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: C.white, fontSize: 16, fontWeight: '600' }}>Save Key</Text>
            </TouchableOpacity>
          )}
          {apiKey.length === 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="information-circle-outline" size={16} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 13 }}>No key set — transcription disabled</Text>
            </View>
          )}
        </View>

        {/* Cloud Storage */}
        <Text style={{ color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8, marginLeft: 4 }}>
          Cloud Storage
        </Text>
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Google Drive</Text>
              <Text style={{ color: C.sub, fontSize: 13, lineHeight: 18 }}>
                Uploads audio + transcripts to a "Journal App" folder in your Drive.
              </Text>
            </View>
            <Ionicons name={signedIn ? 'cloud-done' : 'cloud-offline-outline'} size={24} color={signedIn ? C.success : C.muted} />
          </View>
          <TouchableOpacity
            onPress={() => setSignedIn(v => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: signedIn ? 'rgba(255,71,87,0.15)' : C.primary,
              borderRadius: 12, paddingVertical: 14,
            }}
          >
            <Ionicons name={signedIn ? 'log-out-outline' : 'logo-google'} size={18} color={signedIn ? C.rec : C.white} />
            <Text style={{ color: signedIn ? C.rec : C.white, fontSize: 16, fontWeight: '600' }}>
              {signedIn ? 'Sign out of Google' : 'Sign in with Google'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '500' }}>Auto-upload after recording</Text>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>Requires Google sign-in</Text>
            </View>
            <Switch
              value={autoUpload && signedIn}
              onValueChange={setAutoUpload}
              trackColor={{ true: C.primary, false: C.border }}
              thumbColor={C.white}
              disabled={!signedIn}
            />
          </View>
        </View>

        {/* About */}
        <Text style={{ color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8, marginLeft: 4 }}>
          About
        </Text>
        <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          {[['Version', '1.0.0'], ['Platform', 'Expo SDK 51']].map(([k, v], i, arr) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
              <Text style={{ color: C.sub, fontSize: 16 }}>{k}</Text>
              <Text style={{ color: C.text, fontSize: 16 }}>{v}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Record"
          component={RecordScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="Entry" component={EntryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
