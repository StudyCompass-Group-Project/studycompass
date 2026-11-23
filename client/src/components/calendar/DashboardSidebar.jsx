import Icon from './Icon.jsx'

export default function DashboardSidebar({ isDemo, availabilityEnabled = false, syllabusEnabled = false }) {
  return (
    <aside className="sc-sidebar">
      <a
        className="sc-brand"
        href={availabilityEnabled ? '#/calendar-dashboard' : '#calendar-dashboard'}
        aria-label="StudyCompass calendar dashboard"
      >
        <Icon name="compass" size={32} />
        <span>
          <strong>StudyCompass</strong>
          <small>ACADEMIC OS</small>
        </span>
      </a>
      {syllabusEnabled ? <a className="sc-button sc-button-dark sc-upload" href="#/syllabus-upload"><Icon name="plus" size={17} /> Upload Syllabus</a> : <button
        className="sc-button sc-button-dark sc-upload"
        type="button"
        disabled
        title="Syllabus upload will be connected in a later task"
      >
        <Icon name="plus" size={17} /> Upload Syllabus
      </button>}
      <nav aria-label="Main navigation" className="sc-navigation">
        <a href={availabilityEnabled ? '#/calendar-dashboard' : '#calendar-dashboard'} aria-current="page">
          <Icon name="calendar" />
          Calendar Dashboard
        </a>
        <button type="button" disabled title="Courses page is in development">
          <Icon name="book" />
          My Courses
        </button>
        {availabilityEnabled ? <a href="#/onboarding-study-availability">
          <Icon name="clock" /> Study Availability
        </a> : <button
          type="button"
          disabled
          title="Availability page is in development"
        >
          <Icon name="clock" />
          Study Availability
        </button>}
        <button type="button" disabled title="Settings page is in development">
          <Icon name="settings" />
          Settings
        </button>
      </nav>
      <p className="sc-nav-note">More pages are in progress.</p>
      <div className="sc-profile">
        <span className="sc-avatar">
          <Icon name="book" />
        </span>
        <div>
          <strong>{isDemo ? 'Student preview' : 'StudyCompass'}</strong>
          <small>Your academic workspace</small>
        </div>
      </div>
    </aside>
  )
}
