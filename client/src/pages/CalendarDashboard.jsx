import { useEffect, useState } from 'react'
import CalendarToolbar from '../components/calendar/CalendarToolbar.jsx'
import {
  CalendarLegend,
  MonthCalendar,
  WeekCalendar,
} from '../components/calendar/CalendarViews.jsx'
import DashboardInsights from '../components/calendar/DashboardInsights.jsx'
import DashboardSidebar from '../components/calendar/DashboardSidebar.jsx'
import EventDetailsDialog from '../components/calendar/EventDetailsDialog.jsx'
import Icon from '../components/calendar/Icon.jsx'
import {
  addDays,
  eventsInRange,
  filterEvents,
  getMonthDays,
  getWeekDays,
  shiftDate,
  toDateKey,
  fromDateKey,
} from '../utils/calendar.js'
import { availabilityEvents, findStudyPlanConflicts } from '../utils/availability.js'
import './CalendarDashboard.css'

// Later, pass saved events plus loading/error/onRetry from the API layer.
// This page owns display state only; it never writes back to the schedule.
export default function CalendarDashboard({
  events = [],
  isDemo = false,
  loading = false,
  error = '',
  onRetry,
  availability = [],
  availabilityPreview = false,
  syllabusEnabled = false,
  reviewedCourses = [],
  initialDate,
}) {
  const [today] = useState(() => new Date())
  const [date, setDate] = useState(() => initialDate ? fromDateKey(initialDate) : today)
  const [view, setView] = useState('week')
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    document.title = 'StudyCompass | Calendar dashboard'
    document.getElementById('calendar-dashboard')?.focus()
  }, [])

  const courses = [
    ...new Set(events.map((event) => event.course).filter(Boolean)),
  ].sort()
  const days = view === 'week' ? getWeekDays(date) : getMonthDays(date)
  // Expand recurrence for the visible range AND the dashboard's today/next-week
  // summaries, so navigating never freezes commitments to their creation week.
  const visibleBlocked = availabilityEvents(availability, toDateKey(days[0]), toDateKey(days.at(-1)))
  const summaryBlocked = availabilityEvents(availability, toDateKey(getWeekDays(today)[0]), toDateKey(addDays(today, 7)))
  const blockedEvents = [...new Map([...visibleBlocked, ...summaryBlocked].map(event => [event.id, event])).values()]
  const allEvents = [...events, ...blockedEvents]
  const matches = [
    ...filterEvents(events, query, course),
    // Personal blocked time remains visible when filtering a particular course.
    ...filterEvents(blockedEvents, query, 'all'),
  ]
  const visibleEvents = eventsInRange(matches, days[0], days.at(-1))
  const planConflicts = findStudyPlanConflicts(events.filter(event => event.type === 'study'), availability)
  const hasFilters = query.trim() !== '' || course !== 'all'
  const CalendarView = view === 'week' ? WeekCalendar : MonthCalendar

  function clearFilters() {
    setQuery('')
    setCourse('all')
  }

  return (
    <div className="sc-dashboard">
      <a href="#calendar-dashboard" className="sc-skip-link" onClick={event => {
        event.preventDefault(); document.getElementById('calendar-dashboard').focus()
      }}>
        Skip to calendar
      </a>
      <DashboardSidebar isDemo={isDemo} availabilityEnabled={availabilityPreview} syllabusEnabled={syllabusEnabled} />
      <div className="sc-workspace">
        <header className="sc-topbar">
          <label className="sc-search">
            <Icon name="search" size={18} />
            <span className="sc-sr-only">Search calendar items</span>
            <input
              type="search"
              placeholder="Search assignments, sessions, courses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="sc-topbar-label">
            <Icon name="book" size={18} />
            Your study workspace
          </span>
        </header>
        <main id="calendar-dashboard" className="sc-main" tabIndex={-1}>
          {syllabusEnabled && reviewedCourses.length > 0 && <section className="sc-syllabus-summary" aria-labelledby="reviewed-courses-heading">
            <div className="sc-syllabus-summary-heading"><div><h2 id="reviewed-courses-heading">Reviewed syllabus information</h2>
              <p>Confirmed preview data · {events.length} deadlines from {reviewedCourses.length} {reviewedCourses.length === 1 ? 'syllabus' : 'syllabi'}. Automatic extraction is not connected.</p></div>
              <a className="sc-button" href="#/syllabus-upload">Upload another syllabus</a></div>
            {reviewedCourses.map(record => <details key={record.id}><summary>{record.course.code ? `${record.course.code} · ` : ''}{record.course.name}</summary>
              <dl><div><dt>Instructor</dt><dd>{record.course.instructor || 'Not supplied'}</dd></div><div><dt>Term</dt><dd>{record.course.term || 'Not supplied'}</dd></div>
                <div><dt>Topics</dt><dd>{record.course.topics || 'Not supplied'}</dd></div><div><dt>Course notes</dt><dd>{record.course.notes || 'None'}</dd></div>
                <div><dt>Source</dt><dd>{record.source.name}</dd></div></dl>
              <p>{record.deadlines.length} confirmed {record.deadlines.length === 1 ? 'deadline' : 'deadlines'}{!record.deadlines.length && ' · No dated calendar items for this course'}.</p>
            </details>)}
          </section>}
          {availabilityPreview && <div className="sc-availability-notice">
            <strong>Shared availability preview</strong>
            <span>Your blocked hours come from onboarding and are saved only in this browser tab.</span>
            <a href="#/onboarding-study-availability">Edit blocked hours</a>
          </div>}
          {planConflicts.length > 0 && <div className="sc-availability-conflict" role="alert">
            {planConflicts.length} study {planConflicts.length === 1 ? 'session overlaps' : 'sessions overlap'} blocked time.
            {' '}Review or regenerate the plan. Existing sessions have not been moved or deleted.
          </div>}
          <CalendarToolbar
            date={date}
            view={view}
            isDemo={isDemo}
            onViewChange={setView}
            onNavigate={(direction) =>
              setDate((current) => shiftDate(current, view, direction))
            }
            onToday={() => setDate(new Date())}
          />
          <div className="sc-filter-row">
            <div className="sc-course-filter">
              <label htmlFor="calendar-course">Course</label>
              <select
                id="calendar-course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="all">All courses</option>
                {courses.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <span aria-live="polite" className="sc-muted">
              {!loading && !error
                ? `${visibleEvents.length} ${visibleEvents.length === 1 ? 'item' : 'items'} in this ${view}`
                : ''}
            </span>
            {hasFilters && (
              <button
                className="sc-text-button"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
            <span className="sc-filter-note">
              Times follow your device’s time zone
            </span>
          </div>
          <div className="sc-content-grid">
            <div className="sc-calendar-column">
              <section
                className="sc-card sc-calendar-card"
                aria-labelledby="calendar-heading"
                aria-busy={loading}
              >
                {loading ? (
                  <div className="sc-state" role="status">
                    <Icon name="clock" size={30} />
                    <h2>Loading your schedule…</h2>
                  </div>
                ) : error ? (
                  <div className="sc-state" role="alert">
                    <h2>We couldn’t load your schedule</h2>
                    <p>{error}</p>
                    {onRetry && (
                      <button
                        type="button"
                        className="sc-button"
                        onClick={onRetry}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {visibleEvents.length === 0 && (
                      <div className="sc-empty-banner" role="status">
                        <strong>
                          {hasFilters
                            ? 'No matching items in this view.'
                            : `No items scheduled in this ${view}.`}
                        </strong>
                        <span>
                          {hasFilters
                            ? 'Try another search or clear your filters.'
                            : 'Use the arrows or Today to explore your schedule.'}
                        </span>
                      </div>
                    )}
                    <CalendarView
                      date={date}
                      today={today}
                      events={visibleEvents}
                      onSelect={setSelectedEvent}
                    />
                    <CalendarLegend />
                  </>
                )}
              </section>
              <div className="sc-planning-note">
                <Icon name="compass" size={24} />
                <div>
                  <strong>
                    {isDemo
                      ? 'Your dashboard, taking shape'
                      : 'Make room for focused work'}
                  </strong>
                  <p>
                    {isDemo
                      ? 'Explore the sample schedule. Saved data, editing, plan generation, and calendar sync are next steps.'
                      : 'Review your schedule and select any item to see its details.'}
                  </p>
                </div>
              </div>
            </div>
            {!loading && !error && (
              <DashboardInsights
                events={allEvents}
                date={date}
                today={today}
                onSelect={setSelectedEvent}
                isDemo={isDemo}
                syllabusEnabled={syllabusEnabled}
              />
            )}
          </div>
          {isDemo && (
            <p className="sc-demo-note">
              Sample data only · Search and course filters apply to the
              calendar; summary cards show the full schedule.
            </p>
          )}
        </main>
      </div>
      {selectedEvent && (
        <EventDetailsDialog
          event={selectedEvent}
          isDemo={isDemo}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
