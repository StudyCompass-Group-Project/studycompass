import { useRef, useState } from 'react'
import { CATEGORIES, normalizeBlock, validateBlockedTime } from '../../utils/availability.js'
import { timeToMinutes, toDateKey, WEEKDAYS } from '../../utils/calendar.js'

export default function BlockedTimeForm({ block, onSave, onCancel, onDirtyChange }) {
  const [values, setValues] = useState(
    () =>
      block ?? {
        title: '',
        category: CATEGORIES[0],
        days: [],
        start: '09:00',
        end: '17:00',
        recurring: true,
        date: toDateKey(new Date()),
      },
  )
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const formRef = useRef(null)
  const overnight =
    values.start && values.end && timeToMinutes(values.end) < timeToMinutes(values.start)

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setSaveError('')
    onDirtyChange(true)
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = validateBlockedTime(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const name = Object.keys(nextErrors)[0]
      formRef.current.querySelector(`[data-field="${name}"]`)?.focus()
      return
    }
    const error = onSave(normalizeBlock({ ...values, id: block?.id ?? crypto.randomUUID() }))
    if (error) setSaveError(error)
  }

  const fieldError = (name) =>
    errors[name] ? (
      <p className="sc-av-error" id={`av-${name}-error`}>
        {errors[name]}
      </p>
    ) : null

  return (
    <section className="sc-av-card" aria-labelledby="av-form-heading">
      <div className="sc-av-card-heading">
        <h2 id="av-form-heading">{block ? 'Edit blocked commitment' : 'Add blocked commitment'}</h2>
        <span className="sc-av-eyebrow">
          {values.recurring ? 'Repeats weekly' : 'One-time commitment'}
        </span>
      </div>
      <form
        ref={formRef}
        className="sc-av-form"
        noValidate
        onSubmit={submit}
        aria-label="Blocked commitment"
      >
        <div className="sc-av-field">
          <label htmlFor="av-title">Commitment name</label>
          <input
            id="av-title"
            data-field="title"
            type="text"
            maxLength={80}
            required
            placeholder="e.g. Work shift, commute, or family time"
            value={values.title}
            onChange={(event) => change('title', event.target.value)}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'av-title-error' : undefined}
          />
          {fieldError('title')}
        </div>
        <fieldset>
          <legend>Category</legend>
          <div className="sc-av-categories">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className="sc-av-pill"
                data-field="category"
                aria-pressed={values.category === category}
                onClick={() => change('category', category)}
              >
                {category}
              </button>
            ))}
          </div>
          {fieldError('category')}
        </fieldset>
        <label className="sc-av-checkbox">
          <input
            type="checkbox"
            checked={values.recurring}
            onChange={(event) => change('recurring', event.target.checked)}
          />
          Repeat every week
        </label>
        {values.recurring ? (
          <fieldset aria-describedby={errors.days ? 'av-days-error' : undefined}>
            <legend>Days of week</legend>
            <div className="sc-av-days">
              {WEEKDAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  data-field="days"
                  aria-pressed={values.days.includes(index)}
                  onClick={() =>
                    change(
                      'days',
                      values.days.includes(index)
                        ? values.days.filter((item) => item !== index)
                        : [...values.days, index],
                    )
                  }
                >
                  {day}
                </button>
              ))}
            </div>
            {fieldError('days')}
          </fieldset>
        ) : (
          <div className="sc-av-field">
            <label htmlFor="av-date">Date</label>
            <input
              id="av-date"
              data-field="date"
              type="date"
              value={values.date}
              required
              onChange={(event) => change('date', event.target.value)}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? 'av-date-error' : undefined}
            />
            {fieldError('date')}
          </div>
        )}
        <div className="sc-av-time-fields">
          {['start', 'end'].map((name) => (
            <div className="sc-av-field" key={name}>
              <label htmlFor={`av-${name}`}>{name === 'start' ? 'Start time' : 'End time'}</label>
              <input
                id={`av-${name}`}
                data-field={name}
                type="time"
                step="60"
                value={values[name]}
                required
                onChange={(event) => change(name, event.target.value)}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `av-${name}-error` : 'av-time-help'}
              />
              {fieldError(name)}
            </div>
          ))}
        </div>
        <p className="sc-av-muted" id="av-time-help">
          {overnight
            ? 'Ends the following day. Both days will be blocked.'
            : 'For an overnight shift, choose an end time earlier than its start.'}
        </p>
        {saveError && (
          <p role="alert" className="sc-av-error">
            {saveError}
          </p>
        )}
        <div className="sc-av-form-actions">
          <button type="button" className="sc-av-button" onClick={onCancel}>
            {block ? 'Cancel edit' : 'Clear form'}
          </button>
          <button type="submit" className="sc-av-button sc-av-primary">
            {block ? 'Save changes' : '+ Add blocked time'}
          </button>
        </div>
      </form>
    </section>
  )
}
