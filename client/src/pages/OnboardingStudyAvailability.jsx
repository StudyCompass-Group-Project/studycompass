import { useEffect, useRef, useState } from 'react'
import AuthIcon from '../components/auth/AuthIcon.jsx'
import BlockedTimeForm from '../components/availability/BlockedTimeForm.jsx'
import AvailabilityWeek from '../components/availability/AvailabilityWeek.jsx'
import { availabilityEvents, blockDaysLabel, summarizeAvailability } from '../utils/availability.js'
import { addDays, formatRange, formatTime, getWeekDays, toDateKey } from '../utils/calendar.js'
import './OnboardingStudyAvailability.css'

export default function OnboardingStudyAvailability({
  availability,
  onChange,
  onContinue,
  onReset,
}) {
  const { blocks, timeZone, error: loadError, completed } = availability
  const [week, setWeek] = useState(() => new Date())
  const [editingId, setEditingId] = useState(null)
  const [formVersion, setFormVersion] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const removeDialog = useRef(null)
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const days = getWeekDays(week)
  const keys = days.map(toDateKey)
  const events = availabilityEvents(blocks, keys[0], keys[6])
  const summary = summarizeAvailability(blocks, keys)
  const activeCount = new Set(events.map(event => event.availabilityBlockId)).size
  const editing = blocks.find((block) => block.id === editingId)
  const hours = (value) => Number(value.toFixed(1)).toLocaleString()

  useEffect(() => {
    document.title = 'StudyCompass | Study availability'
    document.getElementById('av-heading')?.focus()
  }, [])

  function resetForm() {
    setEditingId(null)
    setDirty(false)
    setFormVersion((current) => current + 1)
    setActionError('')
  }

  function saveBlock(block) {
    const next = editing
      ? blocks.map((item) => (item.id === block.id ? block : item))
      : [...blocks, block]
    const error = onChange(next)
    if (error) return error
    setNotice(
      `${block.title} ${editing ? 'updated' : 'added'}. The calendar now uses these blocked hours.`,
    )
    resetForm()
    return ''
  }

  function edit(id) {
    if (dirty) {
      setActionError('Add, save, or clear the commitment you are editing first.')
      document.getElementById('av-title')?.focus()
      return
    }
    setEditingId(id)
    setDirty(true)
    setActionError('')
    // The input stays mounted; focus it after selecting the block.
    requestAnimationFrame(() => document.getElementById('av-title')?.focus())
  }

  function removeBlock() {
    const error = onChange(blocks.filter((block) => block.id !== pendingRemoval.id))
    removeDialog.current.close()
    if (error) setActionError(error)
    else {
      setNotice(`${pendingRemoval.title} removed from your availability and calendar.`)
      if (editingId === pendingRemoval.id) resetForm()
      requestAnimationFrame(() => document.getElementById('av-blocks-heading')?.focus())
    }
    setPendingRemoval(null)
  }

  function continueOnboarding() {
    if (dirty) {
      setActionError('Add or save your commitment first, or clear the form to continue without it.')
      document.getElementById('av-title')?.focus()
      return
    }
    setActionError(onContinue() || '')
  }

  return (
    <div className="sc-availability">
      <a
        className="sc-av-skip"
        href="#av-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('av-main').focus()
        }}
      >
        Skip to study availability
      </a>
      <header className="sc-av-header">
        <div className="sc-av-brand">
          <AuthIcon name="compass" size={32} />
          <span>StudyCompass</span>
        </div>
        <a href="#/calendar-dashboard" className="sc-av-text-link">
          View calendar <AuthIcon name="arrow" size={16} />
        </a>
      </header>
      <main className="sc-av-main" id="av-main" tabIndex={-1}>
        <section className="sc-av-intro" aria-labelledby="av-heading">
          <span className="sc-av-step">Step 1 of 3 · Study availability</span>
          <h1 id="av-heading" tabIndex={-1}>
            Welcome to StudyCompass! Let’s protect your non-study time.
          </h1>
          <p>
            Tell us when life keeps you busy. Add work shifts, commuting, classes, or personal
            commitments below. These are times you <strong>cannot study</strong>, so they must stay
            out of your study plan.
          </p>
          <p className="sc-av-preview-note">
            Preview · Changes are saved in this browser tab and shared with your calendar. Account
            storage and plan generation are still in development.
          </p>
        </section>
        {loadError && (
          <div className="sc-av-load-error" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="sc-av-button"
              onClick={() => setActionError(onReset() || '')}
            >
              Reset saved preview
            </button>
          </div>
        )}
        <div className="sc-av-live" role="status" aria-atomic="true">
          {notice}
        </div>
        {actionError && (
          <p className="sc-av-action-error" role="alert">
            {actionError}
          </p>
        )}
        <div className="sc-av-layout">
          <div className="sc-av-left">
            <BlockedTimeForm
              key={`${editingId ?? 'new'}-${formVersion}`}
              block={editing}
              onSave={saveBlock}
              onCancel={resetForm}
              onDirtyChange={setDirty}
            />
            <section className="sc-av-card" aria-labelledby="av-week-heading">
              <div className="sc-av-card-heading sc-av-week-title">
                <div>
                  <h2 id="av-week-heading">Your weekly commitments</h2>
                  <p className="sc-av-muted">Select a block to edit it. All times: {timeZone}.</p>
                </div>
                <div className="sc-av-legend">
                  <span>
                    <i /> Blocked
                  </span>
                  <span>
                    <i /> Unblocked
                  </span>
                </div>
              </div>
              <div className="sc-av-week-nav">
                <button
                  type="button"
                  className="sc-av-button"
                  aria-label="Previous week"
                  onClick={() => setWeek((current) => addDays(current, -7))}
                >
                  ‹
                </button>
                <span>{formatRange(days[0], days[6])}</span>
                <button
                  type="button"
                  className="sc-av-button"
                  aria-label="Next week"
                  onClick={() => setWeek((current) => addDays(current, 7))}
                >
                  ›
                </button>
                <button type="button" className="sc-av-button" onClick={() => setWeek(new Date())}>
                  This week
                </button>
              </div>
              {!events.length && (
                <p className="sc-av-empty">
                  No blocked time in this week yet. Add a commitment above to see it here.
                </p>
              )}
              <AvailabilityWeek date={week} events={events} onEdit={edit} />
              <p className="sc-av-muted sc-av-grid-note">
                Weekly blocks repeat on the selected days. Overlapping hours are counted only once.
              </p>
            </section>
          </div>
          <aside className="sc-av-right" aria-label="Availability summary and next step">
            <section className="sc-av-card" aria-labelledby="av-summary-heading">
              <div className="sc-av-total">
                <h2 id="av-summary-heading">Blocked this week</h2>
                <strong>{hours(summary.blockedHours)} hrs</strong>
              </div>
              <p className="sc-av-muted">
                Across {activeCount} {activeCount === 1 ? 'commitment' : 'commitments'} ·
                selected week
              </p>
              <div className="sc-av-meter" aria-hidden="true">
                <span style={{ width: `${(summary.blockedHours / 168) * 100}%` }} />
              </div>
              <div className="sc-av-open-time">
                <span className="sc-av-eyebrow">Unblocked daytime hours</span>
                <strong>{hours(summary.daytimeOpenHours)} hrs / wk</strong>
              </div>
              <p className="sc-av-muted sc-av-capacity-note">
                Within 7 AM–10 PM. This is not a study-hours goal; leave room for meals, rest, and
                breaks.
              </p>
              <h3 className="sc-av-eyebrow" id="av-blocks-heading" tabIndex={-1}>
                Active blocks
              </h3>
              {blocks.length === 0 ? (
                <p className="sc-av-empty">
                  Your schedule starts clear. Add the commitments you want to protect.
                </p>
              ) : (
                <ul className="sc-av-block-list">
                  {blocks.map((block) => (
                    <li key={block.id}>
                      <div>
                        <strong>{block.title}</strong>
                        <span>
                          {blockDaysLabel(block)} · {formatTime(block.start)}–
                          {formatTime(block.end)}
                          {block.end < block.start ? ' (+1 day)' : ''}
                        </span>
                        <span>
                          {block.category} · {block.recurring ? 'Weekly' : 'Once'}
                        </span>
                      </div>
                      <div className="sc-av-block-actions">
                        <button
                          type="button"
                          aria-label={`Edit ${block.title}`}
                          onClick={() => edit(block.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${block.title}`}
                          onClick={() => {
                            setPendingRemoval(block)
                            removeDialog.current.showModal()
                          }}
                        >
                          <AuthIcon name="close" size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="sc-av-card" aria-labelledby="av-why-heading">
              <div className="sc-av-card-heading">
                <h2 id="av-why-heading">Why block time first?</h2>
              </div>
              <ol className="sc-av-guidance">
                <li>
                  <div>
                    <strong>Keep your commitments protected</strong>
                    <p>
                      Work, travel, classes, and personal time belong in your schedule before study
                      sessions are added.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Make room for real life</strong>
                    <p>
                      Include time for commuting and breaks in your blocks. StudyCompass does not
                      add automatic buffers yet.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Adjust as your week changes</strong>
                    <p>
                      Edit your blocks here at any time. The calendar reads the same availability,
                      including recurring and overnight commitments.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
            <section className="sc-av-card sc-av-next">
              <button
                className="sc-av-button sc-av-primary"
                type="button"
                onClick={continueOnboarding}
                disabled={Boolean(loadError)}
              >
                {completed ? 'Save & continue' : 'Save & continue to syllabus upload'}{' '}
                <AuthIcon name="arrow" size={18} />
              </button>
              <p className="sc-av-muted">
                {blocks.length
                  ? 'You can return to change these hours.'
                  : 'No commitments to add? You can continue with an empty schedule.'}
              </p>
            </section>
          </aside>
        </div>
      </main>
      <dialog
        ref={removeDialog}
        className="sc-av-dialog"
        aria-labelledby="av-remove-heading"
        onCancel={() => setPendingRemoval(null)}
      >
        <h2 id="av-remove-heading">Remove blocked time?</h2>
        <p>
          Remove “{pendingRemoval?.title}”
          {pendingRemoval?.recurring ? ' and all of its weekly occurrences' : ''}? These hours will
          no longer be excluded from study planning.
        </p>
        <div className="sc-av-form-actions">
          <button
            type="button"
            className="sc-av-button"
            onClick={() => {
              removeDialog.current.close()
              setPendingRemoval(null)
            }}
          >
            Keep block
          </button>
          <button type="button" className="sc-av-button sc-av-primary" onClick={removeBlock}>
            Remove block
          </button>
        </div>
      </dialog>
    </div>
  )
}
