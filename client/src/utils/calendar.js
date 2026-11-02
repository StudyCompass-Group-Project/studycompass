export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const EVENT_TYPES = {
  study: 'Study session',
  deadline: 'Deadline',
  class: 'Class',
  commitment: 'Commitment',
}

// Construct local dates: new Date('YYYY-MM-DD') uses UTC and can show yesterday.
export function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function getWeekDays(date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function getMonthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const leadingDays = (first.getDay() + 6) % 7
  const total = Math.ceil((leadingDays + last.getDate()) / 7) * 7
  const start = startOfWeek(first)
  return Array.from({ length: total }, (_, index) => addDays(start, index))
}

export function shiftDate(date, view, direction) {
  // Use the first so Jan 31 -> February cannot overflow to March.
  return view === 'month'
    ? new Date(date.getFullYear(), date.getMonth() + direction, 1)
    : addDays(date, direction * 7)
}

export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

export function formatRange(start, end) {
  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${formatDate(start, options)} – ${formatDate(end, options)}`
}

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatTime(time) {
  const minutes = timeToMinutes(time)
  const hours = Math.floor(minutes / 60)
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

export function eventTimeLabel(event) {
  return event.type === 'deadline'
    ? `Due ${formatTime(event.start)}`
    : `${formatTime(event.start)} – ${formatTime(event.end)}`
}

export function sortEvents(events) {
  return [...events].sort(
    (a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`) ||
      a.id.localeCompare(b.id),
  )
}

export function eventsOnDate(events, date) {
  const key = toDateKey(date)
  return sortEvents(events.filter((event) => event.date === key))
}

export function eventsInRange(events, start, end) {
  const first = toDateKey(start)
  const last = toDateKey(end)
  return sortEvents(
    events.filter((event) => event.date >= first && event.date <= last),
  )
}

export function filterEvents(events, query, course) {
  const text = query.trim().toLowerCase()
  return events.filter((event) => {
    const matchesCourse = course === 'all' || event.course === course
    const searchable =
      `${event.title} ${event.course} ${event.description ?? ''}`.toLowerCase()
    return matchesCourse && searchable.includes(text)
  })
}

// Side-by-side lanes preserve overlapping sessions. A minimum visual duration
// also prevents short cards covering each other. Touching endpoints may share a lane.
export function layoutTimedEvents(events) {
  const groups = []
  let group = []
  let groupEnd = -1
  for (const event of sortEvents(events)) {
    const start = timeToMinutes(event.start)
    const end = Math.max(timeToMinutes(event.end), start + 45)
    if (start >= groupEnd && group.length) {
      groups.push(group)
      group = []
    }
    group.push({ event, start, end })
    groupEnd = group.length === 1 ? end : Math.max(groupEnd, end)
  }
  if (group.length) groups.push(group)
  return groups.flatMap((items) => {
    const laneEnds = []
    const positioned = items.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = item.end
      return { ...item, lane }
    })
    return positioned.map((item) => ({ ...item, laneCount: laneEnds.length }))
  })
}

export function getTimeBounds(events) {
  const timed = events.filter((event) => event.type !== 'deadline')
  const start = Math.min(
    8,
    ...timed.map((event) => Math.floor(timeToMinutes(event.start) / 60)),
  )
  const end = Math.min(
    24,
    Math.max(
      20,
      ...timed.map((event) =>
        Math.ceil(
          Math.max(timeToMinutes(event.end), timeToMinutes(event.start) + 45) /
            60,
        ),
      ),
    ),
  )
  return { start, end }
}
