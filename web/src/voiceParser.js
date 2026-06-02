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

  // --- Día relativo explícito: hoy / mañana / pasado mañana ---
  // Protegemos "de la mañana" (franja horaria) para no confundirla con "mañana" (día siguiente).
  const dayText = lower.replace(/de la mañana/g, ' __franja__ ');
  let relDay = null;
  if (/\bpasado\s+mañana\b/.test(dayText)) relDay = 2;
  else if (/\bmañana\b/.test(dayText)) relDay = 1;
  else if (/\bhoy\b/.test(dayText)) relDay = 0;

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

  // El día relativo explícito tiene prioridad (chrono no maneja bien "pasado mañana").
  if (relDay !== null) {
    const d = new Date(now);
    d.setDate(d.getDate() + relDay);
    result.start_date = toYMD(d);
  }

  // Hora explícita: "a las 2 de la tarde", "a las 8", "8 y media", "5 de la tarde".
  // Tiene prioridad sobre chrono porque maneja mejor el AM/PM en español.
  const hourMatch = lower.match(/(?:a las?\s+)?\b(\d{1,2})(?::(\d{2})| y (media|cuarto))?\s*(de la (?:mañana|tarde|noche)|a\.?\s?m\.?|p\.?\s?m\.?)/);
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10);
    let m = 0;
    if (hourMatch[2]) m = parseInt(hourMatch[2], 10);
    else if (hourMatch[3] === 'media') m = 30;
    else if (hourMatch[3] === 'cuarto') m = 15;
    const period = hourMatch[4] || '';
    if (/tarde|noche|p\.?\s?m/.test(period) && h < 12) h += 12;
    if (/mañana|a\.?\s?m/.test(period) && h === 12) h = 0;
    if (h >= 0 && h <= 23) result.time = `${pad(h)}:${pad(m)}`;
  } else if (!result.time) {
    // "a las 8" sin franja
    const simple = lower.match(/a las?\s+(\d{1,2})(?::(\d{2}))?/);
    if (simple) {
      const h = parseInt(simple[1], 10);
      const m = simple[2] ? parseInt(simple[2], 10) : 0;
      if (h >= 0 && h <= 23) result.time = `${pad(h)}:${pad(m)}`;
    }
  }

  // La hora de inicio es obligatoria: por defecto 09:00 si no se dijo ninguna.
  if (!result.time) result.time = '09:00';

  // --- Limpiar el título: quitar expresiones de fecha/hora/recurrencia ---
  let title = text;
  // Quitar lo que chrono identificó como fecha/hora.
  for (const p of parsed) title = title.replace(p.text, ' ');
  title = title
    // recurrencia explícita
    .replace(/\b(todos los d[ií]as|cada d[ií]a|diariamente|a diario|semanalmente|mensualmente)\b/gi, ' ')
    .replace(/\bcada (\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) (d[ií]as?|semanas?|meses)\b/gi, ' ')
    .replace(/\b(cada|todas las|todos los|los|la|el)\s+(semanas?|mes|meses)\b/gi, ' ')
    // horas y fragmentos de hora restantes
    .replace(/\ba las?\b/gi, ' ')
    .replace(/\b\d{1,2}(:\d{2})?\s*(de la (mañana|tarde|noche)|am|pm|a\.m\.|p\.m\.)\b/gi, ' ')
    .replace(/\b\d{1,2}(:\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)\b/gi, ' ')
    .replace(/\bde la (mañana|tarde|noche)\b/gi, ' ')
    .replace(/\by (media|cuarto)\b/gi, ' ')
    // días relativos
    .replace(/\b(pasado\s+mañana|pasado|mañana|hoy)\b/gi, ' ')
    // días de la semana sueltos
    .replace(/\b(domingos?|lunes|martes|mi[ée]rcoles|miercoles|jueves|viernes|s[áa]bados?|sabados?)\b/gi, ' ')
    // conectores y cuantificadores sobrantes
    .replace(/\b(cada|todos los|todas las|los)\b/gi, ' ')
    // palabras gatillo iniciales
    .replace(/\b(recu[eé]rdame|recordar|agéndame|ag[eé]ndame|agendar|agenda|prog?ram[ae]r?|crear? (una )?tarea|nueva tarea)\b/gi, ' ')
    .replace(/\s+(y|e)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Quitar conectores sueltos al inicio/final de forma iterativa ("a de", "de la", etc.).
  const connector = /^(a|al|de|del|y|e|en|que|con|el|la|lo|las|los|un|una)$/i;
  let words = title.split(/\s+/).filter(Boolean);
  while (words.length > 1 && connector.test(words[0])) words.shift();
  while (words.length > 1 && connector.test(words[words.length - 1])) words.pop();
  title = words.join(' ').trim();

  if (title) {
    result.title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return result;
}
