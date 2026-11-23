import { useState } from 'react'
import SyllabusLayout from '../components/syllabus/SyllabusLayout.jsx'
import SyllabusSource from '../components/syllabus/SyllabusSource.jsx'
import Icon from '../components/calendar/Icon.jsx'
import { DEADLINE_KINDS, validateSyllabusReview } from '../utils/syllabus.js'

function ReviewField({ label, name, value, onChange, error, type = 'text', multiline = false, hint, ...props }) {
  const id = `sy-${name}`
  const Component = multiline ? 'textarea' : 'input'
  return <div className="sy-field">
    <label htmlFor={id}>{label}</label>
    <Component {...props} id={id} name={name} type={multiline ? undefined : type} value={value}
      maxLength={type === 'text' ? 4000 : undefined}
      rows={multiline ? 3 : undefined} onChange={event => onChange(event.target.value)}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />
    {hint && <p className="sy-muted" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="sy-error" id={`${id}-error`}>{error}</p>}
  </div>
}

export default function SyllabusManualReview({ draft, file, onFile, onChange, onApprove, saveError }) {
  const [confirmed, setConfirmed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [actionError, setActionError] = useState('')
  const [removed, setRemoved] = useState(null)
  const [notice, setNotice] = useState('')
  const errors = submitted && draft ? validateSyllabusReview(draft) : {}

  function change(next) {
    setConfirmed(false)
    setActionError('')
    onChange(next)
  }

  function courseField(field, value) {
    change({ ...draft, course: { ...draft.course, [field]: value } })
  }

  function deadlineField(id, field, value) {
    change({ ...draft, deadlines: draft.deadlines.map(item => item.id === id ? { ...item, [field]: value } : item) })
  }

  function submit(event) {
    event.preventDefault()
    setSubmitted(true)
    const first = Object.keys(validateSyllabusReview(draft))[0]
    if (first) {
      setActionError('Check the highlighted fields before continuing.')
      document.getElementById(`sy-${first}`)?.focus()
      return
    }
    if (!confirmed) {
      setActionError('Confirm that you have reviewed the information before continuing.')
      document.getElementById('sy-confirm').focus()
      return
    }
    setActionError(onApprove(draft, confirmed) || '')
  }

  return (
    <SyllabusLayout step={3} title="Check the details. Make them yours."
      description="Compare the information with your syllabus. Correct anything that looks wrong, add missing deadlines, and remove items you don’t need.">
      {!draft ? <section className="sy-card sy-empty"><h2>No syllabus is waiting for review</h2><p>Upload a syllabus to start a review. Already confirmed items are on your calendar.</p><div className="sy-actions"><a className="sy-button sy-primary" href="#/syllabus-upload">Upload a syllabus</a><a className="sy-button" href="#/calendar-dashboard">View calendar</a></div></section>
        : <>
          <div className="sy-notice" role="status"><Icon name="check" size={22} /><div>
            <strong>Sample information is ready to review</strong>
            <p>These details are examples, not extracted from your file. Edit them to match your syllabus. Nothing from this review is on your calendar yet.</p>
          </div></div>
          <div className="sy-review-grid">
            <SyllabusSource file={file} source={draft.source} onFile={onFile} />
            <form className="sy-review-form" noValidate onSubmit={submit} aria-label="Review syllabus information">
              <section className="sy-card" aria-labelledby="sy-course-heading">
                <div className="sy-section-heading"><h2 id="sy-course-heading">Course information</h2><span className="sy-badge">Editable</span></div>
                <div className="sy-field-grid">
                  <div className="sy-full"><ReviewField label="Course name (required)" name="course.name" value={draft.course.name} onChange={value => courseField('name', value)} error={errors['course.name']} /></div>
                  <ReviewField label="Course code" name="course.code" value={draft.course.code} onChange={value => courseField('code', value)} />
                  <ReviewField label="Term / semester" name="course.term" value={draft.course.term} onChange={value => courseField('term', value)} />
                  <div className="sy-full"><ReviewField label="Instructor" name="course.instructor" value={draft.course.instructor} onChange={value => courseField('instructor', value)} /></div>
                  <div className="sy-full"><ReviewField label="Course topics" name="course.topics" multiline value={draft.course.topics} onChange={value => courseField('topics', value)} hint="List one topic per line. Correct names or add topics that are missing." /></div>
                  <div className="sy-full"><ReviewField label="Course notes" name="course.notes" multiline value={draft.course.notes} onChange={value => courseField('notes', value)} /></div>
                </div>
              </section>
              <section className="sy-card" aria-labelledby="sy-deadlines-heading">
                <div className="sy-section-heading"><h2 id="sy-deadlines-heading">Deadlines & assignments</h2><span className="sy-badge">{draft.deadlines.length} items</span></div>
                <p className="sy-muted">Dates are required for calendar items. Times are optional and use your device’s time zone. Remove an undated item and keep it in course notes if needed.</p>
                <div className="sy-deadlines">
                  {draft.deadlines.map((item, index) => {
                    const prefix = `deadlines.${item.id}`
                    return <fieldset className="sy-deadline" key={item.id}>
                      <legend>Deadline {index + 1}</legend>
                      <div className="sy-deadline-top"><span>{item.kind}</span><button type="button" className="sy-text-button"
                        aria-label={`Remove ${item.title || `deadline ${index + 1}`}`} onClick={() => {
                          setRemoved({ item, index }); change({ ...draft, deadlines: draft.deadlines.filter(row => row.id !== item.id) }); setNotice('Deadline removed. Use Undo removal to restore it.')
                        }}>Remove</button></div>
                      <div className="sy-field-grid">
                        <div className="sy-full"><ReviewField label="Title (required)" name={`${prefix}.title`} value={item.title} error={errors[`${prefix}.title`]} onChange={value => deadlineField(item.id, 'title', value)} /></div>
                        <div className="sy-field"><label htmlFor={`sy-${prefix}.kind`}>Type</label><select id={`sy-${prefix}.kind`} value={item.kind} onChange={event => deadlineField(item.id, 'kind', event.target.value)}>{DEADLINE_KINDS.map(kind => <option key={kind}>{kind}</option>)}</select></div>
                        <ReviewField label="Topic" name={`${prefix}.topic`} value={item.topic} onChange={value => deadlineField(item.id, 'topic', value)} />
                        <ReviewField label="Due date (required)" name={`${prefix}.date`} type="date" value={item.date} error={errors[`${prefix}.date`]} onChange={value => deadlineField(item.id, 'date', value)} />
                        <ReviewField label="Due time (optional)" name={`${prefix}.time`} type="time" value={item.time} error={errors[`${prefix}.time`]} onChange={value => deadlineField(item.id, 'time', value)} hint="Leave blank if unspecified." />
                        <div className="sy-full"><ReviewField label="Notes" name={`${prefix}.notes`} multiline value={item.notes} onChange={value => deadlineField(item.id, 'notes', value)} /></div>
                      </div>
                    </fieldset>
                  })}
                </div>
                {!draft.deadlines.length && <p className="sy-empty">No deadlines to add. You can save the course without calendar items or add a deadline below.</p>}
                <div className="sy-actions"><button type="button" className="sy-button" disabled={draft.deadlines.length >= 100} onClick={() => {
                  const id = crypto.randomUUID()
                  change({ ...draft, deadlines: [...draft.deadlines, { id, title: '', kind: 'Assignment', topic: '', date: '', time: '', notes: '' }] })
                  requestAnimationFrame(() => document.getElementById(`sy-deadlines.${id}.title`)?.focus())
                }}><Icon name="plus" size={18} /> Add deadline</button>
                  {removed && <button type="button" className="sy-text-button" disabled={draft.deadlines.length >= 100} onClick={() => {
                    const deadlines = [...draft.deadlines]; deadlines.splice(removed.index, 0, removed.item)
                    change({ ...draft, deadlines }); setRemoved(null); setNotice('Deadline restored.')
                  }}>Undo removal</button>}
                </div>
                <p className="sy-muted" role="status">{notice}</p>
              </section>
              <section className="sy-card sy-confirm-card" aria-labelledby="sy-finish-heading">
                <h2 id="sy-finish-heading">Ready for your calendar?</h2>
                <p>{draft.deadlines.length} reviewed {draft.deadlines.length === 1 ? 'deadline' : 'deadlines'} will be added. Your availability and previously confirmed courses will be kept.</p>
                <label className="sy-checkbox"><input id="sy-confirm" type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setActionError('') }} /><span>I’ve checked the course information and deadlines and want to save this reviewed preview.</span></label>
                {(actionError || saveError) && <p className="sy-error" role="alert">{actionError || saveError}</p>}
                <div className="sy-actions"><a className="sy-button" href="#/syllabus-upload">Back to upload</a><button className="sy-button sy-primary" type="submit">Confirm & open calendar</button></div>
                <p className="sy-muted sy-storage-note">{saveError ? 'Your latest edits are in memory only. Keep this tab open and try saving again.' : 'Draft saved in this browser tab. Confirmed data stays here after refresh; account storage is coming later.'}</p>
              </section>
            </form>
          </div>
        </>}
    </SyllabusLayout>
  )
}
