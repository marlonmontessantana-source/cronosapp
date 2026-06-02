import { useRef, useState } from 'react';
import { parseVoiceToTask } from '../voiceParser.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function VoiceButton({ onResult, onError }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  if (!SR) {
    return (
      <button
        type="button"
        className="icon-btn"
        title="Tu navegador no soporta reconocimiento de voz (usa Chrome o Edge)"
        onClick={() => onError?.('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')}
      >
        🎙️
      </button>
    );
  }

  const start = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'es-CO';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onError?.('Permiso de micrófono denegado.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        onError?.('Error de reconocimiento: ' + e.error);
      } else if (e.error === 'no-speech') {
        onError?.('No te escuché. Inténtalo de nuevo.');
      }
    };
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const task = parseVoiceToTask(transcript);
      onResult?.(task, transcript);
    };
    recRef.current = rec;
    rec.start();
  };

  return (
    <button
      type="button"
      className={'icon-btn voice-btn' + (listening ? ' listening' : '')}
      onClick={start}
      title="Programar por voz"
    >
      {listening ? '⏺️' : '🎙️'}
    </button>
  );
}
