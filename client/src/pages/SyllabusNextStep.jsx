import { useEffect } from 'react'
import AuthIcon from '../components/auth/AuthIcon.jsx'

export default function SyllabusNextStep() {
  useEffect(() => {
    document.title = 'StudyCompass | Next: syllabus upload'
    document.getElementById('syllabus-next-heading')?.focus()
  }, [])
  return (
    <div className="sc-availability">
      <header className="sc-av-header">
        <div className="sc-av-brand">
          <AuthIcon name="compass" size={32} />
          StudyCompass
        </div>
      </header>
      <main className="sc-av-card sc-av-finish">
        <span className="sc-av-step">Step 2 of 2 · Syllabus upload</span>
        <h1 id="syllabus-next-heading" tabIndex={-1}>
          Your availability is saved for this preview.
        </h1>
        <p>
          Next, you’ll upload your course syllabi. The upload page is still in development. You can
          already view your blocked hours on the calendar or return to adjust them.
        </p>
        <p className="sc-av-muted">
          This preview stores availability only in this browser tab. No account has been created.
        </p>
        <div className="sc-av-form-actions">
          <a className="sc-av-button sc-av-primary" href="#/calendar-dashboard">
            View calendar <AuthIcon name="arrow" size={18} />
          </a>
          <a className="sc-av-button" href="#/onboarding-study-availability">
            Edit availability
          </a>
        </div>
      </main>
    </div>
  )
}
