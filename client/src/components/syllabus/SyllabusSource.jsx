import { useEffect, useState } from 'react'
import { SYLLABUS_ACCEPT, isOriginalFile, syllabusMimeType, validateSyllabusFile } from '../../utils/syllabus.js'

export default function SyllabusSource({ file, source, onFile }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!file) return
    // Use the allowed media type even when a browser supplies an empty MIME.
    const next = URL.createObjectURL(new Blob([file], { type: syllabusMimeType(file) }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  return (
    <section className="sy-card sy-source" aria-labelledby="sy-source-heading">
      <div className="sy-section-heading"><h2 id="sy-source-heading">Original syllabus</h2><span className="sy-badge">Reference</span></div>
      <p className="sy-filename">{source.name}</p>
      <p className="sy-muted">Compare the details with your source as you scroll.</p>
      {file && url ? <>
        <a href={url} target="_blank" rel="noreferrer">Open original in a new tab</a>
        {syllabusMimeType(file) === 'application/pdf'
          ? <iframe className="sy-source-preview" src={url} title="Original syllabus PDF" />
          : <img className="sy-source-preview" src={url} alt="Original syllabus for comparison with the review fields" />}
        <p className="sy-muted">If the preview is unavailable, open the original above.</p>
      </> : <div className="sy-source-empty">
        <p>Your review draft is saved, but the original file is kept only in memory. Select the same file again to view it here.</p>
        <label className="sy-field">Select original syllabus
          <input type="file" accept={SYLLABUS_ACCEPT} onChange={event => {
            const next = event.target.files?.[0]
            if (!next) return
            const problem = validateSyllabusFile(next)
            if (problem || !isOriginalFile(next, source)) setError(problem || 'Select the same original file used for this review.')
            else { setError(''); onFile(next) }
            event.target.value = ''
          }} />
        </label>
        {error && <p className="sy-error" role="alert">{error}</p>}
      </div>}
    </section>
  )
}
