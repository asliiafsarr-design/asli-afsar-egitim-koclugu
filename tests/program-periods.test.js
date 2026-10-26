const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split(/\r?\n/);
function sourceLine(prefix) {
  const line = lines.find(x => x.trimStart().startsWith(prefix));
  assert.ok(line, 'Missing production helper: ' + prefix);
  return line.trim();
}
function sourceBlock(prefix) {
  const start = lines.findIndex(x => x.trimStart().startsWith(prefix));
  assert.notEqual(start, -1, 'Missing production helper: ' + prefix);
  let end = start + 1;
  while (end < lines.length && lines[end] !== '}') end++;
  assert.ok(end < lines.length, 'Unclosed production helper: ' + prefix);
  return lines.slice(start, end + 1).join('\n');
}
const helpers = [
  sourceLine('function programCycleRange('),
  sourceLine('function programStartKeyForDate('),
  sourceLine('function programPeriodContainsDate('),
  sourceBlock('function activePortalProgramWeekKey(')
].join('\n');
function makeContext(rows, today) {
  const ctx = {
    db: { programs: rows },
    todayISO: () => today,
    currentProgramCycleKey: () => '2026-10-26',
    localISODate: d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  };
  vm.createContext(ctx);
  vm.runInContext(helpers, ctx);
  return ctx;
}

test('production helper allows any weekday and includes exactly seven calendar days', () => {
  const ctx = makeContext([], '2026-10-28');
  for (const start of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']) {
    const p = ctx.programCycleRange(start);
    assert.equal(p.start, start);
    const expectedEnd = new Date(start + 'T12:00:00');
    expectedEnd.setDate(expectedEnd.getDate() + 6);
    assert.equal(p.end, ctx.localISODate(expectedEnd));
    assert.equal(ctx.programPeriodContainsDate(start, p.end), true);
    const next = new Date(expectedEnd);
    next.setDate(next.getDate() + 1);
    assert.equal(ctx.programPeriodContainsDate(start, ctx.localISODate(next)), false);
  }
});

test('Wednesday 28 October period ends Tuesday 3 November; next day is the next start', () => {
  const ctx = makeContext([], '2026-10-28');
  const p = ctx.programCycleRange('2026-10-28');
  assert.equal(p.end, '2026-11-03');
  assert.equal(p.boundary, '2026-11-04');
  assert.equal(ctx.programStartKeyForDate('student-a','2026-11-04'), '2026-11-04');
});

test('student portal picks the active period for that student only', () => {
  const rows = [
    {student:'Belemir',weekKey:'2026-10-26'},
    {student:'Elmas Kaya',weekKey:'2026-10-27'},
    {student:'Zeynep Rana',weekKey:'2026-10-28'},
    {student:'Test Student',weekKey:'2026-10-29'}
  ];
  const ctx = makeContext(rows, '2026-10-31');
  assert.equal(ctx.activePortalProgramWeekKey('Test Student'), '2026-10-29');
  assert.equal(ctx.activePortalProgramWeekKey('Zeynep Rana'), '2026-10-28');
  assert.equal(ctx.activePortalProgramWeekKey('Unknown'), '2026-10-26');
});

test('when periods overlap, the latest-starting period is selected', () => {
  const rows = [
    {student:'S1',weekKey:'2026-10-26'},
    {student:'S1',weekKey:'2026-10-30'}
  ];
  const ctx = makeContext(rows, '2026-10-31');
  assert.equal(ctx.activePortalProgramWeekKey('S1'), '2026-10-30');
});

test('invalid date does not become a valid selected program start', () => {
  const ctx = makeContext([], '2026-10-26');
  assert.equal(ctx.programStartKeyForDate('S1','not-a-date'), '2026-10-26');
});
