# Journal App — Setup Guide

## Quick Start

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (iOS/Android) to run on your device.

---

## Feature Setup

### 1. Transcription (OpenAI Whisper)

1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key under **API Keys**
3. Open the app → **Settings** → paste your key under **OpenAI API Key**

Recordings are sent to Whisper (`whisper-1`) after you stop recording. Transcription runs in the background — you can browse your entries while it processes.

### 2. Google Drive Cloud Storage

**One-time Google Cloud setup:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Google Drive API** (`APIs & Services → Enable APIs`)
4. Create OAuth 2.0 credentials (`APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs`)
   - Application type: **Web application**
   - Add authorized redirect URI: `https://auth.expo.io/@your-expo-username/journal-app`
5. Also create credentials for **Android** and **iOS** if building standalone apps
6. Copy your client IDs into `src/services/driveService.ts`:

```typescript
export const GOOGLE_CONFIG = {
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  ...
};
```

7. In the app → **Settings** → tap **Sign in with Google**

Uploaded files are stored in `My Drive / Journal App / YYYY-MM-DD_HH-MM.m4a` + `.txt`.

### 3. Bluetooth Microphone

- **iOS**: Open the mic selector (sliders icon on the recording screen) to pick from available inputs including Bluetooth HFP devices.
- **Android**: Connect your Bluetooth headset before starting a recording — Android routes audio automatically. The mic selector confirms the active input.

---

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure and build
eas build --platform android   # or ios
```

Update `app.json` with your own `bundleIdentifier` (iOS) and `package` (Android) before building.
