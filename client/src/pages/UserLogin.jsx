import { useEffect, useRef, useState } from 'react'
import AuthIcon from '../components/auth/AuthIcon.jsx'
import SignInForm from '../components/auth/SignInForm.jsx'
import CreateAccountForm from '../components/auth/CreateAccountForm.jsx'
import './UserLogin.css'

const tabs = [
  { id: 'signin', label: 'Sign In' },
  { id: 'signup', label: 'Create Account' },
]

export default function UserLogin({ onPreviewContinue }) {
  const [activeTab, setActiveTab] = useState('signin')
  const tabRefs = useRef([])
  const resetDialog = useRef(null)

  useEffect(() => {
    document.title = `StudyCompass | ${activeTab === 'signin' ? 'Sign In' : 'Create Account'}`
  }, [activeTab])

  function handleTabKey(event, index) {
    let nextIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') nextIndex = 1 - index
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = 1
    else return
    event.preventDefault()
    setActiveTab(tabs[nextIndex].id)
    tabRefs.current[nextIndex].focus()
  }

  return (
    <div className="sc-auth">
      <a className="sc-auth-skip" href="#sc-auth-main">Skip to account access</a>
      <header className="sc-auth-header">
        <div className="sc-auth-brand">
          <AuthIcon name="compass" size={32} />
          <span>StudyCompass</span>
        </div>
        <span className="sc-auth-preview-badge"><span aria-hidden="true" /> Preview</span>
      </header>
      <main className="sc-auth-main" id="sc-auth-main" tabIndex={-1}>
        <section className="sc-auth-card" aria-labelledby="sc-auth-title">
          <div className="sc-auth-card-heading">
            <span className="sc-auth-emblem"><AuthIcon name="compass" size={32} /></span>
            <div>
              <h1 id="sc-auth-title">StudyCompass Engine</h1>
              <p>Access portal for your academic workspace</p>
            </div>
          </div>
          <div className="sc-auth-tabs" role="tablist" aria-label="Account access">
            {tabs.map((tab, index) => (
              <button key={tab.id} id={`sc-auth-tab-${tab.id}`} type="button" role="tab"
                ref={element => { tabRefs.current[index] = element }}
                aria-selected={activeTab === tab.id} aria-controls={`sc-auth-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)} onKeyDown={event => handleTabKey(event, index)}>
                {tab.label}
              </button>
            ))}
          </div>
          {tabs.map(tab => (
            <div key={tab.id} id={`sc-auth-panel-${tab.id}`} role="tabpanel"
              aria-labelledby={`sc-auth-tab-${tab.id}`} hidden={activeTab !== tab.id}>
              {/* Unmount inactive forms so passwords/errors are discarded on a tab change. */}
              {activeTab === tab.id && (tab.id === 'signin'
                ? <SignInForm onForgotPassword={() => resetDialog.current.showModal()} />
                : <CreateAccountForm onPreviewContinue={onPreviewContinue} />)}
            </div>
          ))}
          <p className="sc-auth-preview-note" id="sc-auth-preview-note">
            Preview only. Sign-in, registration, and remembered sessions are not yet available.
            {' '}Details entered here are not sent or saved.
          </p>
        </section>
      </main>
      <dialog className="sc-auth-dialog" ref={resetDialog} aria-labelledby="sc-auth-reset-title"
        aria-describedby="sc-auth-reset-description">
        <div className="sc-auth-dialog-heading">
          <h2 id="sc-auth-reset-title">Password recovery</h2>
          <button type="button" className="sc-auth-close" aria-label="Close password recovery"
            onClick={() => resetDialog.current.close()}><AuthIcon name="close" /></button>
        </div>
        <p id="sc-auth-reset-description">
          Password reset is not available in this preview. No reset email has been sent.
          You’ll be able to recover your account when sign-in is available.
        </p>
        <button type="button" className="sc-auth-submit" onClick={() => resetDialog.current.close()}>
          Back to sign in
        </button>
      </dialog>
    </div>
  )
}
