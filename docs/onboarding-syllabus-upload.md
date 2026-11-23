# Syllabus upload and manual review

Branch: `onboarding-syllabus-upload`, based on `onboarding-study-availability`
at `d2fcbd934c73eb518af3ab8e2c264a0540143e45`.

The existing onboarding placeholder is replaced with two pages:
availability → syllabus upload → manual review → calendar dashboard.
This is a frontend preview; visual LLM integration is intentionally deferred.

## Run locally

From your existing repository:

```sh
git fetch origin
git switch --track origin/onboarding-syllabus-upload
cd client
npm ci
npm run dev
```

If the branch already exists locally, use `git switch onboarding-syllabus-upload`.
Open Vite's printed URL. Use the existing Create Account preview with dummy
values, or open `#/onboarding-study-availability` directly. Add/save or clear
any in-progress commitment, then choose Save & continue to syllabus upload.

| Route | Purpose |
| --- | --- |
| `#/onboarding-study-availability` | Step 1: save unavailable time |
| `#/syllabus-upload` | Step 2: choose a file and start sample extraction |
| `#/syllabus-review` | Step 3: edit and confirm the draft |
| `#/calendar-dashboard` | View approved deadlines, course details, and blocked time |

Upload/review require the availability step to be completed. Direct review
navigation without a draft shows a helpful empty state. The dashboard's upload
button and upload card now lead back to the working upload page.

## Current behavior

- Choose or drop one PDF, PNG, JPG, or JPEG, up to 10 MiB. Empty files,
  unsupported extensions/MIME types, oversized files, and multi-file drops
  produce an error. File-content parsing and the planned PDF page-count limit
  are deferred to the real extraction service.
- Select **Continue with sample extraction** to exercise the cancellable
  processing state. Completion automatically opens the manual-review page.
  Leaving the upload page cancels its pending request.
- The sample course and three deadlines are independent of the file's contents.
  Every page identifies this as a preview. No file upload or provider request
  occurs, and no API key is needed.
- Review the original PDF/image alongside editable course name, code, instructor,
  term, topics, notes, and deadlines. Add a missing deadline, remove one, or undo
  the latest removal. The layout stacks the source and form on small screens.
- Each deadline requires a title and real date. A missing time remains blank and
  appears as **time not specified** on the calendar. Undated work can be kept in
  course notes instead. A course can be confirmed without deadlines.
- Confirm the review checkbox, then choose **Confirm & open calendar**. Editing
  another field clears confirmation. Invalid fields are reported and focused.
- Only approved records become calendar events. The calendar opens to the week
  of the earliest deadline in the most recently approved course. Search, course
  filtering, week/month views, and event details use the existing calendar.
- Reviewed course details, including topics and notes, are available in expandable
  summaries above the calendar. Existing availability and other reviewed courses
  are retained when another syllabus is approved.

## State and persistence

`App.jsx` owns a syllabus state separate from the existing availability state.
The key `studycompass.preview.syllabus.v1` stores one draft plus reviewed courses
in `sessionStorage`. The single save at approval commits the reviewed record and
clears its draft together. Re-approving the same review ID replaces its record
instead of duplicating calendar events.

Draft changes save as you edit. Refresh restores text and dates, including
incomplete fields. File bytes and object URLs are never serialized. After a
refresh, reselect the same original file to restore its preview. Metadata is
checked to avoid accidentally attaching a different source.

If a draft save fails, edits remain in memory and the page reports that they are
not saved; browser unload is guarded. Failed approval leaves the previous saved
calendar data intact and does not navigate. Invalid or different-time-zone saved
data is reported without silently overwriting storage. Reset requires an explicit
confirmation and clears only syllabus preview data. Starting a new signup preview
starts a fresh availability/syllabus preview, as this is not real account storage.

This anonymous, device-local tab state is not an authenticated user account,
cross-device persistence, study-plan generation, or external calendar sync.
Dates/times follow the device's local time zone. Closing the tab can discard it.

## Files and next week's integration

| File | Responsibility |
| --- | --- |
| `client/src/pages/OnboardingSyllabusUpload.jsx` | File selection, instructions, errors, cancellation, and routing |
| `client/src/pages/SyllabusManualReview.jsx` | Editable review, validation, and confirmation |
| `client/src/pages/OnboardingSyllabus.css` | Shared responsive upload/review styles |
| `client/src/components/syllabus/SyllabusLayout.jsx` | Shared header and progress indicator |
| `client/src/components/syllabus/SyllabusSource.jsx` | Original file preview and reattachment |
| `client/src/services/syllabusExtraction.js` | Replaceable asynchronous sample extraction adapter |
| `client/src/utils/syllabus.js` | Validation, storage, approval, and calendar conversion |
| `client/src/utils/syllabus.test.js` | Tests for the review/approval boundary and persistence |

The future server endpoint can replace `extractSyllabus(file, { signal })`.
Normalize its response to the same `course` and `deadlines` fields; leave
uncertain or absent values empty for manual review. Update the current
sample-only validator and the preview copy when real responses are supported.
Add server-side file/content/page-limit checks, authenticated account ownership,
PostgreSQL persistence, and an explicit user time zone at that time. Provider
credentials belong on the server. Preserve the manual confirmation boundary.

## Verification

```sh
cd client
npm test
TZ=America/Los_Angeles npm test
npm run build
```

All 39 automated tests pass in both UTC and America/Los_Angeles. The production
build passes. Tests cover supported/rejected files, real date validation,
missing-time handling, unapproved-data exclusion, preserving edits/removals,
empty courses, duplicate approval, multiple courses, draft restoration, storage
failures, corrupted data, time-zone mismatch, and cancellation, plus the existing
auth, calendar, and availability tests.

Browser checks verified adding an availability block and continuing to the new
upload page. The subsequent file-picker test stalled and was interrupted;
end-to-end upload/review/calendar interaction and responsive visual inspection
remain to be verified in a local browser. Suggested check: select a PDF, edit a
title/date, remove a sample deadline, refresh and resume, confirm, and verify the
exact resulting calendar items while the availability block remains visible.
