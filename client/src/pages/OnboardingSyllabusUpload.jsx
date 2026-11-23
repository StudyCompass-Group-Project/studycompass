import { useEffect, useRef, useState } from 'react'
import SyllabusLayout from '../components/syllabus/SyllabusLayout.jsx'
import Icon from '../components/calendar/Icon.jsx'
import { extractSyllabus } from '../services/syllabusExtraction.js'
import { SYLLABUS_ACCEPT, validateSyllabusFile } from '../utils/syllabus.js'

export default function OnboardingSyllabusUpload({ draft, loadError, saveError, onReady, onReset }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  function chooseFiles(files) {
    if (request.current || loadError) return
    setDragging(false)
    if (!files?.length) return
    const next = files[0]
    const problem = files.length > 1 ? 'Choose one syllabus at a time.' : validateSyllabusFile(next)
    setError(problem)
    setFile(problem ? null : next)
    if (input.current) input.current.value = ''
  }

  async function processFile() {
    if (request.current) return
    const problem = validateSyllabusFile(file)
    if (problem) { setError(problem); return }
    if (draft && !window.confirm('Replace the unfinished review with a new sample extraction? Previously confirmed courses will be kept.')) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const result = await extractSyllabus(file, { signal: controller.signal })
      if (controller.signal.aborted) return
      const saveProblem = onReady(result, file)
      if (saveProblem) setError(saveProblem)
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure.message || 'The sample extraction could not be prepared. Try again.')
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }

  function cancel() {
    request.current?.abort()
    request.current = null
    setBusy(false)
    setError('')
  }

  return (
    <SyllabusLayout step={2} title="Bring your syllabus into focus."
      description="Start with one course. You’ll review its details and deadlines before adding anything to your calendar.">
      <div className="sy-notice"><Icon name="book" size={22} /><div>
        <strong>Sample extraction preview</strong>
        <p>Automatic extraction is not connected yet. This flow uses editable sample information, not the contents of your file. Your file stays on this device.</p>
      </div></div>
      {loadError && <div className="sy-error-box" role="alert"><p>{loadError}</p>
        <button type="button" className="sy-button" onClick={() => {
          if (window.confirm('Reset all syllabus drafts and reviewed courses in this preview? Your availability will be kept.')) setError(onReset() || '')
        }}>Reset syllabus preview</button>
      </div>}
      {draft && !loadError && <div className="sy-resume">
        <div><strong>You have an unfinished review</strong><p>{draft.source.name}</p></div>
        <a className="sy-button" href="#/syllabus-review">Resume review</a>
      </div>}
      <div className="sy-upload-grid">
        <section className="sy-card" aria-labelledby="sy-upload-heading" aria-busy={busy}>
          <div className="sy-section-heading"><h2 id="sy-upload-heading">Upload a syllabus</h2><span className="sy-badge">One course at a time</span></div>
          <div className={`sy-dropzone${dragging ? ' sy-dragging' : ''}`}
            onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
            onDrop={event => { event.preventDefault(); chooseFiles(event.dataTransfer.files) }}>
            <span className="sy-upload-icon"><Icon name="upload" size={30} /></span>
            <h3>Drop your syllabus here</h3>
            <p>or choose a file from your device</p>
            <input ref={input} className="sy-visually-hidden" id="sy-file" type="file" tabIndex={-1}
              accept={SYLLABUS_ACCEPT} disabled={busy || Boolean(loadError)}
              onChange={event => chooseFiles(event.target.files)} aria-label="Choose syllabus file" />
            <button type="button" className="sy-button sy-primary" disabled={busy || Boolean(loadError)}
              onClick={() => input.current.click()}>Choose file</button>
            <p className="sy-muted">PDF, PNG, or JPG · Up to 10 MB per file</p>
          </div>
          {file && <div className="sy-selected-file">
            <Icon name="book" size={22} /><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready for preview</span></div>
            <button type="button" className="sy-icon-button" aria-label="Remove selected file" disabled={busy} onClick={() => { setFile(null); setError('') }}><Icon name="close" /></button>
          </div>}
          {(error || saveError) && <p className="sy-error" role="alert">{error || saveError}</p>}
          <div className="sy-processing" role="status" aria-live="polite">
            {busy && <><span className="sy-spinner" aria-hidden="true" />Preparing sample information for review…</>}
          </div>
          <div className="sy-actions">
            <a href="#/onboarding-study-availability" className="sy-button">Back to availability</a>
            {busy ? <button type="button" className="sy-button" onClick={cancel}>Cancel processing</button>
              : <button type="button" className="sy-button sy-primary" disabled={!file || Boolean(loadError)} onClick={processFile}>Continue with sample extraction</button>}
          </div>
          <p className="sy-muted sy-storage-note">The next page opens automatically when the sample information is ready.</p>
        </section>
        <aside className="sy-guide" aria-label="Syllabus upload guidance">
          <section className="sy-card"><h2>From document to calendar</h2>
            <ul className="sy-guide-list">
              <li><Icon name="upload" /><div><h3>Start with a clear syllabus</h3><p>Use the original PDF when possible. For an image, keep the text readable and include the course details and deadlines.</p></div></li>
              <li><Icon name="search" /><div><h3>Let AI find the details</h3><p>When connected, our visual LLM will read the syllabus and suggest course information, topics, assignments, and due dates.</p></div></li>
              <li><Icon name="check" /><div><h3>You make the final check</h3><p>Review and correct every detail. Only the information you confirm will appear on your calendar.</p></div></li>
            </ul>
          </section>
          <section className="sy-tip"><Icon name="compass" size={26} /><div><h3>A little review goes a long way</h3><p>AI can misread dates or miss details. Keep your syllabus handy and check the year, due dates, and any missing times.</p></div></section>
        </aside>
      </div>
    </SyllabusLayout>
  )
}
