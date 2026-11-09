import { formatDate, formatRange, getWeekDays } from '../../utils/calendar.js'
import Icon from './Icon.jsx'

export default function CalendarToolbar({
  date,
  view,
  onViewChange,
  onNavigate,
  onToday,
  isDemo,
}) {
  const days = getWeekDays(date)
  return (
    <section className="sc-calendar-toolbar" aria-label="Calendar controls">
      <div>
        <div className="sc-eyebrow-line">
          <span className="sc-eyebrow">Academic Horizon</span>
          {isDemo && <span className="sc-badge">Sample schedule</span>}
        </div>
        <h1 id="calendar-heading" aria-live="polite">
          {formatDate(date, { month: 'long', year: 'numeric' })}
        </h1>
        <p className="sc-period" aria-live="polite">
          {view === 'week' ? formatRange(days[0], days[6]) : 'Month overview'}
        </p>
      </div>
      <div className="sc-toolbar-actions">
        <div className="sc-view-switch" role="group" aria-label="Calendar view">
          {['week', 'month'].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => onViewChange(option)}
            >
              {option === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
        <div
          className="sc-date-controls"
          role="group"
          aria-label="Date navigation"
        >
          <button
            className="sc-icon-button"
            type="button"
            aria-label={`Previous ${view}`}
            onClick={() => onNavigate(-1)}
          >
            <Icon name="left" />
          </button>
          <button className="sc-button" type="button" onClick={onToday}>
            Today
          </button>
          <button
            className="sc-icon-button"
            type="button"
            aria-label={`Next ${view}`}
            onClick={() => onNavigate(1)}
          >
            <Icon name="right" />
          </button>
        </div>
      </div>
    </section>
  )
}
