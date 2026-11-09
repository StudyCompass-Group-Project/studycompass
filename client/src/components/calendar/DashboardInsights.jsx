import {
  addDays,
  eventsInRange,
  eventsOnDate,
  eventTimeLabel,
  formatDate,
  fromDateKey,
  getWeekDays,
  timeToMinutes,
} from '../../utils/calendar.js'
import Icon from './Icon.jsx'

function InsightHeading({ eyebrow, title, detail }) {
  return (
    <div className="sc-insight-heading">
      <div>
        <p className="sc-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {detail && <span className="sc-badge">{detail}</span>}
    </div>
  )
}

export default function DashboardInsights({
  events,
  date,
  today,
  onSelect,
  isDemo,
}) {
  const days = getWeekDays(date)
  const sessions = eventsInRange(events, days[0], days[6]).filter(
    (event) => event.type === 'study',
  )
  const plannedMinutes = sessions.reduce(
    (sum, event) => sum + timeToMinutes(event.end) - timeToMinutes(event.start),
    0,
  )
  const completedMinutes = sessions
    .filter((event) => event.completed)
    .reduce(
      (sum, event) =>
        sum + timeToMinutes(event.end) - timeToMinutes(event.start),
      0,
    )
  const progress = plannedMinutes
    ? Math.round((completedMinutes / plannedMinutes) * 100)
    : 0
  const todayEvents = eventsOnDate(events, today)
  const deadlines = eventsInRange(events, today, addDays(today, 6)).filter(
    (event) => event.type === 'deadline' && !event.completed,
  )

  return (
    <aside className="sc-insights" aria-label="Schedule overview">
      <section className="sc-card sc-insight-card">
        <InsightHeading
          eyebrow="Course planning"
          title="Sync New Syllabus"
          detail="Coming soon"
        />
        <div className="sc-upload-placeholder">
          <Icon name="upload" size={26} />
          <strong>Bring your courses together</strong>
          <p>Upload a syllabus to review assignments and due dates.</p>
        </div>
        <p className="sc-muted">
          Syllabus upload will be connected in a later task.
        </p>
      </section>

      <section className="sc-card sc-insight-card">
        <InsightHeading
          eyebrow="Study progress"
          title="Weekly Focus"
          detail={`${progress}%`}
        />
        <p className="sc-muted">
          {formatDate(days[0])} – {formatDate(days[6])}
          {isDemo ? ' · Sample data' : ''}
        </p>
        <div className="sc-focus-metric">
          <strong>{(completedMinutes / 60).toFixed(1)}</strong>
          <span>/ {(plannedMinutes / 60).toFixed(1)} hrs completed</span>
        </div>
        <progress
          className="sc-progress"
          value={completedMinutes}
          max={plannedMinutes || 1}
          aria-label="Completed study time in the selected week"
        />
        <div className="sc-focus-summary">
          <span>{sessions.length} study sessions</span>
          <strong>
            {((plannedMinutes - completedMinutes) / 60).toFixed(1)} hrs
            remaining
          </strong>
        </div>
      </section>

      <section className="sc-card sc-insight-card">
        <InsightHeading
          eyebrow="Daily sequence"
          title="Today’s Flow"
          detail={`${todayEvents.length} ${todayEvents.length === 1 ? 'item' : 'items'}`}
        />
        <p className="sc-muted">
          {formatDate(today, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </p>
        {todayEvents.length ? (
          <ul className="sc-flow-list">
            {todayEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  className="sc-flow-item"
                  onClick={() => onSelect(event)}
                >
                  <Icon name={event.completed ? 'check' : 'clock'} size={18} />
                  <span>
                    <strong className={event.completed ? 'sc-completed' : ''}>
                      {event.title}
                    </strong>
                    <small>{eventTimeLabel(event)}</small>
                  </span>
                  <span className="sc-status">
                    {event.completed
                      ? 'Done'
                      : event.type === 'deadline'
                        ? 'Due'
                        : 'Planned'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sc-insight-empty">No items scheduled for today.</p>
        )}
      </section>

      <section className="sc-card sc-insight-card">
        <InsightHeading
          eyebrow="Upcoming deadlines"
          title="Next 7 Days"
          detail={`${deadlines.length} due`}
        />
        {deadlines.length ? (
          <ul className="sc-deadline-list">
            {deadlines.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => onSelect(event)}>
                  <span className="sc-eyebrow">
                    {event.course || 'Personal'}
                  </span>
                  <strong>{event.title}</strong>
                  <span>
                    {formatDate(fromDateKey(event.date))} ·{' '}
                    {eventTimeLabel(event)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sc-insight-empty">
            No deadlines from today through {formatDate(addDays(today, 6))}.
          </p>
        )}
      </section>
    </aside>
  )
}
