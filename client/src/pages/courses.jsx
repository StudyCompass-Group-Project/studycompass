import React, { useRef, useState } from "react";

const userCourses = [
  {
    code: "CS-101 • Core Technical", title: "Intro to Computer Science",
    instructor: "Prof. Alan Vance", credits: "4.0 CR", schedule: "Lecture: Mon, Wed, Fri 10:00 – 11:15 AM",
    scheduleIcon: "calendar_today", parsed: "100% Parsed", meta: "14 assign, 2 midterms",
    deadlines: [["Problem Set 3 (Trees)", "Oct 24", "primary"], ["Midterm Exam 1", "Nov 02", "secondary"]],
    metric: "STUDY LOAD", metricValue: "4.5 hrs planned", metricDetail: "3 Study Sessions scheduled this week", progress: 75, action: "Project Steps"
  },
  {
    code: "ECON-204 • Social Analytics", title: "Macroeconomic Theory",
    instructor: "Dr. Sarah Lin", credits: "3.0 CR", schedule: "Lecture: Tue, Thu 2:00 – 3:20 PM",
    scheduleIcon: "calendar_today", parsed: "100% Parsed", meta: "On Track",
    deadlines: [["Chapter 6 Reading", "Tomorrow", "error"], ["Policy Memo (Fiscal)", "Oct 28", "secondary"]],
    metric: "CURRICULUM VOLUME", metricValue: "8 readings • 1 term paper", metricDetail: "2 Study Sprints booked (3.0 hrs total)", progress: 50, action: "Study Plan"
  },
  {
    code: "BIO-120 • Natural Sciences", title: "General Biology & Lab",
    instructor: "Dr. Marcus Reed", credits: "4.0 CR", schedule: "Lab Sessions: Tuesdays 1:00 – 3:50 PM",
    scheduleIcon: "biotech", parsed: "100% Parsed", meta: "Needs 2h study",
    deadlines: [["Lab Report 4 (Cell Mitosis)", "Friday", "primary"], ["Quiz 5 (Photosynthesis)", "Monday", "secondary"]],
    metric: "LAB ACCELERATOR", metricValue: "6 reports • weekly quizzes", metricDetail: "Gap detected before Friday lab test", progress: 32, action: "Lab Milestones"
  }
];

const Icon = ({ children, className = "" }) => (
  <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>
);

function CourseCard({ course }) {
  return (
    <article className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-mono text-xs uppercase text-gray-500">{course.code}</span>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-gray-900">{course.title}</h2>
          </div>
          <button className="rounded p-1 text-gray-500 hover:text-black" aria-label={`${course.title} settings`}><Icon>more_vert</Icon></button>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-2 text-gray-900">
            <Icon className="text-base text-gray-500">person</Icon><span>{course.instructor}</span><span className="text-gray-400">•</span><span className="font-mono text-xs text-gray-500">{course.credits}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500"><Icon className="text-base">{course.scheduleIcon}</Icon><span>{course.schedule}</span></div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-100 p-2.5 text-sm">
          <div className="flex items-center gap-2"><Icon className="text-lg text-black">verified</Icon><span className="font-semibold text-gray-900">{course.parsed}</span></div>
          <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${course.meta.includes("Needs") ? "bg-red-100 text-red-800" : "bg-gray-200 text-gray-700"}`}>{course.meta}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-gray-500">Next Deadlines</span>
          {course.deadlines.map(([name, date, color]) => (
            <div key={name} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100">
              <div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${color === "error" ? "bg-red-600" : color === "primary" ? "bg-black" : "bg-gray-400"}`} /><span className="text-sm text-gray-900">{name}</span></div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs ${date === "Tomorrow" ? "bg-red-100 text-red-800" : "bg-gray-200 text-gray-800"}`}>{date}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2 font-mono text-xs text-gray-500"><span>{course.metric}</span><span className="font-semibold text-gray-900">{course.metricValue}</span></div>
          <div className="flex items-center gap-2 text-sm text-gray-600"><Icon className="text-base">{course.progress === 32 ? "warning" : "schedule"}</Icon><span className={course.progress === 32 ? "text-red-600" : ""}>{course.metricDetail}</span></div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200"><div className={`h-full rounded-full ${course.progress === 32 ? "bg-red-600" : "bg-black"}`} style={{ width: `${course.progress}%` }} /></div>
        </div>
      </div>
      <div className="mt-6 flex gap-2 border-t-0 pt-4">
        <button className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200">Details</button>
        <button className="flex-1 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800">{course.action}</button>
      </div>
    </article>
  );
}

export default function Courses() {
  const [activeTab, setActiveTab] = useState("All Courses (3)");
  const [filter, setFilter] = useState("");
  const [files, setFiles] = useState([]);
  const fileInput = useRef(null);
  const tabs = ["All Courses (3)", "STEM & Labs (2)", "Humanities (1)", "Completed (0)"];
  const visibleCourses = userCourses.filter(c => {
    const matchesText = `${c.title} ${c.code} ${c.instructor}`.toLowerCase().includes(filter.toLowerCase());
    const matchesTab = activeTab === "All Courses (3)" || (activeTab === "STEM & Labs (2)" && ["CS-101", "BIO-120"].some(code => c.code.startsWith(code))) || (activeTab === "Humanities (1)" && c.code.startsWith("ECON"));
    return matchesText && matchesTab;
  });
  const addFiles = list => setFiles(prev => [...prev, ...Array.from(list).map(file => file.name)]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-sm text-gray-900 antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col justify-between bg-white px-4 py-6 shadow-sm lg:flex">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white"><Icon className="text-2xl">explore</Icon></div>
            <div><div className="text-base font-semibold tracking-tight">StudyCompass</div><div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-500">Academic OS</div></div>
          </div>
          <button onClick={() => fileInput.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 font-medium text-white transition hover:bg-gray-800"><Icon>add</Icon>Upload Syllabus</button>
          <nav className="flex flex-col gap-1">
            {[["calendar_today","Calendar Dashboard"],["book_2","My Courses"],["schedule","Study Availability"],["tune","Settings"]].map(([icon,label], i) => <a key={label} href="#" className={`flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition ${i === 1 ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-black"}`}><Icon>{icon}</Icon>{label}</a>)}
          </nav>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 font-semibold">ER</div><div><div className="font-medium">Elena Rostova</div><div className="text-xs text-gray-500">Fall Semester</div></div></div><button aria-label="Help"><Icon>help_outline</Icon></button>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white/90 px-4 backdrop-blur-xl md:px-8">
          <div className="relative w-full max-w-lg"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-500">search</Icon><input className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 outline-none transition focus:border-gray-500" placeholder="Search syllabi, assignments, exam dates..." /></div>
          <div className="hidden items-center gap-3 sm:flex"><div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider"><Icon>school</Icon>Fall 2024<Icon>unfold_more</Icon></div><button aria-label="Export" className="p-2 text-gray-500 hover:text-black"><Icon>ios_share</Icon></button><button aria-label="Notifications" className="relative p-2 text-gray-500 hover:text-black"><Icon>notifications</Icon><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black" /></button><div className="h-6 w-px bg-gray-200" /><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold">ER</div></div>
        </header>
        <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-8 md:px-8">
          <section className="flex flex-col gap-6 pb-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div><div className="mb-2 flex items-center gap-2"><span className="font-mono text-xs uppercase tracking-widest text-gray-500">Academic Operating Environment</span><span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />Sync Active</span></div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Enrolled Courses — Fall 2024</h1></div>
              <div className="flex flex-wrap gap-2"><button className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3 font-medium transition hover:bg-gray-200"><Icon>tune</Icon>Semester Prefs</button><button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-black px-4 py-3 font-medium text-white transition hover:bg-gray-800"><Icon>upload_file</Icon>+ Add Course / Upload Syllabus</button></div>
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
              {[["Active Credits","11","Credits (Full Time)",73],["Timeline Progression","Week 8","of 15 (Midterm Span)",53.3],["Due This Cycle","7","Upcoming Milestones",40],["Execution Trajectory","On Track","94% Completion",94]].map(([label,value,detail,progress]) => <div key={label} className="rounded-lg bg-gray-50 p-4"><div className="font-mono text-xs uppercase tracking-wider text-gray-500">{label}</div><div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-2xl font-bold">{value}</span><span className="text-xs text-gray-500">{detail}</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-black" style={{width: `${progress}%`}} /></div></div>)}
            </div>
          </section>
          <section className="flex flex-col justify-between gap-4 pb-6 md:flex-row md:items-center">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">{tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === tab ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"}`}>{tab}</button>)}</div>
            <div className="relative w-full md:w-64"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-500">filter_list</Icon><input value={filter} onChange={e => setFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 outline-none focus:border-gray-500" placeholder="Filter courses..." /></div>
          </section>
          <section className="grid grid-cols-1 gap-6 pb-8 md:grid-cols-2 xl:grid-cols-3">{visibleCourses.map(course => <CourseCard key={course.code} course={course} />)}</section>
          <section className="mb-8 rounded-xl bg-white p-5 shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-4 pb-6 lg:flex-row lg:items-center"><div><div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-500"><Icon className="text-lg text-black">auto_awesome</Icon>AI Syllabus Engine</div><h3 className="text-xl font-semibold tracking-tight">Syllabus Engine &amp; Course Importer</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Instantly convert course PDFs, Word documents, or LMS syllabi into structured timelines, assignment countdowns, and optimal study blocks.</p></div><div className="hidden text-right sm:block"><div className="font-mono text-xs font-semibold">ENGINE v2.4</div><div className="text-xs text-gray-500">Zero Cloud Leakage Guarantee</div></div></div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div onClick={() => fileInput.current?.click()} onDragOver={e => {e.preventDefault(); e.currentTarget.classList.add("bg-gray-200");}} onDragLeave={e => e.currentTarget.classList.remove("bg-gray-200")} onDrop={e => {e.preventDefault(); e.currentTarget.classList.remove("bg-gray-200"); addFiles(e.dataTransfer.files);}} className="group flex cursor-pointer flex-col items-center justify-center rounded-xl bg-gray-50 p-8 text-center transition hover:bg-gray-100 lg:col-span-7">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm transition group-hover:scale-105"><Icon className="text-3xl">cloud_upload</Icon></div><div className="font-semibold">Drag &amp; drop syllabus files here</div><div className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Supports PDF, DOCX, TXT, or Canvas export packages up to 35MB</div><div className="mt-5 flex flex-wrap items-center justify-center gap-3"><button type="button" className="rounded-lg bg-black px-4 py-2 font-medium text-white">Browse Hard Drive</button><span className="font-mono text-[10px] tracking-wider text-gray-500">OR CONNECT CANVAS / BLACKBOARD</span></div>
              </div>
              <div className="flex flex-col justify-between rounded-xl bg-gray-50 p-4 lg:col-span-5"><div><div className="mb-3 flex items-center justify-between gap-2"><span className="font-mono text-xs uppercase tracking-wider text-gray-500">Extraction Queue (Recent)</span><span className="font-mono text-xs font-medium text-gray-900">All Completed</span></div><div className="flex flex-col gap-2">{(files.length ? files : ["CS101_Syllabus_Fall24.pdf","Macro_Econ_CourseOutline.docx","BIO120_Lab_Manual_Syllabus.pdf"]).map((name,i) => <div key={`${name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 shadow-sm"><div className="flex min-w-0 items-center gap-3"><Icon className="text-gray-500">description</Icon><div className="min-w-0"><div className="truncate text-xs font-medium">{name}</div><div className="text-xs text-gray-500">{files.length ? "Added to import queue" : [ "16 deliverables extracted", "9 deliverables extracted", "12 deliverables extracted"][i]}</div></div></div><Icon className="text-lg text-black">check_circle</Icon></div>)}</div></div><div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs text-gray-500"><span className="flex items-center gap-1"><Icon className="text-base">lock</Icon>Private local vector processing</span><button className="font-medium text-gray-900 hover:underline">View History</button></div></div>
            </div>
            <input ref={fileInput} type="file" multiple accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={e => addFiles(e.target.files)} />
          </section>
        </main>
      </div>
    </div>
  );
}
