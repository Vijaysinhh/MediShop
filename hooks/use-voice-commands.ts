'use client';

import { useState, useRef } from 'react';
import { useItems } from './use-db';

interface VoiceCommand {
  command: string;
  action: () => void;
}

export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { items } = useItems();
  const recognitionRef = useRef<any>(null);

  const startListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported on this device');
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptSegment = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            setTranscript(prev => prev + transcriptSegment + ' ');
          } else {
            interimTranscript += transcriptSegment;
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
    }

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  const parseCommand = (text: string) => {
    const lower = text.toLowerCase();

    // Search for item by voice
    if (lower.includes('find') || lower.includes('search')) {
      const itemName = text.replace(/find|search/gi, '').trim();
      const foundItem = items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
      return {
        command: 'search',
        data: foundItem,
      };
    }

    // Get item price
    if (lower.includes('price')) {
      const itemName = text.replace(/price/gi, '').trim();
      const foundItem = items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
      return {
        command: 'price',
        data: foundItem,
      };
    }

    // Add to cart
    if (lower.includes('add')) {
      return {
        command: 'add',
        data: text,
      };
    }

    // Check stock
    if (lower.includes('stock')) {
      const itemName = text.replace(/stock/gi, '').trim();
      const foundItem = items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
      return {
        command: 'stock',
        data: foundItem,
      };
    }

    return {
      command: 'unknown',
      data: null,
    };
  };

  const speak = (text: string) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new (window as any).SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        (window as any).speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('[v0] Speech synthesis error:', err);
    }
  };

  return {
    isListening,
    transcript,
    isSpeaking,
    startListening,
    stopListening,
    clearTranscript,
    parseCommand,
    speak,
  };
}
