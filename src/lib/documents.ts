import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Shared compliance/trademark document capture + upload.
// One authoritative implementation (audit: OnboardingScreen had the only copy;
// BrandRegistration/MarketplaceListingForm shipped stubs).

export interface CapturedDoc {
  storagePath: string;
  localUri: string;
}

export async function captureDocument(): Promise<CapturedDoc | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  return { localUri: result.assets[0].uri, storagePath: '' };
}

export async function uploadDocument(
  userId: string,
  localUri: string,
  docKind: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileName = `${docKind}_${Date.now()}.jpg`;
  const filePath = `documents/${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('compliance-docs')
    .upload(filePath, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return filePath;
}

/** Capture + upload in one step; returns the storage path or null if cancelled. */
export async function captureAndUpload(userId: string, docKind: string): Promise<string | null> {
  const shot = await captureDocument();
  if (!shot) return null;
  return uploadDocument(userId, shot.localUri, docKind);
}
