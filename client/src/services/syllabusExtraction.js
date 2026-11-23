import { addDays, toDateKey } from '../utils/calendar.js'
import { sourceMetadata, validateSyllabusFile } from '../utils/syllabus.js'

// Replace this adapter with the future server API. Keep the normalized review
// model and manual approval boundary. Never put a provider key in client code.
// These fixtures are deliberately unrelated to the selected file's contents.
export function createSampleExtraction(file, now = new Date(), id = crypto.randomUUID()) {
  const error = validateSyllabusFile(file)
  if (error) throw new Error(error)
  return {
    id,
    isSample: true,
    source: sourceMetadata(file),
    course: {
      name: 'Introduction to Computer Science (sample)',
      code: 'CS 101',
      instructor: 'Sample instructor',
      term: 'Sample term',
      topics: 'Problem solving\nAlgorithms\nData structures',
      notes: 'Sample information for testing the review flow. Replace it with details from your syllabus.',
    },
    deadlines: [
      { id: 'assignment', title: 'Problem set 1 (sample)', kind: 'Assignment', topic: 'Problem solving', date: toDateKey(addDays(now, 1)), time: '23:59', notes: '' },
      { id: 'quiz', title: 'Algorithms quiz (sample)', kind: 'Quiz', topic: 'Algorithms', date: toDateKey(addDays(now, 3)), time: '', notes: 'No due time supplied. Leave blank unless your syllabus specifies one.' },
      { id: 'project', title: 'Project proposal (sample)', kind: 'Project', topic: 'Data structures', date: toDateKey(addDays(now, 10)), time: '17:00', notes: '' },
    ],
  }
}

export async function extractSyllabus(file, { signal } = {}) {
  const error = validateSyllabusFile(file)
  if (error) throw new Error(error)
  signal?.throwIfAborted()
  // A short cancellable delay lets the frontend exercise its processing state.
  await new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, 900)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  return createSampleExtraction(file)
}
