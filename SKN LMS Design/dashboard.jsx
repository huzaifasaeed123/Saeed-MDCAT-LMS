/* global React, AppShell, Icon */

function DashboardPage({ theme }) {
  return (
    <AppShell theme={theme} active="Dashboard"
      title="" subtitle=""
      action={
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
          <Icon name="zap" size={14} /> Start daily quiz
        </button>
      }>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22, height: "100%" }}>
        {/* === Left column === */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0, overflow: "hidden" }}>
          {/* Hero greeting */}
          <div style={{
            position: "relative", overflow: "hidden",
            borderRadius: 18, padding: "22px 26px",
            background: "var(--grad-brand-vivid)",
            color: "#fff", display: "flex", alignItems: "center", gap: 22,
            boxShadow: "0 16px 36px -12px rgba(124,58,237,.5)",
          }}>
            <div style={{ position: "absolute", top: -30, right: -10, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,.45), transparent 70%)" }} />
            <div style={{ position: "absolute", bottom: -50, right: 120, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />

            <div style={{ position: "relative", flex: 1, zIndex: 1 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: .85, letterSpacing: "0.18em", textTransform: "uppercase" }}>Friday · May 15, 2026</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", marginTop: 4 }}>
                Salam, Huzaifa 👋 Let's stretch your <span style={{ background: "linear-gradient(180deg, transparent 60%, rgba(252,211,77,.55) 60%)" }}>streak</span>.
              </div>
              <div style={{ fontSize: 13, opacity: .9, marginTop: 6, maxWidth: 540 }}>
                You're <b>12 days</b> deep into Bio · Physiology. Hit 30 MCQs today to climb past <b>Areeba R.</b> on Chemistry.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="btn btn-sm" style={{ background: "#fff", color: "var(--p700)", fontWeight: 700 }}>
                  <Icon name="zap" size={13} /> Resume Test #43
                </button>
                <button className="btn btn-sm btn-ghost" style={{ background: "rgba(255,255,255,.18)", borderColor: "rgba(255,255,255,.35)", color: "#fff" }}>
                  <Icon name="target" size={13} /> See weak chapters
                </button>
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 14 }}>
              <Ring pct={72} label="MDCAT-ready" caption="72%" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Pill icon="flame" k="Streak" v="12 days" />
                <Pill icon="trophy" k="Rank" v="#1 / 2,340" />
                <Pill icon="target" k="Goal" v="200/200" />
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <KPI label="MCQs solved" value="4,221" delta="+182 wk" tone="violet" icon="zap" />
            <KPI label="Avg accuracy" value="74%" delta="▲ 3.2%" tone="green" icon="target" />
            <KPI label="Tests taken" value="43" delta="3 today" tone="orange" icon="doc" />
            <KPI label="Time studied" value="38h 22m" delta="this week" tone="blue" icon="clock" />
          </div>

          {/* Continue learning */}
          <div className="card" style={{ padding: 18, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.015em" }}>Continue your sprint</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Your next 3 chapters · auto-curated from your weak spots</div>
              </div>
              <a style={{ fontSize: 12, fontWeight: 600, color: "var(--p700)", cursor: "pointer" }}>Full plan →</a>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
              <CourseRow subject="Biology" chapter="Coordination & Control" topic="Nervous coordination · Reflex arc" pct={64} mcq="22 / 34 MCQs" weak />
              <CourseRow subject="Chemistry" chapter="Atomic Structure" topic="Quantum numbers · Hund's rule" pct={88} mcq="44 / 50 MCQs" />
              <CourseRow subject="Physics" chapter="Electrostatics" topic="Capacitance · Dielectrics" pct={32} mcq="12 / 38 MCQs" weak />
              <CourseRow subject="English" chapter="Tenses & Voice" topic="Past perfect continuous" pct={92} mcq="46 / 50 MCQs" />
            </div>
          </div>
        </div>

        {/* === Right rail === */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0, overflow: "hidden" }}>
          {/* Today plan */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Today's plan</div>
              <span className="chip chip-violet">3 / 5</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <Task done t="40-MCQ Bio mock — Reflex arc" sub="Tutor mode" />
              <Task done t="Watch · Atomic orbitals (12m)" sub="Saeed Sir" />
              <Task done t="Review yesterday's mistakes (14)" sub="Spaced-repetition" />
              <Task t="Chemistry timed quiz · 20 MCQs" sub="Targets weak topics" active />
              <Task t="Read Notes — Capacitance" sub="Est. 18 min" />
            </div>
          </div>

          {/* Leaderboard mini */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Leaderboard · This week</div>
              <a style={{ fontSize: 12, fontWeight: 600, color: "var(--p700)", cursor: "pointer" }}>Full →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <MiniLbRow rank={1} you name="Huzaifa Saeed" score={2841} acc={87} />
              <MiniLbRow rank={2} name="Areeba Rashid" score={2790} acc={84} />
              <MiniLbRow rank={3} name="Zain Faridi" score={2614} acc={81} />
              <MiniLbRow rank={4} name="Mahnoor S." score={2440} acc={78} />
            </div>
          </div>

          {/* Announcements */}
          <div className="card" style={{ padding: 16, background: "var(--bg-inset)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon name="megaphone" size={14} />
              <div style={{ fontSize: 12, fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Announcement</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>Mock MDCAT 04 goes live this Sunday 7 PM.</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Full-length, timed, full-stack. Top 50 earn a 1-on-1 with Saeed Sir.</div>
            <button className="btn btn-orange btn-xs" style={{ marginTop: 10 }}>Reserve seat</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Ring({ pct, label, caption }) {
  const R = 38, C = 2 * Math.PI * R;
  return (
    <div style={{
      width: 110, height: 110, borderRadius: 18, background: "rgba(255,255,255,.12)",
      border: "1px solid rgba(255,255,255,.25)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 10, backdropFilter: "blur(6px)",
    }}>
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={R} stroke="rgba(255,255,255,.22)" strokeWidth="7" fill="none" />
        <circle cx="50" cy="50" r={R} stroke="#fcd34d" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
        <text x="50" y="55" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans" fontWeight="800" fontSize="22">{pct}%</text>
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, opacity: .9, marginTop: -4 }}>{label}</div>
    </div>
  );
}
function Pill({ icon, k, v }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 10, padding: "7px 11px", minWidth: 138,
    }}>
      <Icon name={icon} size={13} />
      <div style={{ fontSize: 10, opacity: .8, fontWeight: 600 }}>{k}</div>
      <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800 }}>{v}</div>
    </div>
  );
}
function KPI({ label, value, delta, tone, icon }) {
  const map = { violet: "chip-violet", green: "chip-green", orange: "chip-orange", blue: "chip-blue" };
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "var(--bg-muted)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
        }}><Icon name={icon} size={15} /></div>
        <span className={`chip ${map[tone]}`}>{delta}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 12, letterSpacing: "-0.025em", color: "var(--text-strong)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
function CourseRow({ subject, chapter, topic, pct, mcq, weak }) {
  const colors = {
    Biology:   { bg: "color-mix(in srgb, #16a34a 14%, transparent)", fg: "#16a34a" },
    Chemistry: { bg: "color-mix(in srgb, #8b5cf6 14%, transparent)", fg: "var(--p700)" },
    Physics:   { bg: "color-mix(in srgb, #f97316 14%, transparent)", fg: "var(--o700)" },
    English:   { bg: "color-mix(in srgb, #2563eb 14%, transparent)", fg: "#2563eb" },
  };
  const c = colors[subject];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: 12,
      border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-subtle)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: c.bg, color: c.fg,
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14,
        flexShrink: 0,
      }}>{subject[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>{chapter}</div>
          {weak && <span className="chip chip-red" style={{ fontSize: 10 }}>Weak spot</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subject} · {topic}</div>
      </div>
      <div style={{ width: 160 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
          <span>{mcq}</span><span style={{ fontWeight: 700, color: "var(--text)" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--grad-brand-vivid)" }} />
        </div>
      </div>
      <button className="btn btn-ghost btn-xs"><Icon name="play" size={11} /> Resume</button>
    </div>
  );
}
function Task({ t, sub, done, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11,
      padding: "9px 10px", borderRadius: 9,
      background: active ? "color-mix(in srgb, var(--o500) 8%, transparent)" : "transparent",
      border: active ? "1px dashed var(--o500)" : "1px solid transparent",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: done ? "var(--green)" : "transparent",
        border: done ? "none" : "1.6px solid var(--border-strong)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {done && <Icon name="check" size={11} stroke={3} style={{ color: "#fff" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: done ? "var(--text-muted)" : "var(--text)",
          textDecoration: done ? "line-through" : "none",
        }}>{t}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{sub}</div>
      </div>
    </div>
  );
}
function MiniLbRow({ rank, name, score, acc, you }) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "7px 8px",
      borderRadius: 9, background: you ? "var(--bg-inset)" : "transparent",
      border: you ? "1px dashed var(--p400)" : "1px solid transparent",
    }}>
      <div style={{ width: 24, fontWeight: 800, fontSize: 13, textAlign: "center" }}>{medals[rank] || rank}</div>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: you ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
        color: you ? "#fff" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 10,
      }}>{name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{name} {you && <span className="chip chip-violet" style={{ fontSize: 9, padding: "2px 6px", marginLeft: 4 }}>You</span>}</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{acc}% acc</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em" }}>{score}</div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
