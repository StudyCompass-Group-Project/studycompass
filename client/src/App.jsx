import { useEffect, useState } from 'react'
import UserLogin from './pages/UserLogin.jsx'
import OnboardingStudyAvailability from './pages/OnboardingStudyAvailability.jsx'
import CalendarDashboard from './pages/CalendarDashboard.jsx'
import AuthIcon from './components/auth/AuthIcon.jsx'
import { readAvailability, writeAvailability } from './utils/availability.js'

const routes = ['login', 'onboarding-study-availability', 'calendar-dashboard', 'syllabus-upload']
const routeFromHash = () => window.location.hash.replace(/^#\//, '')

export default function App() {
  // One availability source feeds both pages. The planner must use these same
  // blocks with utils/availability.js, rather than maintain a second copy.
  const [availability, setAvailability] = useState(() => readAvailability())
  const [route, setRoute] = useState(() =>
    routes.includes(routeFromHash()) ? routeFromHash() : 'login',
  )

  useEffect(() => {
    const handleRoute = () => {
      const next = routeFromHash()
      if (routes.includes(next)) {
        setRoute(next)
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', handleRoute)
    return () => window.removeEventListener('hashchange', handleRoute)
  }, [])

  function persist(next, reset = false) {
    if (availability.error && !reset) return availability.error
    try {
      writeAvailability(next)
      setAvailability({ ...next, error: '' })
      return ''
    } catch {
      return 'We could not save availability in this tab. Allow browser storage and try again. Your previous saved blocks have not been changed.'
    }
  }

  function startPreview() {
    // No authenticated session or credentials are created or stored here.
    const error = persist({ ...availability, blocks: [], completed: false, error: '' }, true)
    if (!error) window.location.hash = '/onboarding-study-availability'
    return error
  }

  if (route === 'calendar-dashboard') {
    return (
      <CalendarDashboard
        availability={availability.blocks}
        error={availability.error}
        availabilityPreview
      />
    )
  }
  if (route === 'syllabus-upload' && availability.completed && !availability.error)
    return <SyllabusNextStep />
  if (route === 'onboarding-study-availability' || route === 'syllabus-upload') {
    return (
      <OnboardingStudyAvailability
        availability={availability}
        onChange={(blocks) => persist({ ...availability, blocks })}
        onReset={() => persist({ ...availability, blocks: [], completed: false, error: '' }, true)}
        onContinue={() => {
          const error = persist({ ...availability, completed: true })
          if (!error) window.location.hash = '/syllabus-upload'
          return error
        }}
      />
    )
  }
  return <UserLogin onPreviewContinue={startPreview} />
}

function SyllabusNextStep() {
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
