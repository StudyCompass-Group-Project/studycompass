import { useEffect, useRef } from 'react'
import {
  EVENT_TYPES,
  eventTimeLabel,
  formatDate,
  fromDateKey,
  timeToMinutes,
} from '../../utils/calendar.js'
import Icon from './Icon.jsx'

export default function EventDetailsDialog({ event, onClose, isDemo }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    // Native dialog traps focus and restores focus to the triggering button.
    return () => dialog.close()
  }, [])

  function closeDialog() {
    // Close before React removes the dialog, so the browser can restore focus.
    dialogRef.current.close()
    onClose()
  }

  return (
    <dialog
      className="sc-dialog"
      ref={dialogRef}
      aria-labelledby="event-title"
      onCancel={(e) => {
        e.preventDefault()
        closeDialog()
      }}
    >
      <div className="sc-dialog-top">
        <span className="sc-eyebrow">{EVENT_TYPES[event.type]}</span>
        <button
          type="button"
          className="sc-icon-button"
          aria-label="Close details"
          onClick={closeDialog}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id="event-title">{event.title}</h2>
      <p className="sc-dialog-course">{event.course || 'Personal'}</p>
      <dl className="sc-event-details">
        <div>
          <dt>Date</dt>
          <dd>
            {formatDate(fromDateKey(event.date), {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </dd>
        </div>
        <div>
          <dt>{event.type === 'deadline' ? 'Due time' : 'Time'}</dt>
          <dd>
            {eventTimeLabel(event)} <small>(local time)</small>
          </dd>
        </div>
        {event.end && (
          <div>
            <dt>Duration</dt>
            <dd>
              {timeToMinutes(event.end) - timeToMinutes(event.start)} minutes
            </dd>
          </div>
        )}
        {event.location && (
          <div>
            <dt>Location</dt>
            <dd>{event.location}</dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd>
            {event.availabilityBlockId ? 'Blocked for study' : event.completed
              ? 'Completed'
              : event.type === 'deadline'
                ? 'Not completed'
                : 'Scheduled'}
          </dd>
        </div>
      </dl>
      {event.description && (
        <p className="sc-event-description">{event.description}</p>
      )}
      {event.isSample && <p className="sc-muted">Reviewed preview data. Automatic syllabus extraction is not connected yet.</p>}
      {isDemo && !event.isSample && (
        <p className="sc-muted">
          This is sample data. Editing and saving will be connected in a later
          task.
        </p>
      )}
      <div className="sc-dialog-footer">
        {event.availabilityBlockId && <a className="sc-button" href="#/onboarding-study-availability">Edit blocked hours</a>}
        <button
          type="button"
          className="sc-button sc-button-dark"
          onClick={closeDialog}
        >
          Close details
        </button>
      </div>
    </dialog>
  )
}
