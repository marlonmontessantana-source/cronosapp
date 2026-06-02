import { useRef, useState } from 'react';
import { parseVoiceToTask } from '../voiceParser.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function VoiceButton({ onResult, onError, variant = 'icon', label }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const supported = Boolean(SR);

  const start = () => {
    if (!supported) {
      onError?.('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }
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
      } else if (e.error === 'no-speech') {
        onError?.('No te escuché. Inténtalo de nuevo.');
      } else if (e.error !== 'aborted') {
        onError?.('Error de reconocimiento: ' + e.error);
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

  // Botón flotante grande para invitar a agendar por voz (home).
  if (variant === 'fab') {
    return (
      <button
        type="button"
        className={'voice-fab' + (listening ? ' listening' : '')}
        onClick={start}
        title={supported ? 'Agendar por voz' : 'Reconocimiento de voz no disponible en este navegador'}
        aria-label="Agendar por voz"
      >
        <span className="voice-fab-icon">{listening ? '⏺️' : '🎙️'}</span>
        <span className="voice-fab-label">{listening ? 'Escuchando…' : (label || 'Agendar por voz')}</span>
      </button>
    );
  }

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
