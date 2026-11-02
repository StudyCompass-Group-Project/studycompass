import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addDays,
  eventsInRange,
  filterEvents,
  fromDateKey,
  getMonthDays,
  getTimeBounds,
  getWeekDays,
  layoutTimedEvents,
  shiftDate,
  toDateKey,
} from './calendar.js'

test('Sunday belongs to the Monday-start week across year boundaries', () => {
  assert.deepEqual(getWeekDays(fromDateKey('2027-01-03')).map(toDateKey), [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ])
})

test('month grids include leap day and complete surrounding weeks', () => {
  const leap = getMonthDays(fromDateKey('2028-02-15')).map(toDateKey)
  assert.equal(leap.length % 7, 0)
  assert.equal(leap[0], '2028-01-31')
  assert.ok(leap.includes('2028-02-29'))
  assert.equal(leap.at(-1), '2028-03-05')
  assert.equal(getMonthDays(fromDateKey('2026-03-15')).length, 42)
})

test('month navigation does not skip February from January 31', () => {
  const february = shiftDate(fromDateKey('2027-01-31'), 'month', 1)
  assert.equal(toDateKey(february), '2027-02-01')
  assert.equal(toDateKey(shiftDate(february, 'month', -1)), '2027-01-01')
  assert.equal(
    toDateKey(shiftDate(fromDateKey('2026-12-31'), 'month', 1)),
    '2027-01-01',
  )
})

test('date keys and calendar arithmetic remain local through daylight saving', () => {
  // Run this suite with TZ=America/Los_Angeles as well as UTC.
  for (const key of ['2026-03-08', '2026-11-01', '2028-02-29']) {
    const date = fromDateKey(key)
    assert.equal(date.getHours(), 0)
    assert.equal(toDateKey(date), key)
    assert.equal(toDateKey(addDays(addDays(date, 1), -1)), key)
  }
  assert.deepEqual(getWeekDays(fromDateKey('2026-11-01')).map(toDateKey), [
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ])
})

test('overlapping events get distinct lanes; touching sessions reuse a lane', () => {
  const make = (id, start, end) => ({ id, date: '2026-11-02', start, end })
  const events = [
    make('a', '09:00', '10:00'),
    make('b', '09:30', '10:30'),
    make('c', '10:00', '11:00'),
    make('d', '11:00', '12:00'),
  ]
  const positions = layoutTimedEvents(events)
  assert.deepEqual(
    positions.map(({ lane, laneCount }) => [lane, laneCount]),
    [
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ],
  )
  assert.equal(events[0].lane, undefined)
})

test('early and late sessions expand the timetable; deadlines stay separate', () => {
  assert.deepEqual(
    getTimeBounds([
      { type: 'study', start: '06:30', end: '07:30' },
      { type: 'study', start: '21:00', end: '22:15' },
      { type: 'deadline', start: '23:59' },
    ]),
    { start: 6, end: 23 },
  )
  assert.deepEqual(getTimeBounds([]), { start: 8, end: 20 })
})

test('search and course filters intersect without changing the source', () => {
  const events = [
    {
      id: 'b',
      title: 'Lab report',
      course: 'BIO 120',
      date: '2026-11-02',
      start: '17:00',
    },
    {
      id: 'a',
      title: 'Midterm study',
      course: 'CS 101',
      date: '2026-11-02',
      start: '09:00',
    },
    {
      id: 'c',
      title: 'Practice',
      description: 'Midterm revision',
      course: 'BIO 120',
      date: '2026-11-03',
      start: '11:00',
    },
  ]
  assert.deepEqual(
    filterEvents(events, '  MIDTERM ', 'BIO 120').map((event) => event.id),
    ['c'],
  )
  assert.deepEqual(
    eventsInRange(
      events,
      fromDateKey('2026-11-02'),
      fromDateKey('2026-11-02'),
    ).map((event) => event.id),
    ['a', 'b'],
  )
  assert.equal(events[0].id, 'b')
})
