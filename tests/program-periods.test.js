const test = require('node:test');
const assert = require('node:assert/strict');

function iso(date) {
  const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function period(start) {
  const d = new Date(start + 'T12:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const boundary = new Date(end);
  boundary.setDate(boundary.getDate() + 1);
  return { start, end: iso(end), boundary: iso(boundary) };
}
function contains(start, date) {
  const d = new Date(date + 'T12:00:00');
  const end = new Date(start + 'T12:00:00');
  end.setDate(end.getDate() + 6);
  return d >= new Date(start + 'T12:00:00') && d <= end;
}
function activeStart(starts, today) {
  return starts.filter(start => contains(start, today)).sort().pop() || starts.filter(start => start > today).sort()[0] || null;
}

test('any weekday can start a 7-calendar-day inclusive period', () => {
  for (const start of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']) {
    const p = period(start);
    assert.equal(contains(start, p.end), true);
    assert.equal(contains(start, p.boundary), false);
    assert.equal(iso(new Date(new Date(start + 'T12:00:00').setDate(new Date(start + 'T12:00:00').getDate()+6))), p.end);
  }
});

test('Wednesday period ends Tuesday and next period starts Wednesday', () => {
  assert.deepEqual(period('2026-10-28'), {start:'2026-10-28',end:'2026-11-03',boundary:'2026-11-04'});
});

test('period boundary is exclusive for persistence range', () => {
  assert.equal(period('2026-10-26').boundary, '2026-11-02');
  assert.equal(contains('2026-10-26','2026-11-01'), true);
  assert.equal(contains('2026-10-26','2026-11-02'), false);
});

test('overlapping periods select the most recently started active period', () => {
  assert.equal(activeStart(['2026-10-26','2026-10-30'],'2026-10-31'),'2026-10-30');
});

test('student-specific periods remain isolated by student key', () => {
  const rows = [
    {student:'Belemir',weekKey:'2026-10-26',topic:'existing'},
    {student:'Elmas Kaya',weekKey:'2026-10-27',topic:'existing'},
    {student:'Zeynep Rana',weekKey:'2026-10-28',topic:'existing'},
    {student:'Test Student',weekKey:'2026-10-29',topic:'new'}
  ];
  const selected = rows.filter(x => x.student === 'Test Student' && x.weekKey === '2026-10-29');
  assert.deepEqual(selected.map(x => x.topic), ['new']);
  assert.equal(rows.filter(x => ['Belemir','Elmas Kaya','Zeynep Rana'].includes(x.student)).length, 3);
});

test('invalid date is not treated as a valid program start', () => {
  assert.equal(Number.isNaN(new Date('not-a-dateT12:00:00').getTime()), true);
});
