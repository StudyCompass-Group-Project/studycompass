# Calendar dashboard implementation

This first implementation follows the Google Stitch calendar dashboard export:
light gray background, dark navigation and study blocks, a weekly timetable,
and schedule summary cards. It covers the frontend work in issues #29, #31,
#33, #35, and #36 under Calendar Dashboard #10.

## Run it

From the repository root:

```sh
cd client
npm ci
npm run dev
```

Use the Node version already agreed on by the team. Open the local URL Vite
prints. The dashboard is the app's starting page; no router or extra package
is required.

## Start reading here

| File | Responsibility |
| --- | --- |
| `client/src/App.jsx` | Creates sample data once and renders the dashboard. |
| `client/src/pages/CalendarDashboard.jsx` | Owns the selected date, view, search, course filter, and open item. |
| `client/src/pages/CalendarDashboard.css` | Dashboard styles and responsive layout, using the `sc-` prefix to avoid collisions with other pages. |
| `client/src/components/calendar/DashboardSidebar.jsx` | Brand, navigation, and student preview. |
| `client/src/components/calendar/CalendarToolbar.jsx` | Week/month switch and Previous, Next, Today buttons. |
| `client/src/components/calendar/CalendarViews.jsx` | Weekly timetable, monthly grid, event buttons, and legend. |
| `client/src/components/calendar/DashboardInsights.jsx` | Weekly study totals, today's items, and upcoming deadlines. |
| `client/src/components/calendar/EventDetailsDialog.jsx` | Accessible, read-only item popup. |
| `client/src/data/sampleCalendar.js` | Example classes, study sessions, commitments, and deadlines. |
| `client/src/utils/calendar.js` | Date calculations, sorting, filters, and overlap layout. |

For example, the Next button calls `onNavigate(1)`. The dashboard updates its
`date` state using `shiftDate`, and React renders the new week or month. Clicking
an event sets `selectedEvent`, which opens the details dialog; closing clears it.

## What works

- Monday–Sunday week view and complete month grids, including adjacent-month dates.
- Previous, Next, and Today navigation; today's date is highlighted.
- Distinct styles and labels for classes, study sessions, commitments, and deadlines.
- A separate deadline row keeps late due times visible. Timed sessions expand the
  timetable beyond its usual 08:00–20:00 window when needed; overlapping cards use lanes.
- Search by title, course, or description, plus a course filter and clear-filter control.
- Clickable events, today's items, and deadlines open a native modal dialog.
  Escape and Close dismiss it; focus returns to the opening control.
- Weekly totals derive from the event data; the summary cards are not affected by
  the calendar's search/course filters. Today's Flow and Next 7 Days stay anchored
  to today while navigating. Weekly Focus follows the week containing the selected date.
- Mobile layout stacks the summary cards and lets the calendar scroll inside its
  own container. Calendar headers and events scroll together.
- Empty, loading, and error states, with an optional retry callback.

## Sample data and future API integration

Sample dates are anchored to the current local week when the app first loads.
Navigating does not regenerate them. A reload starts a new sample set for the
current week. All sample data is marked in the UI; no changes are persisted.

`CalendarDashboard` accepts:

```jsx
<CalendarDashboard
  events={events}
  isDemo={false}
  loading={loading}
  error={errorMessage}
  onRetry={reloadSchedule}
/>
```

An event has this shape:

```js
{
  id: 'assignment-study-1',             // unique string
  title: 'Problem set review',
  course: 'CS 101',                     // empty string for personal items
  type: 'study',                       // study | class | commitment | deadline
  date: '2026-11-03',                   // local YYYY-MM-DD
  start: '15:00',                       // 24-hour HH:mm
  end: '16:30',                         // omitted for deadlines
  location: 'Main Library',            // optional
  description: 'Review tree traversal', // optional
  completed: false,
}
```

The data contract assumes valid dates, one local day per timed event, and an end
after its start (24:00 can represent the end of that day). Convert server
timestamps to the student's display time zone before mapping to this shape.
Split overnight/multi-day events into day segments at that boundary. Date helpers
avoid UTC parsing of date-only strings. The current day is captured when the page
loads; refresh a page left open overnight to update the Today marker and daily cards.

Issues #37 (saved data) and #38 (editing) remain future work. Navigation to teammates'
pages, syllabus upload, schedule generation, and external-calendar sync also need
their respective integrations. Unavailable navigation controls are disabled and
explained; the UI does not claim a calendar has synced or an upload has succeeded.

When the team adds routing, mount `CalendarDashboard` at the chosen calendar route,
move the sidebar into the shared layout, and connect its disabled destinations to
the actual pages. No dependencies or dependency versions changed in this work.

## Verify

```sh
cd client
npm run lint
npm test
npm run build
```

Date tests cover leap years, month/year boundaries, DST-sensitive local arithmetic,
overlapping sessions, early/late times, and combined search/course filtering. On
WSL/macOS/Linux also run `TZ=America/Los_Angeles npm test` to exercise Pacific time.

Manually check: switch views, navigate dates, use Today, search/filter then clear,
open a study session and a late deadline, close with Escape, and resize to a narrow
phone viewport. For API states, render with `events={[]}`, `loading`, and an `error`
message respectively before connecting a real API.

Validation for this change: the production build and Oxlint passed; all seven
date/layout/filter tests passed in UTC and America/Los_Angeles. Chromium checks
passed at desktop (1600px) and phone (390px) widths, including view/date navigation,
combined filters, late deadlines, popup focus restoration and Escape, keyboard
activation, and loading/error/retry/empty states, with no browser runtime errors.
