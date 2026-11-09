import { addDays, fromDateKey, timeToMinutes, toDateKey, WEEKDAYS } from './calendar.js'

export const CATEGORIES = [
  'Work / Job',
  'Commute',
  'Family / Personal',
  'Campus Organization',
  'Other',
]
export const AVAILABILITY_STORAGE_KEY = 'studycompass.preview.availability.v1'

function isDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    toDateKey(fromDateKey(value)) === value
  )
}

function isTime(value, allowEndOfDay = false) {
  return (
    typeof value === 'string' &&
    (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) || (allowEndOfDay && value === '24:00'))
  )
}

export function validateBlockedTime(block = {}) {
  const errors = {}
  if (typeof block.title !== 'string' || !block.title.trim())
    errors.title = 'Give this commitment a name.'
  else if (block.title.trim().length > 80) errors.title = 'Use 80 characters or fewer.'
  if (!CATEGORIES.includes(block.category)) errors.category = 'Choose a category.'
  if (typeof block.recurring !== 'boolean') errors.recurring = 'Choose whether this repeats weekly.'
  if (
    block.recurring &&
    (!Array.isArray(block.days) ||
      !block.days.length ||
      block.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(block.days).size !== block.days.length)
  )
    errors.days = 'Choose at least one day of the week.'
  if (block.recurring === false && !isDate(block.date)) errors.date = 'Choose a valid date.'
  if (!isTime(block.start)) errors.start = 'Enter a valid start time.'
  if (!isTime(block.end)) errors.end = 'Enter a valid end time.'
  else if (block.start === block.end)
    errors.end = 'Start and end must be different. Add separate blocks to cover a full day.'
  return errors
}

export function validateAvailability(blocks) {
  if (
    !Array.isArray(blocks) ||
    blocks.some(
      (block) =>
        !block ||
        typeof block.id !== 'string' ||
        !block.id ||
        Object.keys(validateBlockedTime(block)).length,
    ) ||
    new Set(blocks.map((block) => block.id)).size !== blocks.length
  ) {
    throw new Error('Blocked time contains invalid data. Review your availability before planning.')
  }
}

export function normalizeBlock(block) {
  return {
    id: block.id,
    title: block.title.trim(),
    category: block.category,
    days: block.recurring ? [...block.days].sort((a, b) => a - b) : [],
    start: block.start,
    end: block.end,
    recurring: block.recurring,
    date: block.recurring ? '' : block.date,
  }
}

// Calendar and planner both expand these same rules. Never store separate copies
// of generated commitment events. Dates/times use the device's local wall clock.
export function availabilityEvents(blocks, firstDate, lastDate) {
  validateAvailability(blocks)
  if (!isDate(firstDate) || !isDate(lastDate) || firstDate > lastDate)
    throw new Error('Invalid date range.')
  const events = []
  const lastDay = fromDateKey(lastDate)
  // Include the previous day so Sunday night shifts carry into Monday morning.
  for (
    let day = addDays(fromDateKey(firstDate), -1);
    day <= lastDay;
    day = addDays(day, 1)
  ) {
    const key = toDateKey(day)
    for (const block of blocks) {
      const matches = block.recurring
        ? block.days.includes((day.getDay() + 6) % 7)
        : block.date === key
      if (!matches) continue
      const overnight = timeToMinutes(block.end) < timeToMinutes(block.start)
      const segments = overnight
        ? [
            { date: key, start: block.start, end: '24:00' },
            { date: toDateKey(addDays(day, 1)), start: '00:00', end: block.end },
          ]
        : [{ date: key, start: block.start, end: block.end }]
      for (const segment of segments) {
        if (segment.date < firstDate || segment.date > lastDate || segment.start === segment.end)
          continue
        events.push({
          id: `availability:${block.id}:${key}:${segment.date}`,
          availabilityBlockId: block.id,
          title: block.title,
          type: 'commitment',
          course: '',
          completed: false,
          description: `Blocked study time · ${block.category} · ${block.recurring ? 'Repeats weekly' : 'One-time commitment'}${overnight ? ' · Overnight shift (shown in daily segments)' : ''}.`,
          ...segment,
        })
      }
    }
  }
  return events
}

function mergeIntervals(events) {
  const intervals = events
    .map((event) => [timeToMinutes(event.start), timeToMinutes(event.end)])
    .sort((a, b) => a[0] - b[0])
  return intervals.reduce((merged, interval) => {
    const previous = merged.at(-1)
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1])
    else merged.push([...interval])
    return merged
  }, [])
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// Subtract blocked time from an EXPLICIT study window. Unblocked hours alone
// are not permission to schedule: the generator must also respect classes,
// existing sessions, deadlines, task dependencies, breaks, and user limits.
export function getAvailableStudyWindows(blocks, date, start, end) {
  if (!isTime(start) || !isTime(end, true) || timeToMinutes(end) <= timeToMinutes(start)) {
    throw new Error('Provide a same-day study window with an end after its start.')
  }
  const blocked = mergeIntervals(availabilityEvents(blocks, date, date))
  const limit = timeToMinutes(end)
  let cursor = timeToMinutes(start)
  const windows = []
  for (const [from, to] of blocked) {
    if (to <= cursor) continue
    if (from >= limit) break
    if (from > cursor)
      windows.push({
        date,
        start: minutesToTime(cursor),
        end: minutesToTime(Math.min(from, limit)),
      })
    cursor = Math.min(limit, Math.max(cursor, to))
  }
  if (cursor < limit) windows.push({ date, start: minutesToTime(cursor), end })
  return windows
}

// Half-open intervals permit a session to finish exactly when a shift starts.
// Malformed sessions fail closed; they must never be accepted as free time.
export function findStudyPlanConflicts(sessions, blocks) {
  validateAvailability(blocks)
  if (!Array.isArray(sessions)) throw new Error('Study sessions must be an array.')
  return sessions.flatMap((session) => {
    if (
      !session ||
      !isDate(session.date) ||
      !isTime(session.start) ||
      !isTime(session.end, true) ||
      timeToMinutes(session.end) <= timeToMinutes(session.start)
    ) {
      throw new Error(
        'Study sessions must have valid dates and same-day start/end times. Split overnight sessions first.',
      )
    }
    const conflicts = availabilityEvents(blocks, session.date, session.date).filter(
      (block) =>
        timeToMinutes(session.start) < timeToMinutes(block.end) &&
        timeToMinutes(session.end) > timeToMinutes(block.start),
    )
    return conflicts.length ? [{ session, blocks: conflicts }] : []
  })
}

// Call immediately before accepting/saving a generated plan, using the latest
// shared availability. Reject the whole proposal; do not drop tasks silently.
export function assertStudyPlanRespectsAvailability(sessions, blocks) {
  const conflicts = findStudyPlanConflicts(sessions, blocks)
  if (conflicts.length) {
    const error = new Error(
      'The proposed study plan overlaps blocked time. Regenerate it using the current availability.',
    )
    error.conflicts = conflicts
    throw error
  }
  return sessions
}

export function summarizeAvailability(blocks, dates) {
  let blockedMinutes = 0
  let daytimeOpenMinutes = 0
  for (const date of dates) {
    blockedMinutes += mergeIntervals(availabilityEvents(blocks, date, date)).reduce(
      (sum, [start, end]) => sum + end - start,
      0,
    )
    daytimeOpenMinutes += getAvailableStudyWindows(blocks, date, '07:00', '22:00').reduce(
      (sum, window) => sum + timeToMinutes(window.end) - timeToMinutes(window.start),
      0,
    )
  }
  return { blockedHours: blockedMinutes / 60, daytimeOpenHours: daytimeOpenMinutes / 60 }
}

export function blockDaysLabel(block) {
  return block.recurring ? block.days.map((day) => WEEKDAYS[day]).join(', ') : block.date
}

export function readAvailability(
  storage,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(AVAILABILITY_STORAGE_KEY)
    if (!raw) return { blocks: [], completed: false, timeZone, error: '' }
    const saved = JSON.parse(raw)
    if (
      saved.version !== 1 ||
      typeof saved.completed !== 'boolean' ||
      saved.timeZone !== timeZone
    ) {
      throw new Error('Saved availability has an unsupported format or a different time zone.')
    }
    validateAvailability(saved.blocks)
    return {
      blocks: saved.blocks.map(normalizeBlock),
      completed: saved.completed,
      timeZone,
      error: '',
    }
  } catch {
    return {
      blocks: [],
      completed: false,
      timeZone,
      error:
        'Saved availability could not be loaded. Reload this page, or explicitly reset this preview to start over. Existing storage has not been changed.',
    }
  }
}

export function writeAvailability({ blocks, completed, timeZone }, storage) {
  validateAvailability(blocks)
  const value = {
    version: 1,
    blocks: blocks.map(normalizeBlock),
    completed: Boolean(completed),
    timeZone,
  }
  // Let the caller handle blocked storage/quota errors before changing app state.
  ;(storage ?? window.sessionStorage).setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(value))
}
