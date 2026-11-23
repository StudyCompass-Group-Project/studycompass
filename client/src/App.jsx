import { useEffect, useState } from 'react'
import UserLogin from './pages/UserLogin.jsx'
import OnboardingStudyAvailability from './pages/OnboardingStudyAvailability.jsx'
import CalendarDashboard from './pages/CalendarDashboard.jsx'
import OnboardingSyllabusUpload from './pages/OnboardingSyllabusUpload.jsx'
import SyllabusManualReview from './pages/SyllabusManualReview.jsx'
import { readAvailability, writeAvailability } from './utils/availability.js'
import { approveSyllabus, emptySyllabusState, readSyllabusState, syllabusCalendarEvents, writeSyllabusState } from './utils/syllabus.js'

const routes = ['login', 'onboarding-study-availability', 'calendar-dashboard', 'syllabus-upload', 'syllabus-review']
const routeFromHash = () => window.location.hash.replace(/^#\//, '')

export default function App() {
  // One availability source feeds both pages. The planner must use these same
  // blocks with utils/availability.js, rather than maintain a second copy.
  const [availability, setAvailability] = useState(() => readAvailability())
  const [syllabus, setSyllabus] = useState(() => readSyllabusState())
  const [sourceFile, setSourceFile] = useState(null)
  const [syllabusSaveError, setSyllabusSaveError] = useState('')
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

  useEffect(() => {
    if (!syllabusSaveError) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [syllabusSaveError])

  function saveSyllabus(next, keepDraftInMemory = false) {
    try {
      writeSyllabusState(next)
      setSyllabus({ ...next, error: '' })
      setSyllabusSaveError('')
      return ''
    } catch {
      if (keepDraftInMemory) setSyllabus(next)
      const message = 'We could not save your syllabus changes in this tab. Allow browser storage and try again. Previously saved calendar items have not been changed.'
      setSyllabusSaveError(message)
      return message
    }
  }

  function updateDraft(draft) {
    if (syllabus.error) return syllabus.error
    return saveSyllabus({ ...syllabus, draft }, true)
  }

  function confirmReview(draft, confirmed) {
    if (syllabus.error) return syllabus.error
    try {
      const next = approveSyllabus(syllabus, draft, confirmed)
      const error = saveSyllabus(next)
      if (!error) {
        setSourceFile(null)
        window.location.hash = '/calendar-dashboard'
      }
      return error
    } catch (error) {
      return error.message
    }
  }

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
    const syllabusError = saveSyllabus(emptySyllabusState())
    if (syllabusError) return syllabusError
    setSourceFile(null)
    const error = persist({ ...availability, blocks: [], completed: false, error: '' }, true)
    if (!error) window.location.hash = '/onboarding-study-availability'
    return error
  }

  if (route === 'calendar-dashboard') {
    return (
      <CalendarDashboard
        events={syllabusCalendarEvents(syllabus.courses)}
        reviewedCourses={syllabus.courses}
        initialDate={syllabus.courses.at(-1)?.deadlines.map(item => item.date).sort()[0]}
        syllabusEnabled
        availability={availability.blocks}
        error={availability.error || syllabus.error}
        availabilityPreview
      />
    )
  }
  const syllabusRoute = route === 'syllabus-upload' || route === 'syllabus-review'
  if (syllabusRoute && availability.completed && !availability.error) {
    if (route === 'syllabus-review' && !syllabus.error)
      return <SyllabusManualReview draft={syllabus.draft} file={sourceFile} onFile={setSourceFile}
        onChange={updateDraft} onApprove={confirmReview} saveError={syllabusSaveError} />
    return <OnboardingSyllabusUpload draft={syllabus.draft} loadError={syllabus.error}
      saveError={syllabusSaveError}
      onReset={() => {
        const error = saveSyllabus(emptySyllabusState())
        if (!error) setSourceFile(null)
        return error
      }}
      onReady={(draft, file) => {
        const error = updateDraft(draft)
        setSourceFile(file)
        if (!error) window.location.hash = '/syllabus-review'
        return error
      }} />
  }
  if (route === 'onboarding-study-availability' || syllabusRoute) {
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
