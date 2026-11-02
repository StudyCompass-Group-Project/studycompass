import { useState } from 'react'
import CalendarDashboard from './pages/CalendarDashboard.jsx'
import { createSampleEvents } from './data/sampleCalendar.js'

export default function App() {
  // Keep sample dates fixed while navigating. Replace with saved data later.
  const [events] = useState(() => createSampleEvents(new Date()))
  return <CalendarDashboard events={events} isDemo />
}
