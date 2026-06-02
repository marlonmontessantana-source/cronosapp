import { useRef, useState } from 'react';
import { parseVoiceToTask } from '../voiceParser.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function VoiceButton({ onResult, onError, variant = 'icon', label }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const supported = Boolean(SR);

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const start = async () => {
    if (!supported) {
      onError?.('El reconocimiento de voz no está disponible en este navegador. Usa Chrome o Edge (en el móvil, Chrome de Android).');
      return;
    }
    if (listening) { stop(); return; }

    // Feedback inmediato mientras se pide permiso / arranca el motor.
    setListening(true);

    // 1) Pedir el micrófono SOLO la primera vez. Si el permiso ya está concedido,
    //    saltamos getUserMedia y vamos directo al reconocimiento (sin volver a preguntar).
    let alreadyGranted = false;
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        alreadyGranted = status.state === 'granted';
        if (status.state === 'denied') {
          setListening(false);
          onError?.('Permiso de micrófono bloqueado. Actívalo en el candado 🔒 de la barra de direcciones y recarga.');
          return;
        }
      }
    } catch { /* algunos navegadores no soportan permissions.query para 'microphone' */ }

    try {
      if (!alreadyGranted && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      setListening(false);
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        onError?.('Permiso de micrófono denegado. Actívalo en el candado 🔒 de la barra de direcciones y vuelve a intentarlo.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        onError?.('No se detectó ningún micrófono en tu dispositivo.');
      } else if (e.name === 'NotReadableError') {
        onError?.('Tu micrófono está siendo usado por otra aplicación.');
      } else {
        onError?.('No se pudo acceder al micrófono: ' + (e.message || e.name));
      }
      return;
    }

    // 2) Iniciar el reconocimiento (ya con permiso concedido).
    try {
      const rec = new SR();
      rec.lang = 'es-CO';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      let started = false;
      let gotResult = false;

      rec.onstart = () => { started = true; setListening(true); };
      rec.onend = () => {
        setListening(false);
        if (started && !gotResult) onError?.('No te escuché. Habla justo después de pulsar el micrófono e inténtalo de nuevo.');
      };
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          onError?.('Permiso de micrófono denegado.');
        } else if (e.error === 'no-speech') {
          onError?.('No te escuché. Inténtalo de nuevo.');
        } else if (e.error === 'network') {
          onError?.('Sin conexión para el reconocimiento de voz. Revisa tu internet.');
        } else if (e.error !== 'aborted') {
          onError?.('Error de reconocimiento: ' + e.error);
        }
      };
      rec.onresult = (event) => {
        gotResult = true;
        const transcript = event.results[0][0].transcript;
        onResult?.(parseVoiceToTask(transcript), transcript);
      };

      recRef.current = rec;
      rec.start();

      // Watchdog: si el motor no arranca en ~8 s, lo detenemos y avisamos.
      setTimeout(() => {
        if (!started) { stop(); onError?.('No se pudo iniciar el reconocimiento de voz. Inténtalo de nuevo.'); }
      }, 8000);
    } catch {
      setListening(false);
      onError?.('No se pudo iniciar el reconocimiento de voz. Inténtalo de nuevo.');
    }
  };

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
