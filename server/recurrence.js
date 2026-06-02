// Expansión de reglas de recurrencia a fechas concretas dentro de un rango.
// Trabaja con fechas 'YYYY-MM-DD' en UTC para evitar desfases por zona horaria.

function toDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // Conservar el día del mes, recortando si el mes destino es más corto.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Devuelve un array de fechas 'YYYY-MM-DD' en las que ocurre la tarea, dentro de [from, to].
 * @param {object} task  fila de la tabla tasks
 * @param {string} from  'YYYY-MM-DD'
 * @param {string} to    'YYYY-MM-DD'
 */
export function expandOccurrences(task, from, to) {
  const out = [];
  const start = toDate(task.start_date);
  const rangeStart = toDate(from);
  const rangeEnd = toDate(to);
  const end = task.recurrence_end ? toDate(task.recurrence_end) : null;
  const hardEnd = end && end < rangeEnd ? end : rangeEnd;

  const interval = Math.max(1, task.recurrence_interval || 1);

  if (task.recurrence_type === 'none') {
    if (start >= rangeStart && start <= hardEnd) out.push(fmt(start));
    return out;
  }

  if (task.recurrence_type === 'daily') {
    // Primera ocurrencia >= rangeStart alineada al intervalo desde start.
    let cursor = new Date(start);
    if (cursor < rangeStart) {
      const diffDays = Math.floor((rangeStart - cursor) / 86400000);
      const steps = Math.ceil(diffDays / interval);
      cursor = addDays(cursor, steps * interval);
    }
    for (; cursor <= hardEnd; cursor = addDays(cursor, interval)) {
      if (cursor >= start) out.push(fmt(cursor));
    }
    return out;
  }

  if (task.recurrence_type === 'weekly') {
    const weekdays = (task.recurrence_weekdays || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map(Number);
    const days = weekdays.length ? weekdays : [start.getUTCDay()];
    // Semana base = semana (domingo) de start.
    const startWeek = addDays(start, -start.getUTCDay());
    let cursor = new Date(rangeStart);
    for (; cursor <= hardEnd; cursor = addDays(cursor, 1)) {
      if (cursor < start) continue;
      if (!days.includes(cursor.getUTCDay())) continue;
      const cursorWeek = addDays(cursor, -cursor.getUTCDay());
      const weeksDiff = Math.round((cursorWeek - startWeek) / (7 * 86400000));
      if (weeksDiff % interval !== 0) continue;
      out.push(fmt(cursor));
    }
    return out;
  }

  if (task.recurrence_type === 'monthly') {
    let cursor = new Date(start);
    while (cursor < rangeStart) cursor = addMonths(cursor, interval);
    for (; cursor <= hardEnd; cursor = addMonths(cursor, interval)) {
      if (cursor >= start) out.push(fmt(cursor));
    }
    return out;
  }

  return out;
}
