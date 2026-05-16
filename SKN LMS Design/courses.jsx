/* global React, AppShell, Icon */

function CoursesListPage({ theme }) {
  const courses = [
    { subj: "Biology",   title: "MDCAT Biology · Complete",    instr: "Dr. Saeed Akhtar",   pct: 64, total: 18, done: 12, mcqs: 4820, c: "#16a34a", hot: true },
    { subj: "Chemistry", title: "Inorganic + Physical Combo",  instr: "Sir Bilal Hashmi",   pct: 88, total: 14, done: 12, mcqs: 3100, c: "var(--p600)" },
    { subj: "Physics",   title: "Conceptual Physics for MDCAT",instr: "Dr. Asma Q.",        pct: 32, total: 16, done: 5,  mcqs: 2840, c: "var(--o500)" },
    { subj: "English",   title: "MDCAT English · Grammar+Comp",instr: "Ma'am Mariam",       pct: 92, total: 10, done: 9,  mcqs: 1450, c: "#2563eb" },
    { subj: "Logic",     title: "Logical Reasoning Crash",     instr: "Saeed Sir",          pct: 12, total: 8,  done: 1,  mcqs: 740,  c: "#ec4899" },
    { subj: "Mock",      title: "Full-length Mock Series '25", instr: "SKN Faculty Panel",  pct: 45, total: 12, done: 5,  mcqs: 2400, c: "#0891b2", live: true },
  ];

  return (
    <AppShell theme={theme} active="My Courses" title="My Courses" subtitle="6 enrolled · 4 active this week"
      action={<>
        <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13} /> Filters</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={13} /> Browse catalogue</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
        {/* Filter row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {["All", "Biology", "Chemistry", "Physics", "English", "Logic", "Mocks"].map((t, i) => (
            <button key={t} className={i === 0 ? "btn btn-solid btn-sm" : "btn btn-ghost btn-sm"} style={i === 0 ? { background: "var(--text)", color: "var(--bg-canvas)" } : {}}>{t}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sort by</div>
          <select className="field" style={{ width: 160, padding: "7px 12px" }}>
            <option>Recently studied</option>
            <option>% complete</option>
          </select>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 9, padding: 2 }}>
            <button className="btn btn-ghost btn-xs" style={{ borderColor: "transparent", background: "var(--bg-muted)" }}><Icon name="grid" size={13} /></button>
            <button className="btn btn-ghost btn-xs" style={{ borderColor: "transparent" }}><Icon name="list" size={13} /></button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, flex: 1, alignContent: "flex-start" }}>
          {courses.map((c) => <CourseCard key={c.title} {...c} />)}
        </div>
      </div>
    </AppShell>
  );
}

function CourseCard({ subj, title, instr, pct, total, done, mcqs, c, hot, live }) {
  return (
    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Cover */}
      <div style={{
        height: 110, background: `linear-gradient(135deg, ${c} 0%, var(--p700) 100%)`,
        position: "relative", overflow: "hidden", padding: 16, color: "#fff",
      }}>
        <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.13)" }} />
        <div style={{ position: "absolute", bottom: -50, right: 60, width: 100, height: 100, borderRadius: "50%", background: "rgba(0,0,0,.15)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.18em", textTransform: "uppercase", opacity: .9, padding: "4px 8px", background: "rgba(0,0,0,.18)", borderRadius: 999 }}>{subj}</span>
          {hot && <span className="chip" style={{ background: "#fff", color: "var(--p700)" }}>🔥 Hot</span>}
          {live && <span className="chip" style={{ background: "#fff", color: "var(--red)" }}>● LIVE</span>}
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{title}</div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>{instr.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{instr}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
          <span>{done}/{total} modules</span>
          <span>{mcqs.toLocaleString()} MCQs</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--grad-brand-vivid)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)" }}>{pct}%</div>
          <button className="btn btn-primary btn-xs"><Icon name="play" size={11} /> Continue</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================== */

function CourseDetailPage({ theme }) {
  return (
    <AppShell theme={theme} active="My Courses">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          <a style={{ color: "var(--text-muted)" }}>My Courses</a>
          <Icon name="chevronR" size={12} /> <span style={{ color: "var(--text)" }}>Biology</span>
          <Icon name="chevronR" size={12} /> <span style={{ color: "var(--text-strong)", fontWeight: 700 }}>Coordination & Control</span>
        </div>

        {/* Course hero */}
        <div className="card" style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <span className="chip chip-green"><Icon name="check" size={11} /> Biology</span>
              <span className="chip chip-violet">12 lessons</span>
              <span className="chip chip-muted">4h 32m total</span>
              <span className="chip chip-amber"><Icon name="star" size={11} /> 4.9</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-strong)" }}>Coordination & Control</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 560, lineHeight: 1.55 }}>
              Master nervous coordination, reflex arcs, the endocrine system, and chemical coordination — paired with 340 MCQs from the official MDCAT bank.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary"><Icon name="play" size={14} /> Resume · Lesson 8</button>
              <button className="btn btn-ghost btn-sm"><Icon name="bookmark" size={13} /> Save</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={13} /> Notes PDF</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="placeholder" style={{ height: 150 }}>cover-image · 16:10</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>Progress</span><b style={{ color: "var(--text)" }}>64% · 8 / 12</b>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
              <div style={{ width: "64%", height: "100%", background: "var(--grad-brand-vivid)" }} />
            </div>
          </div>
        </div>

        {/* Tabs + content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, flex: 1, minHeight: 0 }}>
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
              {[
                { l: "Curriculum", active: true }, { l: "Notes" }, { l: "MCQs · 340" }, { l: "Discussion · 28" }, { l: "Resources" },
              ].map((t) => (
                <div key={t.l} style={{
                  padding: "0 0 10px", fontSize: 13, fontWeight: t.active ? 700 : 500,
                  color: t.active ? "var(--text)" : "var(--text-muted)",
                  borderBottom: t.active ? "2px solid var(--p600)" : "2px solid transparent",
                  cursor: "pointer",
                }}>{t.l}</div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
              <Module n="01" t="Introduction to Coordination" dur="8 min" done />
              <Module n="02" t="Nervous Coordination · The Neuron" dur="14 min" done />
              <Module n="03" t="Reflex Arc & Reflex Action" dur="22 min" done />
              <Module n="04" t="Central Nervous System" dur="18 min" done />
              <Module n="05" t="Peripheral Nervous System" dur="16 min" done />
              <Module n="06" t="Endocrine System Overview" dur="20 min" done />
              <Module n="07" t="Hypothalamus & Pituitary" dur="24 min" done />
              <Module n="08" t="Thyroid & Adrenal Glands" dur="22 min" active />
              <Module n="09" t="Pancreas & Insulin Regulation" dur="19 min" />
              <Module n="10" t="Feedback Loops in Mammals" dur="17 min" locked />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Your stats here</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Mini k="Accuracy" v="74%" tone="green" />
                <Mini k="MCQs solved" v="118 / 340" tone="violet" />
                <Mini k="Time on chapter" v="2h 14m" tone="orange" />
                <Mini k="Last attempt" v="2 days ago" tone="blue" />
              </div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Up next</div>
              <Module n="09" t="Pancreas & Insulin" dur="19 min" compact />
              <Module n="10" t="Feedback Loops" dur="17 min" compact locked />
            </div>
            <div className="card" style={{ padding: 14, background: "var(--bg-inset)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="sparkles" size={14} /> AI study tip
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>
                You missed 4/6 reflex-arc questions on last attempt. Re-watch Lesson 03 (22 min) then take a 10-MCQ drill before moving on.
              </div>
              <button className="btn btn-primary btn-xs" style={{ marginTop: 10 }}>Run drill</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Module({ n, t, dur, done, active, locked, compact }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: compact ? "8px 0" : "11px 12px",
      borderRadius: 10,
      background: active ? "color-mix(in srgb, var(--p500) 8%, transparent)" : "transparent",
      border: active ? "1px solid var(--p400)" : "1px solid transparent",
      opacity: locked ? .55 : 1,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: done ? "color-mix(in srgb, var(--green) 14%, transparent)" : "var(--bg-muted)",
        color: done ? "var(--green)" : "var(--text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
      }}>
        {done ? <Icon name="check" size={14} stroke={2.5} /> : locked ? <Icon name="lock" size={12} /> : n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dur} · video · notes · 12 MCQs</div>
      </div>
      {active && !compact && <button className="btn btn-primary btn-xs"><Icon name="play" size={10} /> Resume</button>}
      {!active && !done && !locked && !compact && <button className="btn btn-ghost btn-xs">Start</button>}
    </div>
  );
}
function Mini({ k, v, tone }) {
  const map = { violet: "var(--p700)", green: "var(--green)", orange: "var(--o600)", blue: "var(--blue)" };
  return (
    <div style={{ padding: 12, background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--border-faint)" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: map[tone], marginTop: 4 }}>{v}</div>
    </div>
  );
}

window.CoursesListPage = CoursesListPage;
window.CourseDetailPage = CourseDetailPage;
