import { useState, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';

/**
 * Voice input hook — on-device speech recognition (zero per-query cost).
 * Master doc §5 F4 / §8: voice search feeds the SAME search-molecule
 * backend as typed search; user's chosen language (default hi-IN).
 */
export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('result', (event) => {
    if (event.results?.[0]?.transcript != null) {
      setTranscript(event.results[0].transcript);
      if (event.isFinal) {
        setIsListening(false);
        ExpoSpeechRecognitionModule.stop();
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.message || 'Speech recognition error');
    setIsListening(false);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  const startListening = useCallback(async (language: string = 'hi-IN') => {
    if (Platform.OS === 'web') {
      setError('Voice input not available on web');
      return;
    }
    setError(null);
    setTranscript('');
    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        setError('Microphone permission is required for voice search');
        return;
      }
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: language,
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start voice input');
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } finally {
      setIsListening(false);
    }
  }, []);

  const cancelListening = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // already stopped
    }
    setTranscript('');
    setIsListening(false);
  }, []);

  const setTranscriptValue = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    cancelListening,
    setTranscript: setTranscriptValue,
  };
}
