import { useCallback, useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export const speechSupported = !!SR;

// Append dictated text to whatever is already in the field.
export const appendTranscript = (prev, text) => (prev ? `${prev} ${text}` : text);

// Browser dictation, shared by the notes composer, the note modal and the
// time-block scheduler. `onTranscript` is called with each final phrase.
export function useSpeechInput(onTranscript) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Held in a ref so the recognition handlers never close over a stale setter.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; });

  // Detach and stop on unmount so a live mic can't outlive the component.
  useEffect(() => () => {
    const r = recognitionRef.current;
    if (!r) return;
    r.onresult = null;
    r.onend = null;
    r.onerror = null;
    r.stop();
  }, []);

  const toggle = useCallback(() => {
    if (!SR) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join(' ');
      if (transcript) onTranscriptRef.current?.(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = (e) => {
      setRecording(false);
      if (e.error === 'not-allowed') {
        alert('Microphone access was denied. Please allow it in your browser settings.');
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }, [recording]);

  return { supported: speechSupported, recording, toggle };
}
