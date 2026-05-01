import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FOLDER_ID_KEY = '@drive_journal_folder_id';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const GOOGLE_CONFIG = {
  webClientId: '351964312365-pcrisgcctjjp3t3nuh92bmdrddiil5k7.apps.googleusercontent.com',
  androidClientId: '351964312365-e6fcd7ms2kbcme7nla8jjp2jqhfms9ie.apps.googleusercontent.com',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

async function getJournalFolderId(accessToken: string): Promise<string> {
  const cached = await AsyncStorage.getItem(FOLDER_ID_KEY);
  if (cached) return cached;

  // Search for existing folder
  const query = encodeURIComponent(
    "name='Journal App' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const searchRes = await fetch(`${DRIVE_FILES_URL}?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json() as { files: DriveFile[] };

  if (searchData.files?.length > 0) {
    const folderId = searchData.files[0].id;
    await AsyncStorage.setItem(FOLDER_ID_KEY, folderId);
    return folderId;
  }

  // Create the folder
  const createRes = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Journal App',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json() as DriveFile;
  await AsyncStorage.setItem(FOLDER_ID_KEY, folder.id);
  return folder.id;
}

async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  fileUri: string,
  parentId: string
): Promise<string> {
  const base64Content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const boundary = '-------multipart_boundary_314159';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Content,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
  const result = await response.json() as DriveFile;
  return result.id;
}

async function uploadTextToDrive(
  accessToken: string,
  fileName: string,
  text: string,
  parentId: string
): Promise<string> {
  // Write text to a temp file first
  const tempUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(tempUri, text, { encoding: FileSystem.EncodingType.UTF8 });

  const id = await uploadFileToDrive(accessToken, fileName, 'text/plain', tempUri, parentId);
  await FileSystem.deleteAsync(tempUri, { idempotent: true });
  return id;
}

export async function uploadEntryToDrive(
  accessToken: string,
  entryDate: string,
  audioUri: string,
  transcript: string
): Promise<{ audioFileId: string; transcriptFileId: string }> {
  const folderId = await getJournalFolderId(accessToken);

  const date = new Date(entryDate);
  const datePart = date.toISOString().slice(0, 10);
  const timePart = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const baseName = `${datePart}_${timePart}`;

  const [audioFileId, transcriptFileId] = await Promise.all([
    uploadFileToDrive(accessToken, `${baseName}.m4a`, 'audio/mp4', audioUri, folderId),
    uploadTextToDrive(accessToken, `${baseName}.txt`, transcript || '(no transcript)', folderId),
  ]);

  return { audioFileId, transcriptFileId };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GOOGLE_CONFIG.androidClientId,
    }).toString(),
  });

  if (!response.ok) throw new Error('Failed to refresh Google token');
  const data = await response.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function clearDriveFolderCache(): Promise<void> {
  await AsyncStorage.removeItem(FOLDER_ID_KEY);
}
