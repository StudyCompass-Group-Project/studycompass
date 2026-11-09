import React, { useState } from 'react';

export default function SettingsDashboard() {
  const [autoExport, setAutoExport] = useState(true);
  const [urgentAlerts, setUrgentAlerts] = useState(true);
  const [activeTheme, setActiveTheme] = useState('light');
  const [activeTone, setActiveTone] = useState('pure-white');

  return (
    <div className="bg-[#f9f9fa] font-['Inter'] text-[0.875rem] leading-[1.375rem] text-[#1a1c1d] antialiased min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#ffffff] z-50 flex flex-col justify-between py-[1.5rem] px-[1rem] shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-[1.5rem]">
          {/* Logo & Branding */}
          <div className="flex items-center gap-[0.5rem] px-[0.5rem]">
            <img
              alt="StudyCompass Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1XXCovpfMLAGpqyqDTvrxSmPTeoxMRf_CIQc3TH6kgTf8112HlP_cv6EyEP91yc8tRtxMN0wXkCjwwpc2KzbrpUMxGEAjwsLFqZJooeACd6B-0K5a7wDl5JDcRb69pBhMYzIKusd6Kb49KxgUnH16uunnRangt7NIh0wPPPVyA4_2H7Ix3eg53JaSXCyF7iG5ayEiNK7HkknRJDTmUrQFt8lXhOO9EF9omE_rY7_o3xoeF10vWNAYogSf8"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-[1rem] leading-none tracking-tight text-[#1a1c1d]">
                StudyCompass
              </span>
              <span className="text-[0.75rem] leading-4 tracking-wider text-[#5f5e61] uppercase mt-[0.25rem]">
                Academic OS
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="px-[0.25rem]">
            <button
              className="w-full flex items-center justify-center gap-[0.5rem] bg-[#000000] text-[#ffffff] font-medium text-[0.875rem] py-[0.5rem] px-[1rem] rounded-lg hover:bg-[#1c1b1b] hover:text-[#858383] transition-all active:scale-[0.98]"
              type="button"
            >
              <span className="material-symbols-outlined text-[1.125rem]">add</span>
              <span>Upload Syllabus</span>
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-[0.25rem]">
            <a
              className="flex items-center gap-[1rem] px-[1rem] py-[0.5rem] rounded-lg text-[#444748] hover:bg-[#eeeeef] hover:text-[#1a1c1d] transition-all font-medium text-[0.875rem]"
              href="#"
            >
              <span className="material-symbols-outlined text-[1.25rem]">calendar_today</span>
              <span>Calendar Dashboard</span>
            </a>
            <a
              className="flex items-center gap-[1rem] px-[1rem] py-[0.5rem] rounded-lg text-[#444748] hover:bg-[#eeeeef] hover:text-[#1a1c1d] transition-all font-medium text-[0.875rem]"
              href="#"
            >
              <span className="material-symbols-outlined text-[1.25rem]">book_2</span>
              <span>My Courses</span>
            </a>
            <a
              className="flex items-center gap-[1rem] px-[1rem] py-[0.5rem] rounded-lg text-[#444748] hover:bg-[#eeeeef] hover:text-[#1a1c1d] transition-all font-medium text-[0.875rem]"
              href="#"
            >
              <span className="material-symbols-outlined text-[1.25rem]">schedule</span>
              <span>Study Availability</span>
            </a>
            <a
              aria-current="page"
              className="flex items-center gap-[1rem] px-[1rem] py-[0.5rem] rounded-lg transition-all bg-[#1c1b1b] text-[#858383] font-medium text-[0.875rem]"
              href="#"
            >
              <span className="material-symbols-outlined text-[1.25rem]">tune</span>
              <span>Settings</span>
            </a>
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="flex flex-col gap-[0.5rem] pt-[1rem] bg-[#ffffff]">
          <div className="flex items-center justify-between p-[0.5rem] rounded-xl bg-[#f3f3f4]">
            <div className="flex items-center gap-[0.5rem] min-w-0">
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover shrink-0"
                src="https://lh3.googleusercontent.com/aida/AEtjO1WfRQ6q0RtWLFGV4mn5lE1nmI7QKlnRaN3ZihTVUgPTFmvLFnuoaHvoi9ZFJHBxvvkHJmd1KV4CGIAewo9UFkNUB3AdpYP61A6kfM-O_iBhDPOYeybULJzHtOz2tHckIpgv3wR1JQS2gahhmJxKf-Qqh3ybDbyCR8_DtTYkUPZYc69pecSqlx524PXDQGaqCDu7V9DkzYNj-DEZk8YXN75vs3rinkxtQkvGY9vwXJMdXmpFwdSM0ukzgLo"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-[0.875rem] text-[#1a1c1d] truncate leading-tight">
                  Elena Rostova
                </span>
                <span className="text-[0.75rem] leading-4 text-[#5f5e61] truncate">
                  Fall Semester
                </span>
              </div>
            </div>
            <div className="flex items-center">
              <button
                className="p-[0.25rem] text-[#444748] hover:text-[#1a1c1d] hover:bg-[#eeeeef] rounded transition-colors"
                title="Help & System"
                type="button"
              >
                <span className="material-symbols-outlined text-[1.125rem]">help_outline</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-72">
        {/* Header Bar */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-[#f9f9fa]/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-[2.5rem]">
          <div className="flex items-center gap-[1rem] flex-1 max-w-lg">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-[1rem] top-1/2 -translate-y-1/2 text-[#444748] text-[1.125rem]">
                search
              </span>
              <input
                className="w-full bg-[#ffffff] pl-10 pr-[1rem] py-[0.25rem] h-10 rounded-lg text-[0.75rem] font-normal text-[#1a1c1d] placeholder:text-[#5f5e61] focus:outline-none ring-1 ring-[#c4c7c7] focus:ring-[#000000] transition-all"
                placeholder="Search syllabi, assignments, exam dates..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-[1rem]">
            <div className="flex items-center gap-[0.25rem] bg-[#f3f3f4] px-[1rem] py-[0.25rem] rounded-lg ring-1 ring-[#c4c7c7]">
              <span className="material-symbols-outlined text-[#5f5e61] text-[1.125rem]">school</span>
              <span className="font-semibold text-[0.75rem] text-[#1a1c1d] uppercase tracking-wider">
                Fall 2024
              </span>
              <span className="material-symbols-outlined text-[#5f5e61] text-[1rem]">unfold_more</span>
            </div>
            <button
              className="p-[0.25rem] text-[#444748] hover:text-[#1a1c1d] hover:bg-[#eeeeef] rounded-lg transition-colors flex items-center gap-[0.25rem]"
              title="Quick Export"
              type="button"
            >
              <span className="material-symbols-outlined text-[1.25rem]">ios_share</span>
            </button>
            <button
              className="p-[0.25rem] text-[#444748] hover:text-[#1a1c1d] hover:bg-[#eeeeef] rounded-lg transition-colors relative"
              title="Notifications"
              type="button"
            >
              <span className="material-symbols-outlined text-[1.25rem]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#000000] rounded-full"></span>
            </button>
            <div className="h-5 w-px bg-[#e8e8e9] mx-[0.25rem]"></div>
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-[#c4c7c7]"
              src="https://lh3.googleusercontent.com/aida/AEtjO1WfRQ6q0RtWLFGV4mn5lE1nmI7QKlnRaN3ZihTVUgPTFmvLFnuoaHvoi9ZFJHBxvvkHJmd1KV4CGIAewo9UFkNUB3AdpYP61A6kfM-O_iBhDPOYeybULJzHtOz2tHckIpgv3wR1JQS2gahhmJxKf-Qqh3ybDbyCR8_DtTYkUPZYc69pecSqlx524PXDQGaqCDu7V9DkzYNj-DEZk8YXN75vs3rinkxtQkvGY9vwXJMdXmpFwdSM0ukzgLo"
            />
          </div>
        </header>

        {/* Page Container */}
        <main className="relative pt-16 bg-[#f9f9fa] min-h-screen w-full px-[2.5rem] py-[2.5rem]">
          <div className="flex flex-col w-full">
            {/* Page Header Banner */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-[1rem] mb-[2.5rem] pb-[1.5rem] bg-[#f3f3f4]/40 p-[1.5rem] rounded-xl">
              <div className="flex flex-col gap-[0.25rem] max-w-2xl">
                <div className="flex items-center gap-[0.25rem] text-[#5f5e61] text-[0.75rem] uppercase tracking-widest">
                  <span className="material-symbols-outlined text-[1rem]">tune</span>
                  <span>Preferences • System 02</span>
                </div>
                <h1 className="font-bold text-[2.25rem] leading-none text-[#1a1c1d] tracking-tight">
                  Account Settings &amp; Integrations
                </h1>
                <p className="text-[0.875rem] text-[#5f5e61] mt-[0.25rem]">
                  Manage calendar synchronization, appearance customization, and academic notification rules.
                </p>
              </div>
              <div className="flex items-center gap-[0.5rem] shrink-0">
                <div className="flex items-center gap-[0.25rem] px-[1rem] py-[0.25rem] rounded-full bg-[#eeeeef] text-[#5f5e61] text-[0.75rem]">
                  <span className="w-2 h-2 rounded-full bg-[#000000] animate-pulse"></span>
                  <span>Cloud Sync: Active</span>
                </div>
                <button
                  className="flex items-center gap-[0.25rem] bg-[#000000] text-[#ffffff] px-[1rem] py-[0.25rem] rounded-lg font-medium text-[0.875rem] hover:bg-[#1c1b1b] transition-all active:scale-[0.98]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[1.125rem]">save</span>
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

            {/* Main 2-Column Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[1.5rem]">
              {/* Left Column (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-[1.5rem]">
                {/* Student Profile Card */}
                <section className="bg-[#ffffff] rounded-xl p-[1.5rem] shadow-sm flex flex-col gap-[1.5rem] relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-[1rem]">
                      <div className="relative">
                        <img
                          alt="Elena Rostova Headshot"
                          className="w-20 h-20 rounded-xl object-cover grayscale contrast-125 bg-[#e8e8e9]"
                          src="https://lh3.googleusercontent.com/aida/AEtjO1WfRQ6q0RtWLFGV4mn5lE1nmI7QKlnRaN3ZihTVUgPTFmvLFnuoaHvoi9ZFJHBxvvkHJmd1KV4CGIAewo9UFkNUB3AdpYP61A6kfM-O_iBhDPOYeybULJzHtOz2tHckIpgv3wR1JQS2gahhmJxKf-Qqh3ybDbyCR8_DtTYkUPZYc69pecSqlx524PXDQGaqCDu7V9DkzYNj-DEZk8YXN75vs3rinkxtQkvGY9vwXJMdXmpFwdSM0ukzgLo"
                        />
                        <button
                          className="absolute -bottom-1 -right-1 bg-[#000000] text-[#ffffff] p-1 rounded-md hover:bg-[#1c1b1b] transition-colors"
                          title="Update avatar"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[0.875rem]">photo_camera</span>
                        </button>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-[0.25rem] flex-wrap">
                          <h2 className="font-semibold text-[1.25rem] text-[#1a1c1d]">Elena Rostova</h2>
                          <span
                            className="material-symbols-outlined text-[#5f5e61] text-[1.125rem]"
                            title="Verified Academic Identity"
                          >
                            verified
                          </span>
                        </div>
                        <span className="text-[0.75rem] text-[#5f5e61] truncate">
                          elena.rostova@university.edu
                        </span>
                        <div className="flex items-center gap-[0.25rem] mt-[0.25rem]">
                          <span className="px-[0.25rem] py-0.5 rounded bg-[#eeeeef] text-[#1a1c1d] text-[0.75rem]">
                            FALL 2024
                          </span>
                          <span className="px-[0.25rem] py-0.5 rounded bg-[#eeeeef] text-[#1a1c1d] text-[0.75rem]">
                            Senior Yr
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="p-[0.25rem] rounded-lg text-[#5f5e61] hover:text-[#1a1c1d] hover:bg-[#eeeeef] transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[1.25rem]">edit</span>
                    </button>
                  </div>

                  <div className="p-[1rem] rounded-lg bg-[#f3f3f4] flex flex-col gap-[0.25rem]">
                    <span className="text-[0.75rem] text-[#5f5e61] uppercase tracking-wider">
                      Affiliation
                    </span>
                    <p className="font-semibold text-[1rem] text-[#1a1c1d] leading-snug">
                      Department of Computer Science &amp; Economics
                    </p>
                    <div className="flex items-center gap-[0.5rem] mt-[0.25rem] text-[#5f5e61] text-[0.75rem]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[1rem]">badge</span> ID: #CS-89021
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[1rem]">grade</span> GPA: 3.92
                      </span>
                    </div>
                  </div>
                </section>

                {/* Calendar Integrations Panel */}
                <section className="bg-[#ffffff] rounded-xl p-[1.5rem] shadow-sm flex flex-col gap-[1.5rem]">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h2 className="font-semibold text-[1rem] text-[#1a1c1d]">Calendar Integrations</h2>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Synchronize course timelines and exam alerts
                      </span>
                    </div>
                    <span className="text-[0.75rem] px-[0.25rem] py-0.5 rounded bg-[#e8e8e9] text-[#1a1c1d]">
                      1 Connected
                    </span>
                  </div>

                  {/* Provider 1: Google Calendar (Connected) */}
                  <div className="p-[1rem] rounded-xl bg-[#f3f3f4] flex flex-col gap-[0.5rem]">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-[0.5rem]">
                        <div className="w-9 h-9 rounded-lg bg-[#ffffff] flex items-center justify-center text-[#1a1c1d] shadow-sm">
                          <span className="material-symbols-outlined text-[1.25rem]">event_available</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-[0.25rem]">
                            <span className="font-semibold text-[1rem] text-[#1a1c1d]">Google Calendar</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e2e2e3] text-[#1a1c1d] text-[0.75rem]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#000000]"></span>
                              CONNECTED
                            </span>
                          </div>
                          <span className="text-[0.75rem] text-[#5f5e61]">
                            Syncs 2-ways automatically • Updated 4m ago
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-[0.25rem]">
                      <button
                        className="text-[#1a1c1d] hover:underline font-semibold text-[0.75rem] flex items-center gap-1"
                        type="button"
                      >
                        <span>Manage Calendars</span>
                        <span className="material-symbols-outlined text-[1rem]">arrow_forward</span>
                      </button>
                      <button className="text-[#ba1a1a] font-semibold text-[0.75rem] hover:underline" type="button">
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Provider 2: Apple Calendar */}
                  <div className="p-[1rem] rounded-xl bg-[#ffffff] shadow-[0_0_0_1px_rgba(0,0,0,0.06)] flex items-center justify-between">
                    <div className="flex items-center gap-[0.5rem]">
                      <div className="w-9 h-9 rounded-lg bg-[#f3f3f4] flex items-center justify-center text-[#5f5e61]">
                        <span className="material-symbols-outlined text-[1.25rem]">today</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-[1rem] text-[#1a1c1d]">Apple Calendar (iCal)</span>
                        <span className="text-[0.75rem] text-[#5f5e61]">Export direct subscription link</span>
                      </div>
                    </div>
                    <button
                      className="px-[1rem] py-1.5 rounded-lg bg-[#eeeeef] text-[#1a1c1d] font-semibold text-[0.75rem] hover:bg-[#e8e8e9] transition-colors"
                      type="button"
                    >
                      Connect
                    </button>
                  </div>

                  {/* Provider 3: Outlook Calendar */}
                  <div className="p-[1rem] rounded-xl bg-[#ffffff] shadow-[0_0_0_1px_rgba(0,0,0,0.06)] flex items-center justify-between">
                    <div className="flex items-center gap-[0.5rem]">
                      <div className="w-9 h-9 rounded-lg bg-[#f3f3f4] flex items-center justify-center text-[#5f5e61]">
                        <span className="material-symbols-outlined text-[1.25rem]">calendar_month</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-[1rem] text-[#1a1c1d]">Outlook Calendar</span>
                        <span className="text-[0.75rem] text-[#5f5e61]">Microsoft 365 Exchange sync</span>
                      </div>
                    </div>
                    <button
                      className="px-[1rem] py-1.5 rounded-lg bg-[#eeeeef] text-[#1a1c1d] font-semibold text-[0.75rem] hover:bg-[#e8e8e9] transition-colors"
                      type="button"
                    >
                      Connect
                    </button>
                  </div>

                  {/* Dynamic Toggle Option */}
                  <div className="pt-[1rem] flex items-start justify-between gap-[1rem] bg-[#f3f3f4]/60 p-[1rem] rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[1rem] text-[#1a1c1d]">Auto-export study sessions</span>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Convert dynamic homework blocks into distinct agenda invites.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        checked={autoExport}
                        className="sr-only peer"
                        onChange={() => setAutoExport(!autoExport)}
                        type="checkbox"
                      />
                      <div className="w-11 h-6 bg-[#e8e8e9] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#ffffff] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#ffffff] after:border-[#eeeeef] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#000000]"></div>
                    </label>
                  </div>
                </section>

                {/* Storage Metric */}
                <section className="p-[1rem] rounded-xl bg-[#ffffff] shadow-sm flex flex-col gap-[0.25rem]">
                  <div className="flex justify-between items-center text-[#5f5e61] text-[0.75rem]">
                    <span>PARSED SYLLABI STORAGE</span>
                    <span>48.2 MB / 500 MB</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e8e8e9] rounded-full overflow-hidden">
                    <div className="h-full bg-[#000000] rounded-full w-[10%]"></div>
                  </div>
                </section>
              </div>

              {/* Right Column (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-[1.5rem]">
                {/* Appearance & Customization */}
                <section className="bg-[#ffffff] rounded-xl p-[1.5rem] shadow-sm flex flex-col gap-[1.5rem]">
                  <div className="flex items-center justify-between pb-[0.5rem] bg-[#ffffff]">
                    <div className="flex flex-col">
                      <h2 className="font-semibold text-[1rem] text-[#1a1c1d]">Appearance &amp; Customization</h2>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Tune typography density and ambient study themes
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[#5f5e61]">palette</span>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex flex-col gap-[0.25rem]">
                    <span className="text-[0.75rem] text-[#5f5e61] uppercase tracking-wider">
                      Interface Mode
                    </span>
                    <div className="grid grid-cols-3 gap-[0.5rem]">
                      <button
                        className={`flex items-center justify-center gap-[0.25rem] p-[1rem] rounded-lg font-medium text-[0.875rem] shadow-sm transition-colors ${
                          activeTheme === 'light'
                            ? 'bg-[#000000] text-[#ffffff]'
                            : 'bg-[#eeeeef] text-[#1a1c1d] hover:bg-[#e8e8e9]'
                        }`}
                        onClick={() => setActiveTheme('light')}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">light_mode</span>
                        <span>Light</span>
                      </button>
                      <button
                        className={`flex items-center justify-center gap-[0.25rem] p-[1rem] rounded-lg font-medium text-[0.875rem] transition-colors ${
                          activeTheme === 'dark'
                            ? 'bg-[#000000] text-[#ffffff]'
                            : 'bg-[#eeeeef] text-[#1a1c1d] hover:bg-[#e8e8e9]'
                        }`}
                        onClick={() => setActiveTheme('dark')}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">dark_mode</span>
                        <span>Dark</span>
                      </button>
                      <button
                        className={`flex items-center justify-center gap-[0.25rem] p-[1rem] rounded-lg font-medium text-[0.875rem] transition-colors ${
                          activeTheme === 'system'
                            ? 'bg-[#000000] text-[#ffffff]'
                            : 'bg-[#eeeeef] text-[#1a1c1d] hover:bg-[#e8e8e9]'
                        }`}
                        onClick={() => setActiveTheme('system')}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[1.125rem]">desktop_windows</span>
                        <span>System</span>
                      </button>
                    </div>
                  </div>

                  {/* Canvas Tone Selector Swatches */}
                  <div className="flex flex-col gap-[0.25rem] pt-[0.25rem]">
                    <span className="text-[0.75rem] text-[#5f5e61] uppercase tracking-wider">
                      Canvas Workspace Tone
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[0.5rem]">
                      {/* Swatch 1: Pure White */}
                      <button
                        className={`flex flex-col p-[0.5rem] rounded-lg bg-[#f3f3f4] text-left shadow-sm ${
                          activeTone === 'pure-white' ? 'ring-2 ring-[#000000]' : 'hover:bg-[#eeeeef]'
                        }`}
                        onClick={() => setActiveTone('pure-white')}
                        type="button"
                      >
                        <div className="w-full h-10 rounded bg-[#FFFFFF] shadow-inner mb-[0.25rem] flex items-center justify-center">
                          {activeTone === 'pure-white' && (
                            <span className="material-symbols-outlined text-[#000000] text-[1.125rem]">
                              check
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-[0.875rem] text-[#1a1c1d] leading-tight">
                          Pure White
                        </span>
                        <span className="text-[0.75rem] text-[#5f5e61]">#FFFFFF</span>
                      </button>

                      {/* Swatch 2: Warm Paper */}
                      <button
                        className={`flex flex-col p-[0.5rem] rounded-lg bg-[#f3f3f4] text-left shadow-sm ${
                          activeTone === 'warm-paper' ? 'ring-2 ring-[#000000]' : 'hover:bg-[#eeeeef]'
                        }`}
                        onClick={() => setActiveTone('warm-paper')}
                        type="button"
                      >
                        <div className="w-full h-10 rounded bg-[#F4F1EA] shadow-inner mb-[0.25rem] flex items-center justify-center">
                          {activeTone === 'warm-paper' && (
                            <span className="material-symbols-outlined text-[#000000] text-[1.125rem]">
                              check
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-[0.875rem] text-[#1a1c1d] leading-tight">
                          Warm Paper
                        </span>
                        <span className="text-[0.75rem] text-[#5f5e61]">#F4F1EA</span>
                      </button>

                      {/* Swatch 3: Cool Slate */}
                      <button
                        className={`flex flex-col p-[0.5rem] rounded-lg bg-[#f3f3f4] text-left shadow-sm ${
                          activeTone === 'cool-slate' ? 'ring-2 ring-[#000000]' : 'hover:bg-[#eeeeef]'
                        }`}
                        onClick={() => setActiveTone('cool-slate')}
                        type="button"
                      >
                        <div className="w-full h-10 rounded bg-[#EEF0F2] shadow-inner mb-[0.25rem] flex items-center justify-center">
                          {activeTone === 'cool-slate' && (
                            <span className="material-symbols-outlined text-[#000000] text-[1.125rem]">
                              check
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-[0.875rem] text-[#1a1c1d] leading-tight">
                          Cool Slate
                        </span>
                        <span className="text-[0.75rem] text-[#5f5e61]">#EEF0F2</span>
                      </button>

                      {/* Swatch 4: Contrast Ink */}
                      <button
                        className={`flex flex-col p-[0.5rem] rounded-lg bg-[#f3f3f4] text-left shadow-sm ${
                          activeTone === 'contrast-ink' ? 'ring-2 ring-[#000000]' : 'hover:bg-[#eeeeef]'
                        }`}
                        onClick={() => setActiveTone('contrast-ink')}
                        type="button"
                      >
                        <div className="w-full h-10 rounded bg-[#111111] shadow-inner mb-[0.25rem] flex items-center justify-center">
                          {activeTone === 'contrast-ink' && (
                            <span className="material-symbols-outlined text-[#ffffff] text-[1.125rem]">
                              check
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-[0.875rem] text-[#1a1c1d] leading-tight">
                          Contrast Ink
                        </span>
                        <span className="text-[0.75rem] text-[#5f5e61]">#111111</span>
                      </button>
                    </div>
                  </div>

                  {/* Backdrop Uploader Card */}
                  <div className="flex flex-col gap-[0.25rem] pt-[0.25rem]">
                    <span className="text-[0.75rem] text-[#5f5e61] uppercase tracking-wider">
                      Custom Background Backdrop
                    </span>
                    <div className="p-[1rem] rounded-xl bg-[#f3f3f4] flex flex-col sm:flex-row items-center justify-between gap-[1rem]">
                      <div className="flex items-center gap-[1rem] w-full sm:w-auto">
                        <div className="w-20 h-14 rounded-lg bg-[#e8e8e9] overflow-hidden shrink-0 flex items-center justify-center relative">
                          <div
                            className="absolute inset-0 bg-cover bg-center grayscale"
                            style={{
                              backgroundImage:
                                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDIb0e0gpDmmPZi548k6WyszqFE0_-q6cUa73mGi2DJ0TbuC7od-qOb9Y5v7wAa85yBOlKSAS7y0KqGlVLaNUyyv3-svO5ayRA4bl4G9xu8WeArvJVCH2MDRvrj7pC-ml3hRUpUgmX4ROQOLTOI_TJnEX70nQHdYnmn90pkDadYtBxgaZ37pxumQRGFfs7Wi9XzBITtrRqXCGSQHRvMJUIlwQ16_Q5kPpgSUOb1-3o')",
                            }}
                          ></div>
                          <div className="absolute inset-0 bg-black/10"></div>
                          <span className="material-symbols-outlined text-[#ffffff] relative z-10 text-[1rem]">
                            wallpaper
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[1rem] text-[#1a1c1d] truncate">
                            arch-minimal-04.jpg
                          </span>
                          <span className="text-[0.75rem] text-[#5f5e61]">
                            3840 × 2160 • 1.4 MB JPEG
                          </span>
                          <span className="text-[0.75rem] text-[#5f5e61]">Applied opacity: 12% overlay</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-[0.25rem] shrink-0 w-full sm:w-auto justify-end">
                        <button
                          className="px-[1rem] py-1.5 rounded-lg bg-[#ffffff] text-[#1a1c1d] font-semibold text-[0.75rem] shadow-sm hover:bg-[#eeeeef] transition-colors"
                          type="button"
                        >
                          Change Photo
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-[#5f5e61] hover:text-[#ba1a1a] hover:bg-[#eeeeef] transition-colors"
                          title="Remove backdrop"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[1.25rem]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Notifications Panel */}
                <section className="bg-[#ffffff] rounded-xl p-[1.5rem] shadow-sm flex flex-col gap-[1.5rem]">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h2 className="font-semibold text-[1rem] text-[#1a1c1d]">
                        Notifications &amp; Academic Reminders
                      </h2>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Deliver targeted alerts without notification fatigue
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[#5f5e61]">notifications_active</span>
                  </div>

                  <div className="flex flex-col gap-[1rem]">
                    {/* Item 1 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[0.5rem] p-[1rem] rounded-lg bg-[#f3f3f4]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[1rem] text-[#1a1c1d]">Study Session Reminders</span>
                        <span className="text-[0.75rem] text-[#5f5e61]">
                          Pre-session ping prior to scheduled focus window
                        </span>
                      </div>
                      <div className="relative min-w-[180px]">
                        <select
                          className="w-full bg-[#ffffff] text-[#1a1c1d] font-medium text-[0.875rem] px-[1rem] py-2 rounded-lg appearance-none shadow-sm cursor-pointer pr-8 focus:outline-none"
                          defaultValue="15 min before"
                        >
                          <option>15 min before</option>
                          <option>5 min before</option>
                          <option>30 min before</option>
                          <option>1 hour before</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f5e61] text-[1rem]">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[0.5rem] p-[1rem] rounded-lg bg-[#f3f3f4]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[1rem] text-[#1a1c1d]">Upcoming Deadline Alerts</span>
                        <span className="text-[0.75rem] text-[#5f5e61]">
                          Consolidated syllabus assignment overview
                        </span>
                      </div>
                      <div className="relative min-w-[180px]">
                        <select
                          className="w-full bg-[#ffffff] text-[#1a1c1d] font-medium text-[0.875rem] px-[1rem] py-2 rounded-lg appearance-none shadow-sm cursor-pointer pr-8 focus:outline-none"
                          defaultValue="Daily 8:00 AM briefing"
                        >
                          <option>Daily 8:00 AM briefing</option>
                          <option>Daily 6:00 PM recap</option>
                          <option>Weekly Monday digest</option>
                          <option>Real-time updates</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f5e61] text-[1rem]">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-start justify-between gap-[1rem] p-[1rem] rounded-lg bg-[#f3f3f4]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-[0.25rem]">
                          <span className="font-semibold text-[1rem] text-[#1a1c1d]">Urgent Exam Alerts</span>
                          <span className="text-[0.75rem] px-1.5 py-0.5 rounded bg-[#e8e8e9] text-[#1a1c1d]">
                            CRITICAL
                          </span>
                        </div>
                        <span className="text-[0.75rem] text-[#5f5e61]">
                          Trigger high-priority 48-hour exam countdown and seat checks.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                        <input
                          checked={urgentAlerts}
                          className="sr-only peer"
                          onChange={() => setUrgentAlerts(!urgentAlerts)}
                          type="checkbox"
                        />
                        <div className="w-11 h-6 bg-[#e8e8e9] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#ffffff] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#ffffff] after:border-[#eeeeef] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#000000]"></div>
                      </label>
                    </div>
                  </div>
                </section>

                {/* Account Security & Session */}
                <section className="bg-[#ffffff] rounded-xl p-[1.5rem] shadow-sm flex flex-col gap-[1rem]">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h2 className="font-semibold text-[1rem] text-[#1a1c1d]">Account Security &amp; Session</h2>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Authentication protocols and client info
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[#5f5e61]">security</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1rem] pt-[0.25rem]">
                    {/* 2FA Card */}
                    <div className="p-[1rem] rounded-lg bg-[#f3f3f4] flex flex-col justify-between gap-[0.5rem]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[1rem] text-[#1a1c1d]">Two-Factor Auth</span>
                        <span className="inline-flex items-center gap-1 text-[0.75rem] px-2 py-0.5 rounded-full bg-[#e8e8e9] text-[#1a1c1d]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#000000]"></span>
                          ENABLED
                        </span>
                      </div>
                      <span className="text-[0.75rem] text-[#5f5e61]">
                        Configured using Authenticator App (TOTP)
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}