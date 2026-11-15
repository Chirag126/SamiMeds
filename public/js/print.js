import { api, h, mount, shortDate, MOODS } from './common.js';

document.getElementById('print-btn').addEventListener('click', () => window.print());

const r = await api('/api/reports/doctor');
const o = r.stats.overall;
const moodCounts = r.stats.moods.reduce((acc, m) => ({ ...acc, [m.mood]: (acc[m.mood] || 0) + 1 }), {});

mount(document.getElementById('report'),
  h('header', {},
    h('div', {}, h('h1', {}, `Patient summary: ${r.circle.elderName}`), h('p', {}, 'Prepared by the family with SamiMeds')),
    h('div', { class: 'meta' },
      h('p', {}, `Generated ${new Date(r.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`),
      h('p', {}, `Period: ${shortDate(r.stats.from)} – ${shortDate(r.stats.to)}`),
      r.circle.emergencyPhone && h('p', {}, `Contact: ${r.circle.emergencyPhone}`))),

  h('h2', {}, 'Medicine adherence (last 30 days)'),
  h('div', { class: 'summary' },
    h('div', {}, h('b', {}, o.rate == null ? '–' : `${o.rate}%`), 'doses taken'),
    h('div', {}, h('b', {}, `${o.taken}/${o.total}`), 'taken / due'),
    h('div', {}, h('b', {}, String(o.onTime)), 'on time (≤30 min)'),
    h('div', {}, h('b', {}, String(o.missed)), 'missed')),

  h('h2', {}, 'Current medicines'),
  r.medicines.length
    ? h('table', {},
      h('thead', {}, h('tr', {}, ['Medicine', 'Strength', 'Each dose', 'Times', 'Instructions', 'For', 'Taken'].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, r.medicines.map((m) => h('tr', {},
        h('td', {}, m.name), h('td', {}, m.dose || '–'), h('td', {}, m.pillDescription || '–'), h('td', {}, m.times.join(', ')),
        h('td', {}, m.instructions || '–'), h('td', {}, m.purpose || '–'),
        h('td', {}, m.adherence?.rate == null ? '–' : `${m.adherence.rate}% (${m.adherence.missed} missed)`)))))
    : h('p', {}, 'No medicines recorded.'),

  h('h2', {}, 'Missed doses'),
  r.stats.missed.length
    ? h('ul', {}, r.stats.missed.slice(0, 15).map((d) => h('li', {}, `${shortDate(d.date)} ${d.time12} – ${d.medicineName}`)))
    : h('p', {}, 'None in this period.'),

  h('h2', {}, 'How they felt (daily check-in)'),
  r.stats.moods.length
    ? h('p', {}, Object.entries(moodCounts).map(([k, n]) => `${MOODS[k].label}: ${n} day(s)`).join(' · '))
    : h('p', {}, 'No check-ins recorded.'),

  h('h2', {}, 'Doctor visits'),
  r.appointments.length
    ? h('table', {},
      h('thead', {}, h('tr', {}, ['Date', 'Doctor', 'Specialty', 'Status', 'Notes'].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, r.appointments.map((a) => h('tr', {},
        h('td', {}, `${shortDate(a.date)} ${a.time12}`), h('td', {}, a.doctor), h('td', {}, a.specialty || '–'),
        h('td', {}, a.status), h('td', {}, a.notes || '–')))))
    : h('p', {}, 'No visits recorded.'),

  h('h2', {}, 'Caregivers'),
  h('ul', {}, r.caregivers.map((c) => h('li', {}, `${c.name}${c.relation ? ` (${c.relation})` : ''} – ${c.role}${c.phone ? `, ${c.phone}` : ''}${c.email ? `, ${c.email}` : ''}`))),

  h('p', { class: 'footer-note' }, 'Adherence is based on doses confirmed in SamiMeds by the patient or caregivers. Please confirm details with the patient.'));
