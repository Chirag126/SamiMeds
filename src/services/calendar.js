/** "Add to Google Calendar" link for an appointment (no OAuth needed). */
export function googleCalendarLink(appointment, timezone, durationMinutes = 60) {
  const start = `${appointment.date.replaceAll('-', '')}T${appointment.time.replace(':', '')}00`;
  const [h, m] = appointment.time.split(':').map(Number);
  const endTotal = h * 60 + m + durationMinutes;
  // Appointments ending after midnight are clamped to 23:59 — doctors rarely see patients then.
  const endMinutes = Math.min(endTotal, 23 * 60 + 59);
  const end = `${appointment.date.replaceAll('-', '')}T${String(Math.floor(endMinutes / 60)).padStart(2, '0')}${String(endMinutes % 60).padStart(2, '0')}00`;

  const details = [
    appointment.specialty && `Specialty: ${appointment.specialty}`,
    appointment.checklist?.length && `Bring: ${appointment.checklist.join(', ')}`,
    appointment.notes,
    'Added from SamiMeds',
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Doctor visit: ${appointment.doctor}`,
    dates: `${start}/${end}`,
    ctz: timezone,
    details,
    location: appointment.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
