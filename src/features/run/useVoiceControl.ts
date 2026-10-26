import { useEffect, useRef, useState } from 'react';
import { parseVoiceCommand, type VoiceCommand } from './voiceCommands';

/*
 * Voice control on top of the Web Speech API. Recognition is not available in every browser
 * (Firefox, for one), so callers must handle the "unsupported" status.
 */

export type VoiceStatus = 'unsupported' | 'off' | 'listening' | 'error';

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Reads text aloud. Returns false when speech synthesis is not available. */
export function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
  return true;
}

/**
 * Keeps the microphone listening while enabled, and hands each recognized command to onCommand.
 * Recognition ends on its own after silence, so it restarts until disabled.
 */
export function useVoiceControl(
  enabled: boolean,
  onCommand: (command: VoiceCommand, transcript: string) => void,
): { supported: boolean; status: VoiceStatus; heard: string } {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [heard, setHeard] = useState('');
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const latest = useRef(onCommand);
  useEffect(() => {
    latest.current = onCommand;
  });

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus('unsupported');
      return;
    }

    let stopped = false;
    let restartTimer: number | undefined;
    let current: RecognitionLike | null = null;

    const begin = () => {
      const recognition = new Ctor();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          const transcript = result[0].transcript;
          setHeard(transcript);
          const command = parseVoiceCommand(transcript);
          if (command) latest.current(command, transcript);
        }
      };
      recognition.onerror = (event) => {
        // Permission problems will not fix themselves, so stop instead of retrying.
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stopped = true;
          setStatus('error');
        }
      };
      recognition.onend = () => {
        if (stopped) return;
        restartTimer = window.setTimeout(begin, 300);
      };
      current = recognition;
      try {
        recognition.start();
        setStatus('listening');
      } catch {
        stopped = true;
        setStatus('error');
      }
    };

    begin();
    return () => {
      stopped = true;
      if (restartTimer !== undefined) window.clearTimeout(restartTimer);
      try {
        current?.stop();
      } catch {
        // Already stopped.
      }
    };
  }, [enabled]);

  return { supported, status, heard };
}
