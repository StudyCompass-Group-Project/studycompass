# Study availability onboarding

The `onboarding-study-availability` branch connects the existing login preview
to a working availability page based on the supplied Stitch design. The same
blocked-time rules appear on the existing calendar dashboard and provide the
exclusion rules for the future study-plan generator.

This branch builds on `user-login` (`9d307a5`) and includes the dashboard components
from `codex/calendar-dashboard-ui` (`947f236`). The original `calendar-dashboard`
branch currently points to the starter code; the implemented dashboard is on
`codex/calendar-dashboard-ui`.

## Run and try it

```sh
git fetch origin
git switch --track origin/onboarding-study-availability
cd client
npm ci
npm run dev
```

If you already have the branch locally, use `git switch onboarding-study-availability`.
Open the URL printed by Vite. On Create Account, enter dummy values that pass
validation and choose **Continue to availability preview**. This previews the
post-registration flow; it does not create or authenticate an account.

You can also open these hash routes directly:

| Route | Page |
| --- | --- |
| `#/login` | Existing login and registration preview |
| `#/onboarding-study-availability` | Add, edit, and remove unavailable time |
| `#/calendar-dashboard` | Existing calendar with shared blocked commitments |
| `#/syllabus-upload` | Explicit next-step placeholder after availability is saved |

The upload screen points back to availability and the working calendar; it does
not pretend to upload or extract a syllabus. No new runtime dependencies or
dependency versions were added.

## Working behavior

- A fresh signup preview starts with an empty schedule, not the design's sample obligations.
- Add a name, category, selected weekdays, and start/end times. Weekly rules repeat
  on those weekdays; turn off Repeat every week to select one specific date.
- An end earlier than the start means an overnight commitment. For example,
  Sunday 10 PM–Monday 6 AM is shown as two calendar segments, including Monday
  morning when viewing the following week. Equal endpoints are rejected.
- Edit a block from its calendar preview or list. Removing it asks for confirmation;
  deleting a recurring block removes the whole rule and all its occurrences.
- Adding, editing, and removing blocks update the shared state only after the
  browser-tab save succeeds. Refresh retains the saved rules. Storage failures
  leave the previous saved schedule intact; damaged or different-time-zone data
  is not silently treated as valid empty availability.
- The week view and summaries update as you navigate. Overlaps count only once.
  Unblocked daytime hours refer to 7 AM–10 PM and are explicitly not a study-hours
  target. Night commitments remain visible and count toward total blocked hours.
- Save & continue requires adding/saving the current form or clearing it first.
  Continuing with no commitments is supported.
- The calendar's Study Availability navigation returns here. Commitment events
  are derived from the same rules for every viewed week/month. Course filtering
  retains personal availability blocks; text search can still filter them.
- If the calendar receives existing study events that overlap blocked hours, it
  reports the conflicts without silently moving or deleting those sessions.

## One shared data model

`App.jsx` owns availability and passes it to both pages. Derived calendar events
are never persisted as a separate source of truth. A future API/provider can
replace the browser-tab adapter while keeping the model and components.

```js
{
  version: 1,
  timeZone: 'America/Los_Angeles',
  completed: true,
  blocks: [{
    id: 'stable-uuid',
    title: 'Work shift',
    category: 'Work / Job',
    recurring: true,
    days: [0, 2, 4],       // Monday = 0, Sunday = 6
    date: '',              // YYYY-MM-DD for one-time blocks instead
    start: '13:30',         // local wall-clock HH:mm
    end: '16:30'            // earlier than start means following day
  }]
}
```

| File | Responsibility |
| --- | --- |
| `client/src/App.jsx` | Hash navigation and the single availability state/save boundary |
| `client/src/pages/OnboardingStudyAvailability.jsx` | Welcome, weekly preview, summaries, editing, removal, and continuation |
| `client/src/components/availability/BlockedTimeForm.jsx` | Accessible labeled form, recurrence choice, validation, and error focus |
| `client/src/components/availability/AvailabilityWeek.jsx` | Timed weekly preview with selectable blocks |
| `client/src/pages/OnboardingStudyAvailability.css` | Responsive Stitch-inspired styles scoped under `sc-availability` |
| `client/src/utils/availability.js` | Rules, calendar occurrences, available windows, plan-conflict guard, and preview storage |
| `client/src/pages/CalendarDashboard.jsx` | Displays shared rules and warns about conflicting supplied study events |
| `client/src/utils/availability.test.js` | Recurrence, overlap, overnight, storage, and scheduling-exclusion tests |

## Connecting study-plan generation

There is no study-plan generator in the repository yet. This change supplies its
shared exclusion logic; it does not claim that a complete generator is running.

Use `getAvailableStudyWindows(blocks, date, start, end)` to subtract blocked
commitments from an explicitly permitted study window. For example, an 8 AM–5 PM
study window with work from 9 AM–1 PM produces 8–9 AM and 1–5 PM. If the whole
window is blocked, the result is empty. The generator must report insufficient
time rather than schedule through a commitment or drop required work.

After placing sessions, run `assertStudyPlanRespectsAvailability` against the
**latest** shared blocks before accepting the complete plan:

```js
const windows = getAvailableStudyWindows(availability.blocks, date, '08:00', '17:00')
// The future generator places work within these windows and also respects
// classes, existing sessions, deadlines, dependencies, breaks, and daily limits.
assertStudyPlanRespectsAvailability(proposedSessions, availability.blocks)
// Only accept/save the proposal if validation succeeds.
```

The guard rejects the whole proposal if any session overlaps blocked time or has
invalid dates/times. Sessions may end exactly when a commitment starts, or start
exactly when it ends. Overnight study sessions must first be split into same-day
segments, following the dashboard's existing contract. Recurring constraints are
evaluated for each candidate date; they have no fixed preview-week expiry.

For real accounts, persist these rules in PostgreSQL under the authenticated user
ID, load them after successful registration/sign-in, and keep the user's chosen
IANA time zone. The server must repeat the conflict check and validate the
availability revision when committing a plan, so a concurrent availability edit
cannot allow an outdated proposal. Implement proper timezone conversion there;
this preview uses device-local wall-clock dates and rejects a restored draft
whose recorded zone differs from the device.

## Preview boundaries

The storage key is `studycompass.preview.availability.v1` in `sessionStorage`.
It is a single anonymous tab draft, not account storage, authentication, or
cross-device synchronization. Closing the tab can discard it. A new signup preview
starts a new draft; credentials and signup identifiers are never passed to or
saved with availability. Real authentication must navigate here only after the
server confirms account creation, using account-scoped saved data.

The copy avoids the export's unsupported promises about automatic transition
buffers and guaranteed burnout prevention. Users can include their own buffers
in commitments now. The form also fixes the duplicate category label, removes
hardcoded sample totals, and uses local SVG icons rather than remote assets.

## Verify

```sh
cd client
npm test
TZ=America/Los_Angeles npm test
npm run lint
npm run build
```

The suite includes existing auth/calendar checks plus availability validation,
weekly and one-time recurrence, midnight and overnight shifts, week/year and DST
boundaries, overlap deduplication, fully blocked windows, exact adjacency, whole-plan
rejection, malformed data, and storage failure handling.

Manual end-to-end check: enter valid dummy signup data, add a work block, edit it,
view it on the calendar, navigate to another week/month, return to availability,
remove the rule, and confirm its occurrences disappear. Test a one-time date and
an overnight shift. Refresh to confirm saved data, then check 390px and 320px layouts.

Validation performed: all 25 automated tests passed in UTC and Pacific time;
lint and the production build passed. Chromium checks passed for signup routing,
invalid-input focus, adding/editing/removing blocks, overlap totals, one-time and
overnight recurrence, shared calendar week/month views, refresh persistence,
unsaved-form guarding, empty continuation, storage failures and recovery, and
1440px/390px/320px layouts without page overflow or runtime errors. A separate
calendar check verified that a conflicting supplied study event is flagged and
retained, while shared commitments remain visible under course filtering and
recur in later months.
