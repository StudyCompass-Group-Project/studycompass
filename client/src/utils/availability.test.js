import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertStudyPlanRespectsAvailability,
  availabilityEvents,
  AVAILABILITY_STORAGE_KEY,
  findStudyPlanConflicts,
  getAvailableStudyWindows,
  readAvailability,
  summarizeAvailability,
  validateAvailability,
  validateBlockedTime,
  writeAvailability,
} from './availability.js'
import { formatTime, getWeekDays, fromDateKey, toDateKey } from './calendar.js'

const block = (overrides = {}) => ({
  id: 'work',
  title: 'Work shift',
  category: 'Work / Job',
  days: [0, 2, 4],
  start: '13:30',
  end: '16:30',
  recurring: true,
  date: '',
  ...overrides,
})
const session = (start, end, date = '2026-11-09') => ({ id: 'study-1', date, start, end })

test('validates weekdays, real dates, times, names, and recurrence without rejecting overnight shifts', () => {
  assert.deepEqual(validateBlockedTime(block()), {})
  assert.deepEqual(validateBlockedTime(block({ start: '22:00', end: '06:00' })), {})
  assert.ok(validateBlockedTime(block({ title: '  ' })).title)
  assert.ok(validateBlockedTime(block({ days: [] })).days)
  assert.ok(validateBlockedTime(block({ days: [0, 0] })).days)
  assert.ok(validateBlockedTime(block({ days: [7] })).days)
  assert.ok(validateBlockedTime(block({ recurring: 'yes' })).recurring)
  assert.ok(validateBlockedTime(block({ end: '13:30' })).end)
  assert.ok(validateBlockedTime(block({ start: '25:00' })).start)
  assert.ok(validateBlockedTime(block({ recurring: false, date: '2026-02-30' })).date)
  assert.deepEqual(validateBlockedTime(block({ recurring: false, date: '2028-02-29' })), {})
})

test('calendar commitments recur in any requested week, with stable IDs and source IDs', () => {
  const events = availabilityEvents([block()], '2026-11-09', '2026-11-15')
  assert.deepEqual(
    events.map((event) => event.date),
    ['2026-11-09', '2026-11-11', '2026-11-13'],
  )
  assert.ok(
    events.every((event) => event.type === 'commitment' && event.availabilityBlockId === 'work'),
  )
  assert.deepEqual(availabilityEvents([block()], '2026-11-09', '2026-11-15'), events)
  assert.equal(availabilityEvents([block()], '2027-01-04', '2027-01-10').length, 3)
})

test('one-time commitments occur on their date only', () => {
  const blocks = [block({ recurring: false, days: [], date: '2026-11-10' })]
  assert.equal(availabilityEvents(blocks, '2026-11-09', '2026-11-15').length, 1)
  assert.equal(availabilityEvents(blocks, '2026-11-16', '2026-11-22').length, 0)
  assert.equal(findStudyPlanConflicts([session('14:00', '15:00', '2026-11-10')], blocks).length, 1)
  assert.equal(findStudyPlanConflicts([session('14:00', '15:00', '2026-11-17')], blocks).length, 0)
})

test('overnight recurrence carries across week and year boundaries, including the preceding day', () => {
  const blocks = [block({ days: [6], start: '22:00', end: '06:00' })]
  const events = availabilityEvents(blocks, '2026-11-09', '2026-11-15')
  assert.deepEqual(
    events.map(({ date, start, end }) => ({ date, start, end })),
    [
      { date: '2026-11-09', start: '00:00', end: '06:00' },
      { date: '2026-11-15', start: '22:00', end: '24:00' },
    ],
  )
  assert.equal(findStudyPlanConflicts([session('05:30', '06:30')], blocks).length, 1)
  const once = [block({ recurring: false, date: '2026-12-31', start: '22:00', end: '02:00' })]
  assert.equal(availabilityEvents(once, '2027-01-01', '2027-01-01')[0].end, '02:00')
  assert.equal(formatTime('24:00'), 'Midnight')
})

test('midnight endpoints do not create zero-length next-day events', () => {
  const events = availabilityEvents(
    [block({ days: [0], start: '22:00', end: '00:00' })],
    '2026-11-09',
    '2026-11-10',
  )
  assert.equal(events.length, 1)
  assert.equal(events[0].end, '24:00')
})

test('overlapping blocks count once and subtract merged intervals from the selected study window', () => {
  const blocks = [
    block({ days: [0], start: '09:00', end: '12:00' }),
    block({ id: 'commute', days: [0], start: '11:00', end: '13:00' }),
  ]
  assert.deepEqual(getAvailableStudyWindows(blocks, '2026-11-09', '08:00', '17:00'), [
    { date: '2026-11-09', start: '08:00', end: '09:00' },
    { date: '2026-11-09', start: '13:00', end: '17:00' },
  ])
  const summary = summarizeAvailability(
    blocks,
    getWeekDays(fromDateKey('2026-11-09')).map(toDateKey),
  )
  assert.equal(summary.blockedHours, 4)
  assert.equal(summary.daytimeOpenHours, 101)
})

test('fully blocked windows produce no available slot; windows outside blocks remain intact', () => {
  const blocks = [block({ start: '07:00', end: '22:00' })]
  assert.deepEqual(getAvailableStudyWindows(blocks, '2026-11-09', '09:00', '17:00'), [])
  assert.deepEqual(
    getAvailableStudyWindows(blocks, '2026-11-10', '09:00', '17:00'),
    [session('09:00', '17:00', '2026-11-10')].map(({ date, start, end }) => ({ date, start, end })),
  )
  assert.throws(() => getAvailableStudyWindows(blocks, '2026-11-09', '22:00', '06:00'))
})

test('planner excludes every overlap but permits exact adjacent endpoints', () => {
  for (const candidate of [
    session('12:00', '14:00'),
    session('14:00', '15:00'),
    session('16:00', '17:00'),
    session('12:00', '18:00'),
  ]) {
    assert.throws(
      () => assertStudyPlanRespectsAvailability([candidate], [block()]),
      /overlaps blocked time/,
    )
  }
  const allowed = [session('12:00', '13:30'), session('16:30', '18:00')]
  assert.equal(assertStudyPlanRespectsAvailability(allowed, [block()]), allowed)
})

test('a proposed plan is rejected atomically against the latest edited availability', () => {
  const proposed = [session('09:00', '10:00'), session('14:00', '15:00')]
  const original = structuredClone(proposed)
  assert.equal(assertStudyPlanRespectsAvailability(proposed, []), proposed)
  assert.throws(() => assertStudyPlanRespectsAvailability(proposed, [block()]))
  assert.deepEqual(proposed, original)
  assert.equal(findStudyPlanConflicts(proposed, [block()]).length, 1)
  assert.equal(assertStudyPlanRespectsAvailability(proposed, [block({ days: [1] })]), proposed)
})

test('malformed stored rules and malformed plan candidates fail closed', () => {
  for (const invalid of [
    null,
    {},
    [null],
    [block(), block()],
    [block({ id: '' })],
    [block({ days: [9] })],
  ]) {
    assert.throws(() => validateAvailability(invalid))
  }
  for (const invalid of [
    null,
    session('25:00', '26:00'),
    session('17:00', '09:00'),
    session('10:00', '10:00'),
    session('10:00', '11:00', '2026-02-30'),
  ]) {
    assert.throws(() => assertStudyPlanRespectsAvailability([invalid], []))
  }
})

test('weekly local wall-clock hours remain stable across daylight-saving changes', () => {
  const events = availabilityEvents(
    [block({ days: [6], start: '09:00', end: '12:00' })],
    '2026-10-25',
    '2026-11-08',
  )
  assert.deepEqual(
    events.map((event) => [event.date, event.start, event.end]),
    [
      ['2026-10-25', '09:00', '12:00'],
      ['2026-11-01', '09:00', '12:00'],
      ['2026-11-08', '09:00', '12:00'],
    ],
  )
})

test('preview storage round-trips only availability and rejects damaged or wrong-zone data', () => {
  const data = new Map()
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) }
  const saved = {
    blocks: [block({ email: 'never-store@example.test', password: 'do-not-store' })],
    completed: true,
    timeZone: 'America/Los_Angeles',
  }
  writeAvailability(saved, storage)
  assert.deepEqual(readAvailability(storage, saved.timeZone).blocks, [block()])
  assert.equal(readAvailability(storage, saved.timeZone).completed, true)
  assert.ok(!data.get(AVAILABILITY_STORAGE_KEY).includes('password'))
  assert.ok(!data.get(AVAILABILITY_STORAGE_KEY).includes('email'))
  assert.ok(readAvailability(storage, 'UTC').error)
  storage.setItem(AVAILABILITY_STORAGE_KEY, '{broken')
  assert.ok(readAvailability(storage, saved.timeZone).error)
  assert.equal(storage.getItem(AVAILABILITY_STORAGE_KEY), '{broken')
  assert.throws(() =>
    writeAvailability(saved, {
      setItem: () => {
        throw new Error('Quota exceeded')
      },
    }),
  )
})
