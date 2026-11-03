import assert from 'node:assert/strict'
import test from 'node:test'
import { getPasswordRequirements, validateCreateAccount, validateSignIn } from './auth.js'

const validAccount = {
  email: 'student+comp490@example.edu',
  username: 'student_490',
  password: 'Example1!',
  confirmPassword: 'Example1!',
  permission: true,
}

test('sign-in reports missing fields and accepts email or username without imposing signup rules', () => {
  assert.deepEqual(Object.keys(validateSignIn()), ['identity', 'password'])
  assert.ok(validateSignIn({ identity: '   ', password: 'x' }).identity)
  for (const identity of ['student@example.edu', '@student_490', 'student_490']) {
    assert.deepEqual(validateSignIn({ identity, password: 'old' }), {})
  }
})

test('registration requires all fields and explicit syllabus permission', () => {
  assert.deepEqual(Object.keys(validateCreateAccount()), [
    'email', 'username', 'password', 'confirmPassword', 'permission',
  ])
  assert.deepEqual(validateCreateAccount(validAccount), {})
  assert.deepEqual(Object.keys(validateCreateAccount({ ...validAccount, permission: false })), ['permission'])
})

test('registration validates email and username boundaries while allowing outer whitespace on identifiers', () => {
  for (const email of ['student', 'student@', '@example.edu', 'a b@example.edu', 'a@b@c.edu']) {
    assert.ok(validateCreateAccount({ ...validAccount, email }).email, email)
  }
  for (const username of ['ab', 'x'.repeat(31), 'student name', '@student', 'student!']) {
    assert.ok(validateCreateAccount({ ...validAccount, username }).username, username)
  }
  for (const username of ['abc', 'x'.repeat(30)]) {
    assert.deepEqual(validateCreateAccount({ ...validAccount, username }), {})
  }
  assert.deepEqual(validateCreateAccount({
    ...validAccount, email: ' student@example.edu ', username: ' student_490 ',
  }), {})
})

test('password confirmation is exact: case and trailing spaces are significant', () => {
  for (const confirmPassword of ['example1!', 'Example1! ', 'Example1']) {
    assert.ok(validateCreateAccount({ ...validAccount, confirmPassword }).confirmPassword)
  }
  assert.deepEqual(validateCreateAccount({
    ...validAccount, password: ' Example1! ', confirmPassword: ' Example1! ',
  }), {})
})

test('the requirement meter does not mistake whitespace or non-Latin letters for a symbol', () => {
  for (const password of ['Example1 ', 'Example1\t', 'Example1é']) {
    assert.equal(getPasswordRequirements(password)[2].met, false)
    assert.ok(validateCreateAccount({ ...validAccount, password, confirmPassword: password }).password)
  }
  assert.equal(getPasswordRequirements('Example1!')[2].met, true)
  assert.equal(getPasswordRequirements('Example1🔑')[2].met, true)
})

test('the character minimum uses Unicode code points and all three requirements must be met', () => {
  assert.equal(getPasswordRequirements('🔑🔑🔑🔑1!')[0].met, false)
  for (const password of ['Short1!', 'Example!!', 'Example12']) {
    assert.ok(validateCreateAccount({ ...validAccount, password, confirmPassword: password }).password)
  }
  assert.deepEqual(validateCreateAccount({
    ...validAccount, password: 'Abcdef1!', confirmPassword: 'Abcdef1!',
  }), {})
})
