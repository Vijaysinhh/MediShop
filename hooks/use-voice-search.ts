'use client';

import { useState, useEffect, useRef } from 'react';

interface UseVoiceSearchOptions {}

/** Voice input is deliberately English-only for the MediShop workspace. */
export function useVoiceSearch(_options: UseVoiceSearchOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript((prev) => (prev ? prev + ' ' + transcript : transcript));
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission is blocked.',
        'audio-capture': 'No microphone was found.',
        network: 'Voice service is unavailable. Please type your question or try again later.',
      };
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      setError(messages[event.error] || 'Voice input stopped. Please try again.');
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      recognition.abort();
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      shouldKeepListeningRef.current = true;
      setTranscript('');
      setError(null);
      try {
        recognitionRef.current.start();
      } catch {
        setIsListening(true);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      shouldKeepListeningRef.current = false;
      recognitionRef.current.stop();
    }
  };

  const resetTranscript = () => {
    setTranscript('');
  };

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
