/* global React, Icon, AppShell */

/* === Test Player — distraction-free focus mode ===
   No global sidebar. Custom slim top bar with progress + timer.
   Centered question canvas. Right rail = question palette.
=================================================== */
function TestPlayerPage({ theme }) {
  return (
    <div className="lms-shell" data-theme={theme} style={{ width: "100%", height: "100%", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Slim top bar */}
      <header style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 26px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-canvas)",
      }}>
        <button style={{ all: "unset", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>
          <Icon name="chevronL" size={14} /> Exit
        </button>
        <div style={{ width: 1, height: 22, background: "var(--border)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="chip chip-violet"><Icon name="zap" size={11} /> Tutor</span>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Atomic Structure · Drill</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>MDCAT 2025 · 40 MCQs</span>
        </div>

        <div style={{ flex: 1, maxWidth: 360, margin: "0 auto", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
            <span>QUESTION 14 / 40</span><span>35% COMPLETE</span>
          </div>
          <div style={{ height: 5, background: "var(--bg-muted)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: "35%", height: "100%", background: "var(--grad-brand-vivid)" }} />
          </div>
        </div>

        <Timer />
        <button className="btn btn-ghost btn-sm"><Icon name="pause" size={13} /> Pause</button>
        <button className="btn btn-orange btn-sm">Submit test</button>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 0 }}>
        {/* Question canvas */}
        <div style={{ overflow: "hidden", display: "flex", justifyContent: "center", padding: "30px 40px" }}>
          <div style={{ maxWidth: 760, width: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="chip chip-blue"><Icon name="book" size={11} /> Chemistry</span>
              <span className="chip chip-muted">Ch. 2 · Atomic Structure</span>
              <span className="chip chip-muted">Quantum numbers</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-xs"><Icon name="bookmark" size={11} /> Mark for review</button>
              <button className="btn btn-ghost btn-xs"><Icon name="flag" size={11} /> Report issue</button>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--mono)", letterSpacing: "0.05em" }}>Question 14</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.45, letterSpacing: "-0.015em", marginTop: 6 }}>
              Which set of quantum numbers is <span style={{ background: "linear-gradient(180deg, transparent 60%, color-mix(in srgb, var(--o500) 28%, transparent) 60%)" }}>not permitted</span> for an electron in a multi-electron atom?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
              <Opt letter="A" text="n = 3, ℓ = 2, m = −1, s = +½" />
              <Opt letter="B" text="n = 4, ℓ = 0, m = 0, s = −½" />
              <Opt letter="C" text="n = 2, ℓ = 2, m = 0, s = +½" selected wrong />
              <Opt letter="D" text="n = 3, ℓ = 1, m = +1, s = +½" correct />
            </div>

            {/* Explanation card (tutor mode) */}
            <div style={{
              marginTop: 22, padding: 18, borderRadius: 14,
              border: "1px solid var(--green)", background: "color-mix(in srgb, var(--green) 6%, transparent)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon name="check" size={14} stroke={2.5} style={{ color: "var(--green)" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--green)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Correct answer · D</span>
                <span className="chip chip-muted" style={{ marginLeft: "auto" }}>62% got this right</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>
                For any allowed orbital, the azimuthal quantum number must satisfy <code style={{ background: "var(--code-bg)", padding: "2px 6px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 12 }}>0 ≤ ℓ ≤ n − 1</code>. Option C violates this with n = 2 and ℓ = 2, which would require ℓ ≤ 1.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost btn-xs"><Icon name="video" size={11} /> Watch 4-min concept</button>
                <button className="btn btn-ghost btn-xs"><Icon name="note" size={11} /> Add to notes</button>
                <button className="btn btn-ghost btn-xs"><Icon name="chat" size={11} /> Ask in community</button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 22 }}>
              <button className="btn btn-ghost"><Icon name="arrowL" size={14} /> Previous</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Tip · use ⌨ A · B · C · D</span>
              <button className="btn btn-primary">Next question <Icon name="arrowR" size={14} /></button>
            </div>
          </div>
        </div>

        {/* Question palette */}
        <aside style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-canvas)", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Question palette</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <span>40 questions</span><span><b style={{ color: "var(--text)" }}>14</b> answered</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {Array.from({ length: 40 }, (_, i) => {
              const idx = i + 1;
              let state = "todo";
              if ([1, 2, 4, 5, 7, 8, 11, 12, 13].includes(idx)) state = "correct";
              else if ([3, 9].includes(idx)) state = "wrong";
              else if ([6, 10].includes(idx)) state = "marked";
              else if (idx === 14) state = "current";
              const map = {
                todo:    { bg: "var(--bg-muted)", color: "var(--text-muted)", border: "none" },
                correct: { bg: "color-mix(in srgb, var(--green) 18%, transparent)", color: "var(--green)", border: "none" },
                wrong:   { bg: "color-mix(in srgb, var(--red) 18%, transparent)", color: "var(--red)", border: "none" },
                marked:  { bg: "color-mix(in srgb, var(--o500) 18%, transparent)", color: "var(--o600)", border: "none" },
                current: { bg: "var(--grad-brand-vivid)", color: "#fff", border: "none" },
              };
              const s = map[state];
              return (
                <div key={idx} style={{
                  height: 30, borderRadius: 7, ...s,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: state === "current" ? "0 4px 12px -2px rgba(124,58,237,.5)" : "none",
                }}>{idx}</div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
            <Legend c="var(--grad-brand-vivid)" l="Current" />
            <Legend c="color-mix(in srgb, var(--green) 18%, transparent)" l="Correct (9)" />
            <Legend c="color-mix(in srgb, var(--red) 18%, transparent)" l="Incorrect (2)" />
            <Legend c="color-mix(in srgb, var(--o500) 18%, transparent)" l="Marked for review (2)" />
            <Legend c="var(--bg-muted)" l="Unanswered (26)" border />
          </div>

          <hr className="divider" />

          <div className="card" style={{ padding: 14, background: "var(--bg-inset)", border: "none" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Section summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8, fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Accuracy so far</span><b>82%</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Avg time / Q</span><b>54s</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Confidence</span><b style={{ color: "var(--green)" }}>High</b></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Timer() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
      borderRadius: 10, background: "color-mix(in srgb, var(--o500) 10%, transparent)",
      border: "1px solid color-mix(in srgb, var(--o500) 30%, transparent)",
      color: "var(--o700)", fontFamily: "var(--mono)", fontWeight: 700,
    }}>
      <Icon name="clock" size={14} />
      <span style={{ fontSize: 16, letterSpacing: ".02em" }}>26:42</span>
      <span style={{ fontSize: 10, opacity: .8 }}>/ 48:00</span>
    </div>
  );
}
function Opt({ letter, text, selected, correct, wrong }) {
  let style = { border: "1.5px solid var(--border)", background: "var(--bg-surface)" };
  let badge = { bg: "var(--bg-muted)", fg: "var(--text-muted)" };
  if (selected && wrong) {
    style = { border: "1.5px solid var(--red)", background: "color-mix(in srgb, var(--red) 8%, transparent)" };
    badge = { bg: "var(--red)", fg: "#fff" };
  }
  if (correct) {
    style = { border: "1.5px solid var(--green)", background: "color-mix(in srgb, var(--green) 8%, transparent)" };
    badge = { bg: "var(--green)", fg: "#fff" };
  }
  return (
    <button style={{
      all: "unset", cursor: "pointer",
      padding: "14px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14,
      ...style,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: badge.bg, color: badge.fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 13,
      }}>{letter}</div>
      <div style={{ flex: 1, fontSize: 14, fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 500 }}>{text}</div>
      {selected && wrong && <Icon name="x" size={16} stroke={2.5} style={{ color: "var(--red)" }} />}
      {correct && <Icon name="check" size={16} stroke={2.5} style={{ color: "var(--green)" }} />}
    </button>
  );
}
function Legend({ c, l, border }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
      <div style={{ width: 14, height: 14, borderRadius: 4, background: c, border: border ? "1px solid var(--border)" : "none" }} />
      {l}
    </div>
  );
}

/* === Result page === */
function TestResultPage({ theme }) {
  return (
    <AppShell theme={theme} active="Test History">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
        {/* Hero */}
        <div className="card" style={{
          position: "relative", overflow: "hidden",
          padding: 26, background: "var(--grad-brand-vivid)",
          color: "#fff", border: "none",
        }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,.5), transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: -80, right: 200, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: .85, letterSpacing: "0.18em", textTransform: "uppercase" }}>Test #43 · Submitted 11:42 AM</div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.025em", marginTop: 6 }}>Atomic Structure · Drill</div>
              <div style={{ fontSize: 14, opacity: .9, marginTop: 4 }}>40 MCQs · Tutor mode · MDCAT 2025 Question Bank</div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button className="btn btn-sm" style={{ background: "#fff", color: "var(--p700)" }}><Icon name="eye" size={13} /> Review answers</button>
                <button className="btn btn-sm btn-ghost" style={{ background: "rgba(255,255,255,.15)", borderColor: "rgba(255,255,255,.3)", color: "#fff" }}><Icon name="zap" size={13} /> Retake</button>
                <button className="btn btn-sm btn-ghost" style={{ background: "rgba(255,255,255,.15)", borderColor: "rgba(255,255,255,.3)", color: "#fff" }}><Icon name="download" size={13} /> Export</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg width="160" height="160" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,.18)" strokeWidth="9" fill="none" />
                <circle cx="50" cy="50" r="42" stroke="#fcd34d" strokeWidth="9" fill="none" strokeLinecap="round"
                  strokeDasharray={`${(80 / 100) * 264} 264`} transform="rotate(-90 50 50)" />
                <text x="50" y="48" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans" fontWeight="800" fontSize="22">80%</text>
                <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,.85)" fontFamily="Plus Jakarta Sans" fontWeight="600" fontSize="7">32 / 40 correct</text>
              </svg>
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,.18)" }}>
                +148 pts · top 8%
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          <StatTile k="Correct" v="32" tone="green" icon="check" />
          <StatTile k="Incorrect" v="6" tone="red" icon="x" />
          <StatTile k="Omitted" v="2" tone="amber" icon="minus" />
          <StatTile k="Avg time / Q" v="63s" tone="violet" icon="clock" />
          <StatTile k="Time used" v="42m / 48m" tone="blue" icon="target" />
        </div>

        {/* Two-col body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Performance by topic</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
              <Topic n="Quantum numbers" a={5} t={6} pct={83} />
              <Topic n="Aufbau & Hund's rule" a={4} t={5} pct={80} />
              <Topic n="Electronic configuration" a={6} t={7} pct={86} />
              <Topic n="Periodic trends" a={4} t={7} pct={57} weak />
              <Topic n="Isotopes & isobars" a={3} t={5} pct={60} weak />
              <Topic n="History of atomic models" a={10} t={10} pct={100} top />
            </div>
          </div>
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Compare with class</div>
              <span className="chip chip-violet">Top 8% · 2,340 students</span>
            </div>
            <div style={{ flex: 1, marginTop: 18, position: "relative" }}>
              <ClassDistribution />
            </div>
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--bg-inset)", display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="sparkles" size={16} />
              <div style={{ fontSize: 12, color: "var(--text)" }}>
                <b>Insight ·</b> Periodic trends dragged your score down 8 pts. Run a focused drill before mock #04.
              </div>
              <button className="btn btn-primary btn-xs" style={{ marginLeft: "auto" }}>Drill now</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({ k, v, tone, icon }) {
  const map = { violet: "var(--p700)", green: "var(--green)", orange: "var(--o600)", blue: "var(--blue)", red: "var(--red)", amber: "var(--amber)" };
  return (
    <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `color-mix(in srgb, ${map[tone]} 14%, transparent)`,
        color: map[tone], display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name={icon} size={16} stroke={2.4} /></div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{v}</div>
      </div>
    </div>
  );
}
function Topic({ n, a, t, pct, weak, top }) {
  const color = pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--amber)" : "var(--red)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{n}</span>
          {weak && <span className="chip chip-red" style={{ fontSize: 9 }}>Weak</span>}
          {top && <span className="chip chip-green" style={{ fontSize: 9 }}>Perfect</span>}
        </div>
        <div style={{ color: "var(--text-muted)" }}>{a}/{t} · <b style={{ color }}>{pct}%</b></div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}
function ClassDistribution() {
  // bell-ish bars
  const data = [3, 8, 16, 28, 44, 60, 72, 68, 52, 32, 14, 6];
  const max = Math.max(...data);
  const yourBin = 9; // index where your score lands
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, position: "relative" }}>
            <div style={{
              height: `${(v / max) * 100}%`,
              background: i === yourBin ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
              borderRadius: "4px 4px 0 0",
              border: i === yourBin ? "none" : "1px solid var(--border)",
            }} />
            {i === yourBin && (
              <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", padding: "4px 8px", borderRadius: 6, background: "var(--text)", color: "var(--bg-canvas)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                You · 80%
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
        <span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span>
      </div>
    </div>
  );
}

window.TestPlayerPage = TestPlayerPage;
window.TestResultPage = TestResultPage;
