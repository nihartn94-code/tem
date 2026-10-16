import { useState, useCallback } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { Alert, Platform } from 'react-native';

interface OCRResult {
 text: string;
 confidence: number;
}

// ML Kit type definitions
interface MLKitBlock {
 text: string;
 confidence?: number;
}

interface MLKitResult {
 blocks: MLKitBlock[];
}

/**
 * On-device OCR hook using ML Kit text recognition
 * SRS §5: Camera-before-keyboard — OCR is the primary data entry method
 * Architecture §3: On-device processing = zero per-scan cost
 */
export function useOCR() {
 const [isProcessing, setIsProcessing] = useState(false);
 const [results, setResults] = useState<OCRResult[]>([]);
 const [permission, requestPermission] = useCameraPermissions();

 const processImage = useCallback(async (imageUri: string): Promise<OCRResult[]> => {
 setIsProcessing(true);
 try {
 // Use ML Kit text recognition for actual OCR
 // This works on both Android and iOS via @react-native-ml-kit/text-recognition
 if (Platform.OS === 'android' || Platform.OS === 'ios') {
 // Dynamic import with proper typing and fallback
 const mod = await import('@react-native-ml-kit/text-recognition');
 const TextRecognition = mod.default || mod;
 const visionResult: MLKitResult = await TextRecognition.recognize(imageUri);
 
 const ocrResults: OCRResult[] = visionResult.blocks.map((block) => ({
 text: block.text,
 confidence: block.confidence || 0.9,
 }));
 
 setResults(ocrResults);
 return ocrResults;
 }
 
 // Fallback for web/development - return empty array
 return [];
 } catch (error) {
 if (__DEV__) {
 console.error('OCR processing error:', error);
 }
 Alert.alert('OCR Error', 'Failed to process image. Please try again.');
 return [];
 } finally {
 setIsProcessing(false);
 }
 }, []);

 const scanBatchNumber = useCallback(async (imageUri: string): Promise<string | null> => {
 setIsProcessing(true);
 try {
 const results = await processImage(imageUri);
 
 // Find batch number pattern in OCR results
 for (const result of results) {
 const batchMatch = result.text.match(
 /(?:Batch|B\.?No\.?|BT):?\s*([A-Z0-9]{4,20})/i
 );
 if (batchMatch) {
 return batchMatch[1];
 }
 }
 
 return null;
 } finally {
 setIsProcessing(false);
 }
 }, [processImage]);

 const scanOrderList = useCallback(async (imageUri: string): Promise<string[]> => {
 setIsProcessing(true);
 try {
 const results = await processImage(imageUri);
 return results.map((r) => r.text).filter(Boolean);
 } finally {
 setIsProcessing(false);
 }
 }, [processImage]);

 const ensurePermission = useCallback(async (): Promise<boolean> => {
 if (permission?.granted) return true;
 
 const { granted } = await requestPermission();
 if (!granted) {
 Alert.alert(
 'Camera Permission Required',
 'PharmaOS needs camera access to scan documents, order lists, and batch numbers.'
 );
 }
 return granted;
 }, [permission, requestPermission]);

 return {
 isProcessing,
 results,
 permission,
 processImage,
 scanBatchNumber,
 scanOrderList,
 ensurePermission,
 };
}