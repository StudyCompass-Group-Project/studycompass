import {
  eventsOnDate,
  eventTimeLabel,
  formatDate,
  getWeekDays,
  layoutTimedEvents,
  timeToMinutes,
  toDateKey,
  WEEKDAYS,
} from '../../utils/calendar.js'

export default function AvailabilityWeek({ date, events, onEdit }) {
  const days = getWeekDays(date)
  const start = Math.min(7, ...events.map((event) => Math.floor(timeToMinutes(event.start) / 60)))
  const end = Math.max(22, ...events.map((event) => Math.ceil(timeToMinutes(event.end) / 60)))
  const hours = Array.from({ length: end - start }, (_, index) => start + index)
  return (
    <div
      className="sc-av-week-scroll"
      role="region"
      tabIndex={0}
      aria-label="Weekly blocked time; scroll to view all days"
    >
      <div className="sc-av-week" style={{ '--av-hours': hours.length }}>
        <div className="sc-av-week-heading">
          <span>Time</span>
          {days.map((day, index) => (
            <div key={toDateKey(day)}>
              {WEEKDAYS[index]} <span>{day.getDate()}</span>
            </div>
          ))}
        </div>
        <div className="sc-av-week-body">
          <div className="sc-av-hour-labels" aria-hidden="true">
            {hours.map((hour) => (
              <span key={hour}>
                {hour % 12 || 12} {hour < 12 ? 'AM' : 'PM'}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div className="sc-av-day-column" key={toDateKey(day)}>
              {layoutTimedEvents(eventsOnDate(events, day)).map(({ event, lane, laneCount }) => (
                <button
                  key={event.id}
                  type="button"
                  className="sc-av-time-block"
                  onClick={() => onEdit(event.availabilityBlockId)}
                  aria-label={`Edit ${event.title}, ${formatDate(day)}, ${eventTimeLabel(event)}`}
                  title={`${event.title} · ${eventTimeLabel(event)}`}
                  style={{
                    top: `${((timeToMinutes(event.start) - start * 60) / 60) * 32}px`,
                    height: `${Math.max(8, ((timeToMinutes(event.end) - timeToMinutes(event.start)) / 60) * 32 - 2)}px`,
                    left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                    width: `calc(${100 / laneCount}% - 4px)`,
                  }}
                >
                  <strong>{event.title}</strong>
                  <span>
                    {event.start}–{event.end}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
