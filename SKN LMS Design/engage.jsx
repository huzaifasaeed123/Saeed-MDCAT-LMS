/* global React, AppShell, Icon */

/* === Leaderboard === */
function LeaderboardPage({ theme }) {
  return (
    <AppShell theme={theme} active="Leaderboard" title="Leaderboard" subtitle="MDCAT 2025 cohort · 2,340 active students"
      action={<>
        <select className="field btn-sm" style={{ width: 150 }}><option>This week</option></select>
        <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13} /> Filters</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
        {/* Podium */}
        <div className="card" style={{ padding: 22, background: "var(--bg-inset)", border: "none" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28 }}>
            <PodiumCard rank={2} name="Areeba Rashid" score={2790} acc={84} subj="Bio + Chem" h={130} />
            <PodiumCard rank={1} name="Huzaifa Saeed" score={2841} acc={87} subj="All-rounder" you h={170} />
            <PodiumCard rank={3} name="Zain Faridi" score={2614} acc={81} subj="Physics ace" h={110} />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { l: "All subjects", a: true }, { l: "Biology" }, { l: "Chemistry" }, { l: "Physics" }, { l: "English" }, { l: "Mocks only" },
          ].map((t) => (
            <button key={t.l} className={t.a ? "btn btn-solid btn-sm" : "btn btn-ghost btn-sm"} style={t.a ? { background: "var(--text)", color: "var(--bg-canvas)" } : {}}>{t.l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
            background: "var(--bg-muted)", borderRadius: 9, width: 220,
          }}>
            <Icon name="search" size={14} />
            <input placeholder="Find a student…" style={{ all: "unset", flex: 1, fontSize: 13, color: "var(--text)" }} />
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "60px 1fr 130px 110px 130px 110px 110px",
            gap: 14, padding: "12px 22px", fontSize: 10, fontFamily: "var(--mono)",
            color: "var(--text-faint)", letterSpacing: "0.14em", textTransform: "uppercase",
            borderBottom: "1px solid var(--border)",
          }}>
            <div>Rank</div><div>Student</div><div>Score</div><div>Accuracy</div><div>MCQs solved</div><div>Streak</div><div>Δ Rank</div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LbRow rank={1} name="Huzaifa Saeed" inst="KGS Karachi" score={2841} acc={87} mcqs={4221} streak={12} d={2} you />
            <LbRow rank={2} name="Areeba Rashid" inst="Beaconhouse LHR" score={2790} acc={84} mcqs={3980} streak={9} d={-1} />
            <LbRow rank={3} name="Zain Faridi" inst="Cadet College" score={2614} acc={81} mcqs={3210} streak={7} d={1} />
            <LbRow rank={4} name="Mahnoor Siddiqui" inst="St. Patrick's" score={2440} acc={78} mcqs={2940} streak={4} d={-2} />
            <LbRow rank={5} name="Abdullah Khan" inst="LGS PECHS" score={2380} acc={76} mcqs={2860} streak={6} d={0} />
            <LbRow rank={6} name="Sara Iqbal" inst="Aitchison" score={2210} acc={74} mcqs={2540} streak={3} d={1} />
            <LbRow rank={7} name="Ibrahim Ali" inst="Bahria College" score={2150} acc={71} mcqs={2380} streak={5} d={-1} />
          </div>
          <div style={{ padding: "10px 22px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-faint)", display: "flex", justifyContent: "space-between" }}>
            <span>Showing 1–7 of 2,340</span>
            <span>Boards refresh every 10 min · scoring = Accuracy 70% + Volume 30%</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PodiumCard({ rank, name, score, acc, subj, h, you }) {
  const medals = { 1: { e: "🥇", bg: "linear-gradient(180deg, #fde68a, #fbbf24)", text: "#7c2d12" }, 2: { e: "🥈", bg: "linear-gradient(180deg, #e5e7eb, #9ca3af)", text: "#1f2937" }, 3: { e: "🥉", bg: "linear-gradient(180deg, #fed7aa, #fb923c)", text: "#7c2d12" } };
  const m = medals[rank];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 200 }}>
      <div style={{ fontSize: 36 }}>{m.e}</div>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: you ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
        color: you ? "#fff" : "var(--text)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 22, border: rank === 1 ? "3px solid #fbbf24" : "2px solid var(--border)",
        boxShadow: rank === 1 ? "0 8px 24px -8px rgba(251,191,36,.6)" : "none",
      }}>{name.split(" ").map(n => n[0]).join("")}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{name} {you && <span className="chip chip-violet" style={{ fontSize: 9 }}>You</span>}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{subj} · {acc}% acc</div>
      <div style={{
        width: "100%", height: h, marginTop: 4,
        borderRadius: "12px 12px 0 0",
        background: rank === 1 ? "var(--grad-brand-vivid)" : m.bg,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: rank === 1 ? "#fff" : m.text, padding: "12px 8px",
        boxShadow: rank === 1 ? "0 12px 24px -8px rgba(124,58,237,.4)" : "none",
      }}>
        <div style={{ fontSize: 11, opacity: .85, fontWeight: 700, letterSpacing: ".08em" }}>RANK {rank}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{score}</div>
        <div style={{ fontSize: 10, opacity: .8 }}>pts</div>
      </div>
    </div>
  );
}
function LbRow({ rank, name, inst, score, acc, mcqs, streak, d, you }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 130px 110px 130px 110px 110px",
      gap: 14, padding: "14px 22px", alignItems: "center",
      background: you ? "color-mix(in srgb, var(--p500) 6%, transparent)" : "transparent",
      borderBottom: "1px solid var(--border-faint)",
      borderLeft: you ? "3px solid var(--p600)" : "3px solid transparent",
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: you ? "var(--p700)" : "var(--text)" }}>#{rank}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: you ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
          color: you ? "#fff" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 12,
        }}>{name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{name} {you && <span className="chip chip-violet" style={{ fontSize: 9 }}>You</span>}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inst}</div>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>{score} <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>pts</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: acc >= 80 ? "var(--green)" : "var(--amber)" }}>
        {acc}%
        <div style={{ width: 60, height: 4, borderRadius: 999, background: "var(--bg-muted)", overflow: "hidden" }}>
          <div style={{ width: `${acc}%`, height: "100%", background: "currentColor" }} />
        </div>
      </div>
      <div style={{ fontSize: 13 }}>{mcqs.toLocaleString()}</div>
      <span className="chip chip-orange" style={{ width: "fit-content" }}><Icon name="flame" size={11} /> {streak}d</span>
      <div style={{ fontSize: 13, fontWeight: 700, color: d > 0 ? "var(--green)" : d < 0 ? "var(--red)" : "var(--text-muted)" }}>
        {d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : "—"}
      </div>
    </div>
  );
}

/* === Community === */
function CommunityPage({ theme }) {
  return (
    <AppShell theme={theme} active="Community" title="Community" subtitle="Ask, answer, and learn together"
      action={<button className="btn btn-primary btn-sm"><Icon name="plus" size={13} /> New post</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 16, height: "100%", overflow: "hidden" }}>
        {/* Channels */}
        <div className="card" style={{ padding: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase", margin: "4px 0 12px" }}>Channels</div>
          <Channel l="# general"        n={184} active />
          <Channel l="# biology"        n={62}  />
          <Channel l="# chemistry"      n={48}  />
          <Channel l="# physics"        n={31}  />
          <Channel l="# english"        n={14}  />
          <Channel l="# mock-help"      n={22}  hot />
          <Channel l="# admissions"     n={9}   />
          <Channel l="# off-topic"      n={102} />
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase", margin: "20px 0 10px" }}>Mentors</div>
          <Mentor name="Saeed Sir" online />
          <Mentor name="Dr. Asma Q." online />
          <Mentor name="Sir Bilal H." />
        </div>

        {/* Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <div className="card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--grad-brand-vivid)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>HS</div>
            <input className="field" placeholder="Ask a doubt, share a tip, or post a question…" style={{ flex: 1, background: "var(--bg-muted)", border: "none" }} />
            <button className="btn btn-ghost btn-sm"><Icon name="upload" size={13} /></button>
            <button className="btn btn-primary btn-sm">Post</button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {["Hot", "Recent", "Top this week", "My posts"].map((t, i) => (
              <button key={t} className={i === 0 ? "btn btn-solid btn-xs" : "btn btn-ghost btn-xs"} style={i === 0 ? { background: "var(--text)", color: "var(--bg-canvas)" } : {}}>{t}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            <Post
              who="Areeba Rashid" inst="Beaconhouse · LHR" t="2h"
              title="Stuck on Q14: Why is n=2, ℓ=2 not allowed?"
              chip={["chip-blue", "Chemistry"]} body="I keep getting confused between azimuthal and principal quantum numbers. Saeed Sir's video at 4:23 helped but the exception in this one stumps me…"
              up={42} rep={12} pin
            />
            <Post
              who="Saeed Sir" inst="Faculty · SKN Academy" t="4h" mentor
              title="🔥 Tomorrow 7pm: Full mock #04 will go LIVE"
              chip={["chip-orange", "Announcement"]}
              body="200 MCQs · timed · top 50 unlock a 1:1 session with me. Reserve your seat from the dashboard banner. Bring your A-game ✊"
              up={284} rep={38}
            />
            <Post
              who="Zain Faridi" inst="Cadet College" t="7h"
              title="EM induction · 3-page cheat sheet I made for myself"
              chip={["chip-violet", "Physics"]} body="Took notes from Chapter 8 lectures + condensed common MDCAT tricks. Sharing the PDF — hope it helps."
              up={156} rep={24} attach
            />
            <Post
              who="Mahnoor S." inst="St. Patrick's"  t="1d"
              title="My 90-day MDCAT plan that took me from 720 → 192"
              chip={["chip-green", "Strategy"]}
              body="Sharing my exact weekly schedule, leaderboard strategy, and how I used spaced repetition. AMA in comments 👇"
              up={418} rep={92}
            />
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Top contributors</div>
            {["Saeed Sir", "Mahnoor S.", "Zain F.", "Areeba R."].map((n, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "var(--grad-brand-vivid)" : "var(--bg-muted)", color: i === 0 ? "#fff" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{n.split(" ").map(p => p[0]).join("").slice(0, 2)}</div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{n}</div>
                <span className="chip chip-orange" style={{ fontSize: 9 }}>{[420, 380, 240, 198][i]} rep</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16, background: "var(--bg-inset)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📚 Trending tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["#mock4", "#periodic-trends", "#reflex-arc", "#capacitance", "#aku", "#admissions25", "#stress"].map((t, i) => (
                <span key={t} className={`chip ${["chip-violet", "chip-orange", "chip-blue", "chip-green", "chip-amber", "chip-muted", "chip-red"][i]}`}>{t}</span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Community guidelines</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55 }}>
              Be kind. Cite sources. Don't post leaked test content. Spam = mute. Saeed Sir reads every <i>#mock-help</i> thread.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Channel({ l, n, active, hot }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
      borderRadius: 8, fontSize: 13, fontWeight: 600,
      background: active ? "var(--sidebar-active-bg)" : "transparent",
      color: active ? "var(--sidebar-active-text)" : "var(--text)",
      cursor: "pointer",
    }}>
      <span style={{ flex: 1 }}>{l}</span>
      {hot && <Icon name="flame" size={11} stroke={2} style={{ color: "var(--o500)" }} />}
      <span className="chip chip-muted" style={{ fontSize: 9, padding: "2px 6px" }}>{n}</span>
    </div>
  );
}
function Mentor({ name, online }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--grad-brand-vivid)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 9 }}>{name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
        {online && <div style={{ position: "absolute", bottom: 0, right: -1, width: 7, height: 7, borderRadius: "50%", background: "var(--green)", border: "1.5px solid var(--bg-surface)" }} />}
      </div>
      <span style={{ fontWeight: 600 }}>{name}</span>
    </div>
  );
}
function Post({ who, inst, t, title, body, chip, up, rep, pin, mentor, attach }) {
  return (
    <div className="card" style={{ padding: 16, borderLeft: pin ? "3px solid var(--o500)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: mentor ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
          color: mentor ? "#fff" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 12,
        }}>{who.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            {who}
            {mentor && <span className="chip chip-violet" style={{ fontSize: 9 }}>★ Mentor</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inst} · {t}</div>
        </div>
        <span className={`chip ${chip[0]}`}>{chip[1]}</span>
        {pin && <Icon name="pin" size={14} stroke={2.4} style={{ color: "var(--o500)" }} />}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-0.015em" }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, marginTop: 4 }}>{body}</div>
      {attach && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--bg-inset)", border: "1px dashed var(--border-strong)" }}>
          <Icon name="doc" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>EM-induction-cheatsheet.pdf</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>3 pages · 412 KB</div>
          </div>
          <button className="btn btn-ghost btn-xs"><Icon name="download" size={12} /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-faint)", fontSize: 12, color: "var(--text-muted)" }}>
        <button style={{ all: "unset", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600 }}><Icon name="chevronU" size={13} stroke={2.5} /> {up}</button>
        <button style={{ all: "unset", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Icon name="chat" size={13} /> {rep} replies</button>
        <button style={{ all: "unset", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Icon name="bookmark" size={13} /> Save</button>
      </div>
    </div>
  );
}

window.LeaderboardPage = LeaderboardPage;
window.CommunityPage = CommunityPage;
