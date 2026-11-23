import { useEffect } from 'react'
import Icon from '../calendar/Icon.jsx'
import '../../pages/OnboardingSyllabus.css'

export default function SyllabusLayout({ step, title, description, children }) {
  useEffect(() => {
    document.title = `StudyCompass | ${title}`
    document.getElementById('syllabus-heading')?.focus()
  }, [title])

  return (
    <div className="sc-syllabus">
      <a className="sy-skip" href="#sy-main" onClick={event => {
        event.preventDefault(); document.getElementById('sy-main').focus()
      }}>Skip to syllabus</a>
      <header className="sy-header">
        <a className="sy-brand" href="#/calendar-dashboard"><Icon name="compass" size={32} /> StudyCompass</a>
        <span className="sy-badge">Onboarding preview</span>
      </header>
      <main className="sy-main" id="sy-main" tabIndex={-1}>
        <ol className="sy-steps" aria-label="Onboarding progress">
          {['Study availability', 'Upload syllabus', 'Review information'].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-complete={step > index + 1}>
              <span className="sy-step-icon" aria-hidden="true">{step > index + 1 ? <Icon name="check" size={16} /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>
        <div className="sy-intro">
          <p className="sy-eyebrow">Step {step} of 3</p>
          <h1 id="syllabus-heading" tabIndex={-1}>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </main>
      <footer className="sy-footer">Your syllabus. Your review. Your schedule.</footer>
    </div>
  )
}
