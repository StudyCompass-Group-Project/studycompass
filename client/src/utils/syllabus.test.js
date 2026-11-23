import test from 'node:test'
import assert from 'node:assert/strict'
import { createSampleExtraction, extractSyllabus } from '../services/syllabusExtraction.js'
import {
  MAX_SYLLABUS_BYTES, SYLLABUS_STORAGE_KEY, approveSyllabus, emptySyllabusState,
  isOriginalFile, readSyllabusState, syllabusCalendarEvents, validateSyllabusFile,
  validateSyllabusReview, writeSyllabusState,
} from './syllabus.js'
import { eventTimeLabel } from './calendar.js'

const file = { name: 'course.pdf', type: 'application/pdf', size: 2048, lastModified: 42 }
const now = new Date(2026, 10, 23, 12)
const sample = (id = 'course-one') => createSampleExtraction(file, now, id)
function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('accepts supported files, empty browser MIME, and exactly the size limit', () => {
  assert.equal(validateSyllabusFile(file), '')
  assert.equal(validateSyllabusFile({ ...file, name: 'COURSE.PDF', type: '', size: MAX_SYLLABUS_BYTES }), '')
  assert.equal(validateSyllabusFile({ ...file, name: 'course.PNG', type: 'image/png' }), '')
  assert.equal(validateSyllabusFile({ ...file, name: 'course.jpeg', type: 'image/jpeg' }), '')
  assert.equal(validateSyllabusFile({ ...file, type: 'application/octet-stream' }), '')
})

test('rejects missing, empty, oversized, unsupported, and mismatched files', () => {
  for (const bad of [undefined, { ...file, size: 0 }, { ...file, size: MAX_SYLLABUS_BYTES + 1 },
    { ...file, name: 'notes.docx' }, { ...file, type: 'text/html' }])
    assert.ok(validateSyllabusFile(bad))
})

test('fixtures are clearly sample data, have local dates, and preserve missing times', () => {
  const draft = sample()
  assert.equal(draft.isSample, true)
  assert.match(draft.course.name, /sample/)
  assert.equal(draft.deadlines[0].date, '2026-11-24')
  assert.equal(draft.deadlines[2].date, '2026-12-03')
  assert.equal(draft.deadlines[1].time, '')
  assert.deepEqual(validateSyllabusReview(draft), {})
})

test('original-file reattachment checks metadata and allowed format', () => {
  assert.ok(isOriginalFile(file, sample().source))
  assert.equal(isOriginalFile({ ...file, name: 'wrong.pdf' }, sample().source), false)
  assert.equal(isOriginalFile({ ...file, lastModified: 43 }, sample().source), false)
})

test('review validation rejects missing names, invalid calendar dates, and invalid times', () => {
  const draft = sample()
  draft.course.name = ' '
  draft.deadlines[0].title = ''
  draft.deadlines[0].date = '2026-02-30'
  draft.deadlines[0].time = '24:00'
  const errors = validateSyllabusReview(draft)
  assert.ok(errors['course.name'])
  assert.ok(errors['deadlines.assignment.title'])
  assert.ok(errors['deadlines.assignment.date'])
  assert.ok(errors['deadlines.assignment.time'])
})

test('drafts cannot populate the calendar and approval requires explicit confirmation', () => {
  const state = { ...emptySyllabusState('UTC'), draft: sample() }
  assert.deepEqual(syllabusCalendarEvents(state.courses), [])
  assert.throws(() => approveSyllabus(state, state.draft, false), /Confirm/)
  assert.equal(state.courses.length, 0)
})

test('approval keeps exact edits and removed items out of the derived calendar', () => {
  const draft = sample()
  draft.course.name = ' Project Design '
  draft.course.code = 'COMP 490'
  draft.course.topics = 'Software requirements\nTesting'
  draft.deadlines = draft.deadlines.slice(0, 2)
  draft.deadlines[0] = { ...draft.deadlines[0], title: 'Final presentation', date: '2027-01-06', time: '' }
  const state = approveSyllabus({ ...emptySyllabusState('UTC'), draft }, draft, true, now)
  const events = syllabusCalendarEvents(state.courses)
  assert.equal(state.draft, null)
  assert.equal(events.length, 2)
  assert.equal(events[0].title, 'Final presentation')
  assert.equal(events[0].course, 'COMP 490 · Project Design')
  assert.equal(events[0].date, '2027-01-06')
  assert.equal(events[0].start, '')
  assert.match(events[0].description, /Software requirements/)
  assert.match(eventTimeLabel(events[0]), /time not specified/)
  assert.equal(draft.course.name, ' Project Design ')
})

test('approval supports courses with no deadlines without inventing calendar items', () => {
  const draft = { ...sample(), deadlines: [] }
  const state = approveSyllabus(emptySyllabusState('UTC'), draft, true)
  assert.equal(state.courses.length, 1)
  assert.deepEqual(syllabusCalendarEvents(state.courses), [])
})

test('repeated approval is idempotent and additional syllabi keep existing courses', () => {
  const draft = sample()
  const first = approveSyllabus(emptySyllabusState('UTC'), draft, true)
  const repeated = approveSyllabus(first, draft, true)
  assert.equal(repeated.courses.length, 1)
  const second = approveSyllabus(repeated, sample('course-two'), true)
  assert.equal(second.courses.length, 2)
  assert.equal(syllabusCalendarEvents(second.courses).length, 6)
  assert.equal(new Set(syllabusCalendarEvents(second.courses).map(event => event.id)).size, 6)
  assert.equal(first.courses.length, 1)
})

test('refresh restores incomplete draft fields and approved courses separately', () => {
  const storage = memoryStorage()
  const state = approveSyllabus(emptySyllabusState('UTC'), sample(), true)
  state.draft = sample('unfinished')
  state.draft.deadlines[0].date = ''
  writeSyllabusState(state, storage)
  const restored = readSyllabusState(storage, 'UTC')
  assert.equal(restored.error, '')
  assert.equal(restored.draft.deadlines[0].date, '')
  assert.equal(syllabusCalendarEvents(restored.courses).length, 3)
  assert.ok(validateSyllabusReview(restored.draft)['deadlines.assignment.date'])
})

test('failed persistence leaves the previous approved schedule and draft intact', () => {
  const storage = memoryStorage()
  const before = { ...approveSyllabus(emptySyllabusState('UTC'), sample(), true), draft: sample('next') }
  writeSyllabusState(before, storage)
  const raw = storage.getItem(SYLLABUS_STORAGE_KEY)
  const failing = { ...storage, setItem() { throw new Error('Quota exceeded') } }
  const next = approveSyllabus(before, before.draft, true)
  assert.throws(() => writeSyllabusState(next, failing), /Quota/)
  assert.equal(storage.getItem(SYLLABUS_STORAGE_KEY), raw)
  assert.equal(before.courses.length, 1)
  assert.ok(before.draft)
})

test('malformed, unsupported, and different-time-zone storage fails closed without rewriting', () => {
  for (const raw of ['not json', 'null', JSON.stringify({ version: 2 }),
    JSON.stringify({ ...emptySyllabusState('UTC'), courses: [{}] }),
    JSON.stringify(emptySyllabusState('Asia/Tokyo'))]) {
    const storage = memoryStorage()
    storage.setItem(SYLLABUS_STORAGE_KEY, raw)
    const result = readSyllabusState(storage, 'UTC')
    assert.ok(result.error)
    assert.deepEqual(result.courses, [])
    assert.equal(storage.getItem(SYLLABUS_STORAGE_KEY), raw)
  }
})

test('invalid reviewed records and duplicate deadline IDs cannot be saved', () => {
  const state = approveSyllabus(emptySyllabusState('UTC'), sample(), true)
  state.courses[0].deadlines[0].date = ''
  assert.throws(() => writeSyllabusState(state, memoryStorage()), /Invalid/)
  const draft = sample()
  draft.deadlines[1].id = draft.deadlines[0].id
  assert.ok(validateSyllabusReview(draft).form)
})

test('processing can be cancelled and cannot return a late result', async () => {
  const controller = new AbortController()
  const pending = extractSyllabus(file, { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(extractSyllabus(file, { signal: controller.signal }), { name: 'AbortError' })
})
