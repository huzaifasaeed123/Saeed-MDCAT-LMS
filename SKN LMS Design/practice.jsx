/* global React, AppShell, Icon */

/* === Create Practice Test === */
function CreateTestPage({ theme }) {
  return (
    <AppShell theme={theme} active="Create Practice" title="Create Practice Test" subtitle="Build a custom drill in under 30 seconds"
      action={<button className="btn btn-ghost btn-sm"><Icon name="clock" size={13} /> Recent presets</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22, height: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

          {/* Step 1 — Question Bank */}
          <Step n={1} title="Pick a question bank" sub="Curated by SKN Faculty">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <Bank title="MDCAT 2025" qs="3,840" active />
              <Bank title="MDCAT 2024" qs="3,210" />
              <Bank title="NUMS Combined" qs="2,180" />
              <Bank title="AKU Past Papers" qs="1,650" />
              <Bank title="Sindh Board MCQs" qs="2,420" />
              <Bank title="Saeed Sir's Picks" qs="940" featured />
            </div>
          </Step>

          {/* Step 2 — Mode */}
          <Step n={2} title="Question mode" sub="What pool to draw from">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              <Mode label="Unused" n={2840} sel />
              <Mode label="Incorrect" n={134} tone="red" />
              <Mode label="Marked" n={42} tone="amber" />
              <Mode label="Omitted" n={91} tone="muted" />
              <Mode label="Correct" n={733} tone="green" />
            </div>
          </Step>

          {/* Step 3 — Subjects */}
          <Step n={3} title="Subjects" sub="Optional · narrow the scope">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <Cb l="Biology" n={1420} on />
              <Cb l="Chemistry" n={980} on />
              <Cb l="Physics" n={840} />
              <Cb l="English" n={420} />
              <Cb l="Logical Reasoning" n={180} />
              <Cb l="General Science" n={320} />
            </div>
          </Step>

          {/* Step 4 — Test settings */}
          <Step n={4} title="Test settings">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Number of MCQs" hint="max 200">
                <input className="field" defaultValue="40" />
              </Field>
              <Field label="Timer mode">
                <div style={{ display: "flex", gap: 6 }}>
                  {["Tutor", "Timed", "Untimed"].map((m, i) => (
                    <button key={m} className={i === 1 ? "btn btn-solid btn-sm" : "btn btn-ghost btn-sm"} style={{ flex: 1, ...(i === 1 ? { background: "var(--p600)" } : {}) }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Field label="Time per MCQ">
                <input className="field" defaultValue="72 seconds (avg)" />
              </Field>
              <Field label="Difficulty">
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ l: "Easy", c: "var(--green)" }, { l: "Med", c: "var(--amber)" }, { l: "Hard", c: "var(--red)" }, { l: "Mix", c: "var(--p600)" }].map((d, i) => (
                    <span key={d.l} className="chip" style={{ background: i === 3 ? d.c : "var(--bg-muted)", color: i === 3 ? "#fff" : "var(--text-muted)", cursor: "pointer", padding: "6px 12px" }}>{d.l}</span>
                  ))}
                </div>
              </Field>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <Toggle l="Shuffle questions" on />
              <Toggle l="Shuffle options" on />
              <Toggle l="Show explanations after each" />
              <Toggle l="Flag for spaced repetition" on />
            </div>
          </Step>
        </div>

        {/* Right rail — summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>
          <div className="card" style={{ padding: 18, background: "var(--bg-inset)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Test summary</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", marginTop: 6 }}>40 MCQs · 48 min</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>MDCAT 2025 · Unused · Bio + Chem · Mixed</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
              <Row l="Avg. accuracy this pool" v="71%" />
              <Row l="Est. score" v="29 / 40" pos />
              <Row l="Weak topic hits" v="14 MCQs" />
              <Row l="Streak bonus" v="+12 pts" pos />
            </div>

            <hr className="divider" style={{ margin: "16px 0" }} />

            <button className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              <Icon name="zap" size={15} /> Create Test
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8 }}>
              Save as preset
            </button>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Quick presets</div>
            <Preset l="Yesterday's Bio drill · 30 MCQs" />
            <Preset l="Chemistry weak-spot · 50 MCQs" />
            <Preset l="Mock #04 simulation · 200 MCQs" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Step({ n, title, sub, children }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9,
          background: "var(--grad-brand-vivid)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13,
        }}>{n}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
function Bank({ title, qs, active, featured }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      border: active ? "1.5px solid var(--p600)" : "1px solid var(--border)",
      background: active ? "color-mix(in srgb, var(--p500) 7%, transparent)" : "var(--bg-surface)",
      cursor: "pointer", position: "relative",
    }}>
      {featured && <span className="chip chip-orange" style={{ position: "absolute", top: 10, right: 10, fontSize: 9 }}>⭐ FEATURED</span>}
      <div style={{
        width: 30, height: 30, borderRadius: 8, marginBottom: 10,
        background: active ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
        color: active ? "#fff" : "var(--text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name="book" size={15} /></div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{qs} questions</div>
    </div>
  );
}
function Mode({ label, n, sel, tone }) {
  const map = { red: "var(--red)", amber: "var(--amber)", green: "var(--green)", muted: "var(--text-muted)" };
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      border: sel ? "1.5px solid var(--p600)" : "1px solid var(--border)",
      background: sel ? "color-mix(in srgb, var(--p500) 7%, transparent)" : "var(--bg-surface)",
      cursor: "pointer", textAlign: "center",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: tone ? map[tone] : "var(--text)" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2, letterSpacing: "-0.02em" }}>{n.toLocaleString()}</div>
    </div>
  );
}
function Cb({ l, n, on }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: 10, cursor: "pointer",
      border: on ? "1.5px solid var(--p600)" : "1px solid var(--border)",
      background: on ? "color-mix(in srgb, var(--p500) 6%, transparent)" : "var(--bg-surface)",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        background: on ? "var(--p600)" : "transparent",
        border: on ? "none" : "1.5px solid var(--border-strong)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      }}>{on && <Icon name="check" size={11} stroke={3} />}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, background: "var(--bg-muted)" }}>{n}</div>
    </label>
  );
}
function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Toggle({ l, on }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
      <div style={{
        width: 32, height: 18, borderRadius: 999, position: "relative",
        background: on ? "var(--p600)" : "var(--border-strong)",
        transition: "background .15s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, left: on ? 16 : 2,
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }} />
      </div>
      <span>{l}</span>
    </div>
  );
}
function Row({ l, v, pos }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{l}</span>
      <span style={{ fontWeight: 700, color: pos ? "var(--green)" : "var(--text)" }}>{v}</span>
    </div>
  );
}
function Preset({ l }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
      borderRadius: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer",
    }} onMouseOver={e => e.currentTarget.style.background = "var(--bg-muted)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
      <Icon name="clock" size={12} /> {l}
    </div>
  );
}

/* ============================================== */
/* === Test History === */
function TestHistoryPage({ theme }) {
  const tests = [
    { name: "Atomic Structure · Drill", date: "May 11", mcqs: 40, score: 32, pct: 80, status: "passed", subj: "Chemistry", mode: "Tutor", qb: "MDCAT 2025" },
    { name: "Reflex Arc · Targeted", date: "May 10", mcqs: 30, score: 18, pct: 60, status: "passed", subj: "Biology", mode: "Timed", qb: "Saeed Sir Picks" },
    { name: "Mock #03 — Full Length", date: "May 09", mcqs: 200, score: 138, pct: 69, status: "passed", subj: "All Subjects", mode: "Timed", qb: "Mock Series" },
    { name: "Electrostatics — Drill", date: "May 08", mcqs: 40, score: 12, pct: 30, status: "failed", subj: "Physics", mode: "Tutor", qb: "MDCAT 2025" },
    { name: "Capacitance Quick Quiz", date: "May 07", mcqs: 20, score: 8, pct: 40, status: "failed", subj: "Physics", mode: "Untimed", qb: "MDCAT 2025" },
    { name: "Tenses — English", date: "May 06", mcqs: 50, score: 46, pct: 92, status: "passed", subj: "English", mode: "Timed", qb: "MDCAT 2024" },
  ];
  return (
    <AppShell theme={theme} active="Test History" title="Test History" subtitle="43 total attempts · 38 completed · 5 abandoned"
      action={<button className="btn btn-primary btn-sm"><Icon name="zap" size={13} /> New practice test</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard k="Total tests" v="43" sub="this month" tone="violet" icon="doc" />
          <StatCard k="Completed" v="38" sub="88% completion" tone="green" icon="check" />
          <StatCard k="Avg score" v="68%" sub="↑ 4% vs last wk" tone="orange" icon="target" />
          <StatCard k="Best streak" v="9 in a row" sub="passed ≥70%" tone="blue" icon="flame" />
        </div>

        {/* Filters bar */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: "var(--bg-muted)", borderRadius: 9, flex: 1, minWidth: 260,
            }}>
              <Icon name="search" size={14} />
              <input placeholder="Search by test name, topic, chapter…" style={{ all: "unset", flex: 1, fontSize: 13, color: "var(--text)" }} />
            </div>
            <select className="field" style={{ width: 140, padding: "8px 12px" }}><option>All status</option></select>
            <select className="field" style={{ width: 140, padding: "8px 12px" }}><option>All modes</option></select>
            <select className="field" style={{ width: 140, padding: "8px 12px" }}><option>All subjects</option></select>
            <select className="field" style={{ width: 140, padding: "8px 12px" }}><option>All time</option></select>
            <button className="btn btn-ghost btn-sm"><Icon name="x" size={12} /> Clear</button>
          </div>
        </div>

        {/* Tests list */}
        <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "60px 1fr 110px 110px 110px 160px",
            gap: 14, padding: "12px 18px", fontSize: 10, fontFamily: "var(--mono)",
            color: "var(--text-faint)", letterSpacing: "0.15em", textTransform: "uppercase",
            borderBottom: "1px solid var(--border)",
          }}>
            <div>Score</div><div>Test</div><div>Subject</div><div>Mode</div><div>Date</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {tests.map((t) => <HistoryRow key={t.name} {...t} />)}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function HistoryRow({ name, date, mcqs, score, pct, status, subj, mode, qb }) {
  const ringColor = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 110px 110px 110px 160px",
      gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--border-faint)", alignItems: "center",
    }}>
      <div style={{ position: "relative", width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" stroke="var(--bg-muted)" strokeWidth="4" fill="none" />
          <circle cx="22" cy="22" r="18" stroke={ringColor} strokeWidth="4" fill="none" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 113} 113`} transform="rotate(-90 22 22)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{pct}%</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>{name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, color: "var(--text-muted)" }}>
          <span>{score}/{mcqs} correct</span> <span>·</span> <span>{qb}</span>
          {status === "passed" ? <span className="chip chip-green" style={{ fontSize: 9 }}>Passed</span> : <span className="chip chip-red" style={{ fontSize: 9 }}>Below 50%</span>}
        </div>
      </div>
      <span className="chip chip-blue" style={{ width: "fit-content" }}>{subj}</span>
      <span className="chip chip-violet" style={{ width: "fit-content" }}>{mode}</span>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{date}, 2026</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-xs"><Icon name="barchart" size={11} /> Results</button>
        <button className="btn btn-ghost btn-xs"><Icon name="eye" size={11} /> Review</button>
        <button className="btn btn-orange btn-xs">Retake</button>
      </div>
    </div>
  );
}
function StatCard({ k, v, sub, tone, icon }) {
  const map = { violet: "var(--p700)", green: "var(--green)", orange: "var(--o600)", blue: "var(--blue)" };
  return (
    <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: `color-mix(in srgb, ${map[tone]} 14%, transparent)`,
        color: map[tone], display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name={icon} size={18} /></div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{k}</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{v}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ============================================== */
/* === MCQ Reports (analytics) === */
function ReportsPage({ theme }) {
  return (
    <AppShell theme={theme} active="MCQ Reports" title="My MCQ Reports" subtitle="Deep dive into what you know — and what you don't"
      action={<button className="btn btn-ghost btn-sm"><Icon name="download" size={13} /> Export PDF</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
          {/* Accuracy trend chart */}
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Accuracy over time</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Last 30 days · all subjects</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["7d", "30d", "90d", "All"].map((p, i) => (
                  <button key={p} className={i === 1 ? "btn btn-solid btn-xs" : "btn btn-ghost btn-xs"} style={i === 1 ? { background: "var(--text)", color: "var(--bg-canvas)" } : {}}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, marginTop: 16, position: "relative", minHeight: 220 }}>
              <SparkChart />
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <Stat n="74%" l="Avg accuracy" up />
              <Stat n="138" l="MCQs / day" />
              <Stat n="62s" l="Avg per MCQ" down />
              <Stat n="9 / 10" l="Pass rate" up />
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="card" style={{ padding: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Subject breakdown</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Accuracy & volume per subject</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16, flex: 1 }}>
              <SubjBar s="Biology" a={82} v={1420} c="#16a34a" />
              <SubjBar s="Chemistry" a={74} v={980} c="var(--p600)" />
              <SubjBar s="Physics" a={51} v={840} weak c="var(--o500)" />
              <SubjBar s="English" a={91} v={420} c="var(--blue)" />
              <SubjBar s="Logic" a={66} v={180} c="#ec4899" />
            </div>
          </div>
        </div>

        {/* Bottom: weak topics */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Topics you're losing points on</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Below-target topics, sorted by impact on your mock score</div>
            </div>
            <button className="btn btn-orange btn-sm"><Icon name="target" size={13} /> Auto-drill all 5</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            <Weak subj="Physics" topic="Capacitance · Dielectrics" acc={32} attempts={38} c="var(--o500)" />
            <Weak subj="Chemistry" topic="Coordination compounds" acc={41} attempts={28} c="var(--p600)" />
            <Weak subj="Biology" topic="Mendelian Genetics" acc={48} attempts={42} c="var(--green)" />
            <Weak subj="Physics" topic="EM Induction" acc={52} attempts={26} c="var(--o500)" />
            <Weak subj="Chemistry" topic="Reaction kinetics" acc={56} attempts={31} c="var(--p600)" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SparkChart() {
  // synthetic 30-day data
  const pts = [55, 58, 52, 60, 64, 61, 58, 62, 66, 68, 65, 70, 72, 68, 70, 74, 71, 76, 73, 78, 75, 72, 80, 77, 82, 79, 81, 84, 80, 87];
  const max = 100, min = 30;
  const w = 100, h = 100;
  const path = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sgl" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map(y => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--border)" strokeWidth=".3" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#sg)" />
        <path d={path} stroke="url(#sgl)" strokeWidth="0.8" fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", left: "calc(85% - 6px)", top: "20%", width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2.5px solid var(--o500)", boxShadow: "0 4px 12px rgba(249,115,22,.45)" }} />
      <div style={{ position: "absolute", left: "calc(85% + 12px)", top: "calc(20% - 12px)", padding: "6px 10px", borderRadius: 8, background: "var(--text)", color: "var(--bg-canvas)", fontSize: 11, fontWeight: 700 }}>
        87% · May 14
      </div>
    </div>
  );
}
function Stat({ n, l, up, down }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{n} {up && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>▲</span>} {down && <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>▼</span>}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</div>
    </div>
  );
}
function SubjBar({ s, a, v, weak, c }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
          <span style={{ fontWeight: 700 }}>{s}</span>
          {weak && <span className="chip chip-red" style={{ fontSize: 9 }}>Below target</span>}
        </div>
        <div style={{ color: "var(--text-muted)" }}>
          <span style={{ fontWeight: 800, color: "var(--text-strong)", fontSize: 13 }}>{a}%</span> · {v.toLocaleString()} MCQs
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
        <div style={{ width: `${a}%`, height: "100%", background: c, borderRadius: 999 }} />
      </div>
    </div>
  );
}
function Weak({ subj, topic, acc, attempts, c }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: c, fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{subj}</span>
        <span className="chip chip-red">{acc}% acc</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.3 }}>{topic}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{attempts} attempts · last 14 days</div>
      <button className="btn btn-ghost btn-xs" style={{ marginTop: 10, width: "100%" }}><Icon name="zap" size={11} /> Drill 10 MCQs</button>
    </div>
  );
}

window.CreateTestPage = CreateTestPage;
window.TestHistoryPage = TestHistoryPage;
window.ReportsPage = ReportsPage;
