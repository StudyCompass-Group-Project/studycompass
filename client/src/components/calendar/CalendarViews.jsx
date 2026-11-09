import {
  EVENT_TYPES,
  WEEKDAYS,
  eventsOnDate,
  eventTimeLabel,
  formatDate,
  getMonthDays,
  getTimeBounds,
  getWeekDays,
  layoutTimedEvents,
  toDateKey,
} from '../../utils/calendar.js'

function EventButton({ event, onSelect, compact = false, style }) {
  const label = `${event.title}, ${event.course || 'Personal'}, ${EVENT_TYPES[event.type]}, ${event.date}, ${eventTimeLabel(event)}${event.completed ? ', completed' : ''}`
  return (
    <button
      type="button"
      className={`sc-event sc-event-${event.type}${compact ? ' sc-event-compact' : ''}`}
      style={style}
      onClick={() => onSelect(event)}
      aria-label={label}
      title={label}
    >
      <span className="sc-event-time">
        {event.type === 'deadline' ? 'Due ' : ''}
        {event.start}
        {!compact && event.end ? `–${event.end}` : ''}
      </span>
      <strong>{event.title}</strong>
      {!compact && (
        <span className="sc-event-meta">
          {event.course || 'Personal'} ·{' '}
          {event.completed ? 'Completed' : EVENT_TYPES[event.type]}
        </span>
      )}
    </button>
  )
}

export function WeekCalendar({ date, today, events, onSelect }) {
  const days = getWeekDays(date)
  const { start, end } = getTimeBounds(events)
  const hours = Array.from({ length: end - start }, (_, index) => start + index)
  const todayKey = toDateKey(today)
  return (
    <div
      className="sc-calendar-scroll"
      role="region"
      tabIndex={0}
      aria-label="Weekly calendar; scroll horizontally on smaller screens"
    >
      <div className="sc-week-calendar" style={{ '--sc-hours': hours.length }}>
        <div className="sc-week-header">
          <span className="sc-time-zone">
            Local
            <br />
            time
          </span>
          {days.map((day, index) => (
            <div
              key={toDateKey(day)}
              className={`sc-day-heading${toDateKey(day) === todayKey ? ' sc-today' : ''}`}
            >
              <span>{WEEKDAYS[index]}</span>
              <time
                dateTime={toDateKey(day)}
                aria-current={toDateKey(day) === todayKey ? 'date' : undefined}
              >
                {day.getDate()}
              </time>
            </div>
          ))}
        </div>
        <div className="sc-deadline-row">
          <span className="sc-time-zone">Due</span>
          {days.map((day) => (
            <div className="sc-deadline-cell" key={toDateKey(day)}>
              {eventsOnDate(events, day)
                .filter((event) => event.type === 'deadline')
                .map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    compact
                    onSelect={onSelect}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="sc-week-body">
          <div className="sc-hour-labels" aria-hidden="true">
            {hours.map((hour) => (
              <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
            ))}
          </div>
          {days.map((day) => (
            <section
              key={toDateKey(day)}
              className={`sc-day-column${[0, 6].includes(day.getDay()) ? ' sc-weekend' : ''}`}
              aria-label={formatDate(day, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            >
              {layoutTimedEvents(
                eventsOnDate(events, day).filter(
                  (event) => event.type !== 'deadline',
                ),
              ).map(({ event, start: from, end: to, lane, laneCount }) => (
                <EventButton
                  key={event.id}
                  event={event}
                  onSelect={onSelect}
                  style={{
                    top: `${((from - start * 60) / 60) * 64}px`,
                    height: `${((Math.min(to, end * 60) - from) / 60) * 64 - 4}px`,
                    left: `calc(${(lane / laneCount) * 100}% + 3px)`,
                    width: `calc(${100 / laneCount}% - 6px)`,
                  }}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MonthCalendar({ date, today, events, onSelect }) {
  const days = getMonthDays(date)
  const todayKey = toDateKey(today)
  return (
    <div
      className="sc-calendar-scroll"
      role="region"
      tabIndex={0}
      aria-label="Monthly calendar; scroll horizontally on smaller screens"
    >
      <div className="sc-month-calendar">
        <div className="sc-month-header">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="sc-month-grid">
          {days.map((day) => {
            const key = toDateKey(day)
            return (
              <section
                key={key}
                className={`sc-month-day${day.getMonth() !== date.getMonth() ? ' sc-outside-month' : ''}${key === todayKey ? ' sc-today' : ''}`}
                aria-label={formatDate(day, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              >
                <time
                  dateTime={key}
                  aria-current={key === todayKey ? 'date' : undefined}
                >
                  {day.getDate()}
                </time>
                {eventsOnDate(events, day).map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    compact
                    onSelect={onSelect}
                  />
                ))}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CalendarLegend() {
  return (
    <div className="sc-legend" aria-label="Calendar legend">
      {Object.entries(EVENT_TYPES).map(([type, label]) => (
        <span key={type}>
          <i className={`sc-legend-${type}`} aria-hidden="true" />
          {label}
        </span>
      ))}
      <small>Select an item to view details</small>
    </div>
  )
}
