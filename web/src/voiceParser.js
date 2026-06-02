import * as chrono from 'chrono-node';

const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3,
  jueves: 4, viernes: 5, 'sábado': 6, sabado: 6,
};

const NUM_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function toYMD(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Convierte una frase hablada en español en una propuesta de tarea.
 * Devuelve { title, start_date, time, recurrence_type, recurrence_interval, recurrence_weekdays }.
 */
export function parseVoiceToTask(transcript) {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const now = new Date();

  const result = {
    title: text,
    start_date: toYMD(now),
    time: null,
    recurrence_type: 'none',
    recurrence_interval: 1,
    recurrence_weekdays: [],
  };

  // --- Recurrencia ---
  // "todos los días" / "cada día" / "diariamente"
  if (/\b(todos los d[ií]as|cada d[ií]a|diariamente|a diario)\b/.test(lower)) {
    result.recurrence_type = 'daily';
  }
  // "cada N días"
  const everyDays = lower.match(/cada (\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) d[ií]as?/);
  if (everyDays) {
    result.recurrence_type = 'daily';
    result.recurrence_interval = parseInt(everyDays[1], 10) || NUM_WORDS[everyDays[1]] || 1;
  }
  // "cada semana" / "semanalmente" / "todas las semanas"
  if (/\b(cada semana|semanalmente|todas las semanas)\b/.test(lower)) {
    result.recurrence_type = 'weekly';
  }
  const everyWeeks = lower.match(/cada (\d+|dos|tres|cuatro) semanas/);
  if (everyWeeks) {
    result.recurrence_type = 'weekly';
    result.recurrence_interval = parseInt(everyWeeks[1], 10) || NUM_WORDS[everyWeeks[1]] || 1;
  }
  // "cada mes" / "mensualmente" / "todos los meses"
  if (/\b(cada mes|mensualmente|todos los meses)\b/.test(lower)) {
    result.recurrence_type = 'monthly';
  }
  const everyMonths = lower.match(/cada (\d+|dos|tres|cuatro|seis) meses/);
  if (everyMonths) {
    result.recurrence_type = 'monthly';
    result.recurrence_interval = parseInt(everyMonths[1], 10) || NUM_WORDS[everyMonths[1]] || 1;
  }

  // Días de la semana mencionados → recurrencia semanal en esos días
  // "todos los lunes", "cada martes y jueves", "los lunes y miércoles"
  const mentionedDays = [];
  for (const [name, idx] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(lower)) mentionedDays.push(idx);
  }
  if (mentionedDays.length && /\b(todos los|cada|los)\b/.test(lower) && result.recurrence_type !== 'monthly') {
    result.recurrence_type = 'weekly';
    result.recurrence_weekdays = [...new Set(mentionedDays)];
  }

  // --- Fecha y hora con chrono (locale español) ---
  const parsed = chrono.es.parse(text, now, { forwardDate: true });
  if (parsed.length) {
    const c = parsed[0];
    const d = c.start.date();
    result.start_date = toYMD(d);
    if (c.start.isCertain('hour')) {
      result.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  // Hora explícita tipo "a las 8", "a las 3 de la tarde", "8 y media"
  if (!result.time) {
    const hourMatch = lower.match(/a las? (\d{1,2})(?::(\d{2})| y (media|cuarto))?\s*(de la (mañana|tarde|noche)|am|pm|a\.m\.|p\.m\.)?/);
    if (hourMatch) {
      let h = parseInt(hourMatch[1], 10);
      let m = 0;
      if (hourMatch[2]) m = parseInt(hourMatch[2], 10);
      else if (hourMatch[3] === 'media') m = 30;
      else if (hourMatch[3] === 'cuarto') m = 15;
      const period = hourMatch[4] || '';
      if (/tarde|noche|pm|p\.m\./.test(period) && h < 12) h += 12;
      if (/mañana|am|a\.m\./.test(period) && h === 12) h = 0;
      if (h >= 0 && h <= 23) result.time = `${pad(h)}:${pad(m)}`;
    }
  }

  // --- Limpiar el título: quitar expresiones de fecha/hora/recurrencia ---
  let title = text;
  if (parsed.length) {
    title = title.replace(parsed[0].text, ' ');
  }
  title = title
    .replace(/\b(todos los d[ií]as|cada d[ií]a|diariamente|a diario)\b/gi, ' ')
    .replace(/cada \d+ (d[ií]as?|semanas?|meses)/gi, ' ')
    .replace(/\b(cada|todas las|todos los|los)\s+(semana|semanas|mes|meses|domingos?|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados?)\b/gi, ' ')
    .replace(/\b(semanalmente|mensualmente|a diario)\b/gi, ' ')
    .replace(/a las? \d{1,2}(:\d{2})?(\s*(de la (mañana|tarde|noche)|am|pm|a\.m\.|p\.m\.))?/gi, ' ')
    .replace(/\b(y media|y cuarto)\b/gi, ' ')
    .replace(/\b(recordar|recuérdame|recuerdame|agendar|agenda|programa|programar|crear tarea|nueva tarea|tarea)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title) {
    result.title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return result;
}
