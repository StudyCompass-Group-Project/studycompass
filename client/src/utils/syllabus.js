import { fromDateKey, toDateKey } from './calendar.js'

export const SYLLABUS_STORAGE_KEY = 'studycompass.preview.syllabus.v1'
export const MAX_SYLLABUS_BYTES = 10 * 1024 * 1024
export const SYLLABUS_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'
export const DEADLINE_KINDS = ['Assignment', 'Exam', 'Quiz', 'Project', 'Other']
const MIME_TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

export function syllabusMimeType(file) {
  return MIME_TYPES[file?.name?.split('.').at(-1)?.toLowerCase()] || ''
}

export function validateSyllabusFile(file) {
  if (!file) return 'Choose a syllabus first.'
  const mime = syllabusMimeType(file)
  if (!mime || (file.type && file.type !== mime && file.type !== 'application/octet-stream'))
    return 'Choose a PDF, PNG, or JPG file.'
  if (!Number.isFinite(file.size) || file.size <= 0) return 'This file is empty. Choose a file with content.'
  if (file.size > MAX_SYLLABUS_BYTES) return 'This file is too large. The limit is 10 MB.'
  return ''
}

export function sourceMetadata(file) {
  return { name: file.name, size: file.size, type: syllabusMimeType(file), lastModified: file.lastModified || 0 }
}

export function isOriginalFile(file, source) {
  return !validateSyllabusFile(file) && file.name === source.name && file.size === source.size
    && (file.lastModified || 0) === source.lastModified
}

export function emptySyllabusState(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return { version: 1, timeZone, draft: null, courses: [] }
}

function isText(value, limit = 4000) {
  return typeof value === 'string' && value.length <= limit
}

// Drafts may contain incomplete fields while a student edits. Only reviewed
// records have to pass the required-field checks below.
function hasDraftShape(draft) {
  return Boolean(draft && isText(draft.id, 100) && draft.id && draft.isSample === true
    && draft.source && !validateSyllabusFile(draft.source)
    && Number.isFinite(draft.source.lastModified)
    && draft.course && ['name', 'code', 'instructor', 'term', 'topics', 'notes'].every(key => isText(draft.course[key]))
    && Array.isArray(draft.deadlines) && draft.deadlines.length <= 100
    && draft.deadlines.every(item => item && isText(item.id, 100) && item.id
      && ['title', 'kind', 'topic', 'date', 'time', 'notes'].every(key => isText(item[key])))
    && new Set(draft.deadlines.map(item => item.id)).size === draft.deadlines.length)
}

export function validateSyllabusReview(draft) {
  if (!hasDraftShape(draft)) return { form: 'The review data is invalid. Return to upload and start a new review.' }
  const errors = {}
  if (!draft.course.name.trim()) errors['course.name'] = 'Enter the course name.'
  if (draft.course.name.length > 160) errors['course.name'] = 'Use 160 characters or fewer.'
  for (const item of draft.deadlines) {
    const key = `deadlines.${item.id}`
    if (!item.title.trim()) errors[`${key}.title`] = 'Enter a deadline title.'
    if (!DEADLINE_KINDS.includes(item.kind)) errors[`${key}.kind`] = 'Choose a deadline type.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || toDateKey(fromDateKey(item.date)) !== item.date)
      errors[`${key}.date`] = 'Enter a valid due date, or remove this item.'
    if (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))
      errors[`${key}.time`] = 'Enter a valid time, or leave it blank if unspecified.'
  }
  return errors
}

function validateState(state) {
  if (!state || state.version !== 1 || typeof state.timeZone !== 'string'
    || (state.draft !== null && !hasDraftShape(state.draft))
    || !Array.isArray(state.courses)
    || state.courses.some(course => !hasDraftShape(course)
      || Object.keys(validateSyllabusReview(course)).length
      || typeof course.reviewedAt !== 'string' || !Number.isFinite(Date.parse(course.reviewedAt)))
    || new Set(state.courses.map(course => course.id)).size !== state.courses.length)
    throw new Error('Invalid syllabus preview data.')
}

export function readSyllabusState(storage, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(SYLLABUS_STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : emptySyllabusState(timeZone)
    validateState(state)
    if (state.timeZone !== timeZone) throw new Error('Different time zone.')
    return { ...state, error: '' }
  } catch {
    return { ...emptySyllabusState(timeZone), error: 'Saved syllabus data could not be loaded. Reload or reset the syllabus preview. Existing storage has not been changed.' }
  }
}

export function writeSyllabusState(state, storage) {
  validateState(state)
  const { version, timeZone, draft, courses } = state
  // One write commits both the reviewed course and removal of its draft.
  ;(storage ?? window.sessionStorage).setItem(SYLLABUS_STORAGE_KEY, JSON.stringify({ version, timeZone, draft, courses }))
}

export function approveSyllabus(state, draft, confirmed, now = new Date()) {
  validateState(state)
  if (!confirmed) throw new Error('Confirm that you have reviewed the course details and deadlines.')
  const errors = validateSyllabusReview(draft)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const course = {
    ...draft,
    course: Object.fromEntries(Object.entries(draft.course).map(([key, value]) => [key, value.trim()])),
    deadlines: draft.deadlines.map(item => ({ ...item, title: item.title.trim(), topic: item.topic.trim(), notes: item.notes.trim() })),
    reviewedAt: now.toISOString(),
  }
  return { ...state, draft: null, courses: [...state.courses.filter(item => item.id !== course.id), course] }
}

// Derive calendar items only from approved records, never the editable draft.
export function syllabusCalendarEvents(courses) {
  return courses.flatMap(record => record.deadlines.map(item => ({
    id: `syllabus:${record.id}:${item.id}`,
    syllabusId: record.id,
    title: item.title,
    course: [record.course.code, record.course.name].filter(Boolean).join(' · '),
    type: 'deadline',
    date: item.date,
    start: item.time,
    completed: false,
    isSample: record.isSample,
    description: [item.kind, item.topic && `Topic: ${item.topic}`, item.notes,
      record.course.instructor && `Instructor: ${record.course.instructor}`,
      record.course.term && `Term: ${record.course.term}`,
      record.course.topics && `Course topics: ${record.course.topics}`,
      record.course.notes,
      `Source: ${record.source.name}`, 'Reviewed sample data; automatic extraction is not connected.']
      .filter(Boolean).join('\n'),
  })))
}
