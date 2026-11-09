// Hora local del proceso servidor (incluida su configuración TZ y horario de verano).
export function petDayNight(now = new Date()) {
  const hour = now.getHours();
  const phase = hour >= 8 && hour < 20 ? 'day' : 'night';
  const next = new Date(now);
  if (hour < 8) next.setHours(8, 0, 0, 0);
  else if (hour < 20) next.setHours(20, 0, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(8, 0, 0, 0); }
  return { phase, serverTime: now.getTime(), nextTransition: next.getTime() };
}
