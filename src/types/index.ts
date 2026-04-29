export interface JournalEntry {
  id: string;
  title: string;
  date: string; // ISO string
  durationMs: number;
  audioUri: string; // local persistent file URI
  transcript: string;
  isTranscribing: boolean;
  driveAudioFileId?: string;
  driveTranscriptFileId?: string;
}

export interface AudioInput {
  uid: string;
  name: string;
  type: 'BuiltInMic' | 'BluetoothHFP' | 'HeadsetMic' | 'HeadphoneMic' | 'Unknown';
}

export interface AppSettings {
  openAIApiKey: string;
  googleAccessToken: string;
  googleRefreshToken: string;
  googleTokenExpiry: number; // Unix ms timestamp
  autoUploadToDrive: boolean;
  liveTranscription: boolean;
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing';

export type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Entry: { entryId: string };
  Settings: undefined;
};
