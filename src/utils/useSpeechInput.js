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
  // Reported inline by the caller. alert() blocked the event loop and looked
  // like a different application inside an installed PWA.
  const [error, setError] = useState('');
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
      setError('Voice input needs Chrome or Edge. You can still type the text.');
      return;
    }
    setError('');
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
        setError('Microphone access was blocked. Allow it in your browser settings, then try again.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError('Dictation stopped unexpectedly. Try again.');
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }, [recording]);

  return { supported: speechSupported, recording, toggle, error };
}
