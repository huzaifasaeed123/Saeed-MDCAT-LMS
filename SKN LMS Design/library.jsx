/* global React, AppShell, Icon */

/* === Notes (with editor preview) === */
function NotesPage({ theme }) {
  return (
    <AppShell theme={theme} active="Notes" title="Notes" subtitle="142 notes · auto-synced across devices"
      action={<>
        <button className="btn btn-ghost btn-sm"><Icon name="upload" size={13} /> Import PDF</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={13} /> New note</button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 14, height: "100%", overflow: "hidden" }}>
        {/* Folder rail */}
        <div className="card" style={{ padding: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
            background: "var(--bg-muted)", borderRadius: 8, marginBottom: 10,
          }}>
            <Icon name="search" size={13} />
            <input placeholder="Search notes…" style={{ all: "unset", flex: 1, fontSize: 12 }} />
          </div>
          {[
            { l: "All notes",     n: 142, icon: "folder", active: true },
            { l: "🧬 Biology",    n: 48,  icon: "folder" },
            { l: "⚛ Chemistry",  n: 36,  icon: "folder" },
            { l: "🧲 Physics",    n: 32,  icon: "folder" },
            { l: "📖 English",    n: 14,  icon: "folder" },
            { l: "Mock formulas", n: 8,   icon: "star" },
          ].map(f => (
            <div key={f.l} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
              background: f.active ? "var(--sidebar-active-bg)" : "transparent",
              color: f.active ? "var(--sidebar-active-text)" : "var(--text)",
              fontSize: 13, fontWeight: f.active ? 700 : 500, cursor: "pointer",
            }}>
              <span style={{ flex: 1 }}>{f.l}</span>
              <span className="chip chip-muted" style={{ fontSize: 9, padding: "2px 6px" }}>{f.n}</span>
            </div>
          ))}
          <hr className="divider" style={{ margin: "12px 0" }} />
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.16em", textTransform: "uppercase", padding: "0 10px", marginBottom: 6 }}>Tags</div>
          {[
            { l: "high-yield", c: "chip-orange" }, { l: "weak-topic", c: "chip-red" }, { l: "formula", c: "chip-violet" }, { l: "diagram", c: "chip-blue" },
          ].map(t => (
            <div key={t.l} style={{ padding: "5px 10px" }}>
              <span className={`chip ${t.c}`}>{t.l}</span>
            </div>
          ))}
        </div>

        {/* Note list */}
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>All notes <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· 142</span></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-xs">Date</button>
              <button className="btn btn-ghost btn-xs">A–Z</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NoteItem t="Quantum numbers · Cheat sheet" sub="Chemistry · 2 days ago" tags={["high-yield", "formula"]} active />
            <NoteItem t="Reflex Arc diagrams" sub="Biology · 4 days ago" tags={["diagram"]} />
            <NoteItem t="Capacitance — formula recap" sub="Physics · 1 wk ago" tags={["formula", "weak-topic"]} />
            <NoteItem t="Endocrine glands & hormones" sub="Biology · 1 wk ago" tags={["high-yield"]} />
            <NoteItem t="Mock #03 mistakes log" sub="All subjects · 1 wk ago" tags={["weak-topic"]} />
            <NoteItem t="Tenses · Quick recap" sub="English · 2 wks ago" />
            <NoteItem t="Hund's rule edge cases" sub="Chemistry · 2 wks ago" tags={["formula"]} />
            <NoteItem t="MDCAT '24 critical PYQs" sub="All · 3 wks ago" tags={["high-yield"]} />
          </div>
        </div>

        {/* Editor preview */}
        <div className="card" style={{ padding: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="chip chip-violet">Chemistry</span>
            <span className="chip chip-orange">high-yield</span>
            <span className="chip chip-violet">formula</span>
            <div style={{ flex: 1 }} />
            <button style={{ all: "unset", padding: 6, borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}><Icon name="edit" size={14} /></button>
            <button style={{ all: "unset", padding: 6, borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}><Icon name="bookmark" size={14} /></button>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Quantum numbers · Cheat sheet</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Last edited 2 days ago · 4 min read</div>

          {/* Toolbar */}
          <div style={{ display: "flex", gap: 2, marginTop: 14, padding: 4, borderRadius: 8, background: "var(--bg-muted)", flexWrap: "wrap" }}>
            {[{ l: "B", b: true }, { l: "I", i: true }, { l: "U" }, { l: "•" }, { l: "1." }, { l: "‷" }, { l: "</>" }, { l: "f(x)" }].map((b, i) => (
              <button key={i} style={{
                all: "unset", padding: "5px 9px", borderRadius: 5, cursor: "pointer", fontSize: 12,
                fontFamily: "var(--font)", fontWeight: b.b ? 800 : 500, fontStyle: b.i ? "italic" : "normal",
                color: "var(--text)",
              }}>{b.l}</button>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: "var(--text)", lineHeight: 1.7, overflow: "hidden" }}>
            <p style={{ margin: "0 0 10px" }}>For any electron orbital, four quantum numbers describe its state:</p>
            <ul style={{ paddingLeft: 18, margin: "0 0 14px", display: "flex", flexDirection: "column", gap: 4 }}>
              <li><b>n</b> — principal · shell size · <span style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>1, 2, 3 …</span></li>
              <li><b>ℓ</b> — azimuthal · shape · <span style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>0 ≤ ℓ ≤ n−1</span></li>
              <li><b>m</b> — magnetic · orientation · <span style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>−ℓ … +ℓ</span></li>
              <li><b>s</b> — spin · ± ½</li>
            </ul>
            <div style={{ padding: 12, borderRadius: 9, background: "color-mix(in srgb, var(--o500) 8%, transparent)", border: "1px dashed var(--o500)", fontSize: 12, color: "var(--text)" }}>
              <b style={{ color: "var(--o700)" }}>Trap (MDCAT 2023):</b> if n = 2 and ℓ = 2, the set is invalid — examiners love this. Remember <span style={{ fontFamily: "var(--mono)" }}>ℓ &lt; n</span> always.
            </div>
            <p style={{ margin: "14px 0 0", color: "var(--text-muted)", fontSize: 12 }}>📌 Linked from <b>Test #39</b>, <b>Test #41</b> · auto-attached.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function NoteItem({ t, sub, tags, active }) {
  return (
    <div style={{
      padding: "12px 14px", borderBottom: "1px solid var(--border-faint)",
      background: active ? "var(--bg-inset)" : "transparent",
      borderLeft: active ? "3px solid var(--p600)" : "3px solid transparent",
      cursor: "pointer",
    }}>
      <div style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: "var(--text-strong)" }}>{t}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {tags.map((tg, i) => <span key={tg} className={`chip ${["chip-orange", "chip-violet", "chip-red", "chip-blue"][i]}`} style={{ fontSize: 9 }}>{tg}</span>)}
        </div>
      )}
    </div>
  );
}

/* === Videos === */
function VideosPage({ theme }) {
  return (
    <AppShell theme={theme} active="Videos" title="Video Lectures" subtitle="284 lectures · 142 hours · Saeed Sir & SKN Faculty"
      action={<>
        <select className="field btn-sm" style={{ width: 150 }}><option>All subjects</option></select>
        <button className="btn btn-ghost btn-sm"><Icon name="download" size={13} /> Saved</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
        {/* Continue watching hero */}
        <div className="card" style={{
          padding: 20, display: "grid", gridTemplateColumns: "320px 1fr", gap: 22, alignItems: "center",
          background: "var(--bg-inset)", border: "none",
        }}>
          <div style={{
            position: "relative", height: 180, borderRadius: 14,
            background: "linear-gradient(135deg, var(--p700), var(--o500))",
            overflow: "hidden",
          }}>
            <div className="placeholder" style={{ position: "absolute", inset: 0, opacity: .3, borderRadius: 14, border: "none" }}>thumbnail</div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.96)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--p700)",
                boxShadow: "0 12px 24px rgba(0,0,0,.25)",
              }}>
                <Icon name="play" size={22} />
              </div>
            </div>
            <div style={{
              position: "absolute", bottom: 12, left: 12, right: 12, height: 4,
              borderRadius: 999, background: "rgba(255,255,255,.25)", overflow: "hidden",
            }}>
              <div style={{ width: "42%", height: "100%", background: "#fcd34d" }} />
            </div>
            <span className="chip chip-orange" style={{ position: "absolute", top: 12, left: 12 }}>● Resume · 12:14 / 28:40</span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Continue watching</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)", marginTop: 4 }}>Atomic Orbitals · Aufbau Principle Deep Dive</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--grad-brand-vivid)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>SA</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Saeed Sir · Chemistry · Ch. 2</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", marginTop: 10, lineHeight: 1.55, maxWidth: 540 }}>
              Walk-through of s/p/d orbital filling order, Hund's rule edge cases, and 4 MDCAT-style practice questions at the end.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary"><Icon name="play" size={13} /> Resume</button>
              <button className="btn btn-ghost btn-sm"><Icon name="bookmark" size={13} /> Save</button>
              <button className="btn btn-ghost btn-sm"><Icon name="note" size={13} /> Linked notes (3)</button>
            </div>
          </div>
        </div>

        {/* Library grid */}
        <div className="card" style={{ padding: 18, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Recommended for you</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Biology", "Chemistry", "Physics", "English"].map((t, i) => (
                <button key={t} className={i === 0 ? "btn btn-solid btn-xs" : "btn btn-ghost btn-xs"} style={i === 0 ? { background: "var(--text)", color: "var(--bg-canvas)" } : {}}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignContent: "flex-start" }}>
            <VideoCard subj="Biology" t="Reflex Arc · Step by step" dur="22:14" instr="Dr. Asma Q." watched={62} c="#16a34a" />
            <VideoCard subj="Chemistry" t="Periodic Trends Masterclass" dur="34:08" instr="Sir Bilal H." new c="var(--p600)" />
            <VideoCard subj="Physics" t="Capacitance — Fast Track" dur="18:42" instr="Dr. Hamid R." c="var(--o500)" />
            <VideoCard subj="English" t="Past Perfect Continuous" dur="12:50" instr="Ma'am Mariam" c="var(--blue)" />
            <VideoCard subj="Biology" t="Endocrine System Overview" dur="28:14" instr="Dr. Asma Q." watched={100} c="#16a34a" />
            <VideoCard subj="Chemistry" t="Coordination Compounds" dur="40:22" instr="Sir Bilal H." c="var(--p600)" />
            <VideoCard subj="Physics" t="EM Induction Deep Dive" dur="36:00" instr="Saeed Sir" featured c="var(--o500)" />
            <VideoCard subj="Mock" t="How to attempt Mock #04" dur="14:18" instr="Saeed Sir" featured c="#ec4899" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VideoCard({ subj, t, dur, instr, watched, c, featured, new: isNew }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        height: 110, borderRadius: 12, position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${c} 0%, var(--p700) 110%)`,
      }}>
        <div className="placeholder" style={{ position: "absolute", inset: 0, opacity: .25, borderRadius: 12, border: "none" }} />
        <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", padding: "3px 7px", background: "rgba(0,0,0,.4)", borderRadius: 999 }}>{subj}</span>
        {featured && <span className="chip" style={{ position: "absolute", top: 8, right: 8, background: "#fcd34d", color: "#7c2d12" }}>★ Featured</span>}
        {isNew && <span className="chip chip-orange" style={{ position: "absolute", top: 8, right: 8 }}>NEW</span>}
        <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 10, fontFamily: "var(--mono)", color: "#fff", padding: "3px 7px", background: "rgba(0,0,0,.6)", borderRadius: 5, fontWeight: 700 }}>{dur}</span>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: .9 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.85)", color: "var(--p700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="play" size={15} />
          </div>
        </div>
        {watched > 0 && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
            <div style={{ width: `${watched}%`, height: "100%", background: watched === 100 ? "var(--green)" : "var(--o500)" }} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.3, letterSpacing: "-0.005em" }}>{t}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{instr}</div>
    </div>
  );
}

/* === Messages === */
function MessagesPage({ theme }) {
  return (
    <AppShell theme={theme} active="Messages" title="Messages" subtitle="Chat with mentors, tutors, and peers"
      action={<button className="btn btn-primary btn-sm"><Icon name="plus" size={13} /> New message</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, height: "100%", overflow: "hidden" }}>
        {/* Inbox */}
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
              background: "var(--bg-muted)", borderRadius: 8,
            }}>
              <Icon name="search" size={13} />
              <input placeholder="Search conversations…" style={{ all: "unset", flex: 1, fontSize: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
              {[
                { l: "All", n: 12, a: true }, { l: "Mentors", n: 3 }, { l: "Peers", n: 8 }, { l: "Unread", n: 3 },
              ].map(t => (
                <button key={t.l} style={{
                  all: "unset", cursor: "pointer", padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: t.a ? "var(--text)" : "transparent",
                  color: t.a ? "var(--bg-canvas)" : "var(--text-muted)",
                }}>{t.l} {t.n && <span style={{ opacity: .7 }}>· {t.n}</span>}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <Convo name="Saeed Sir" preview="Yes, drop your mock #03 attempt — I'll review it tonight." t="2m" unread={2} mentor active />
            <Convo name="Areeba Rashid" preview="Sharing my notes on quantum numbers!" t="14m" />
            <Convo name="Dr. Asma Q." preview="Watch Lecture 08, then we can discuss." t="1h" unread={1} mentor />
            <Convo name="Mock Help · group" preview="Mahnoor: Can someone send me Q4 explanation?" t="3h" group />
            <Convo name="Zain Faridi" preview="You: Thanks for the cheat sheet 🙏" t="1d" />
            <Convo name="Bio buddies · group" preview="Sara: who's doing the genetics drill tomorrow?" t="2d" group />
            <Convo name="Sir Bilal H." preview="Your last test report looks promising." t="3d" mentor />
          </div>
        </div>

        {/* Active thread */}
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--grad-brand-vivid)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>SA</div>
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "var(--green)", border: "2px solid var(--bg-canvas)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>Saeed Sir <span className="chip chip-violet" style={{ fontSize: 9 }}>★ Mentor</span></div>
              <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>● Online · usually replies in 5 min</div>
            </div>
            <button className="btn btn-ghost btn-sm">View profile</button>
          </div>

          <div style={{ flex: 1, overflow: "hidden", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-subtle)" }}>
            <DateSep d="Today" />
            <Bubble side="them" t="Salam Huzaifa, congrats on hitting rank #1 this week 🎉" time="11:02 AM" />
            <Bubble side="me" t="JazakAllah sir! Felt good — but I missed 4 on periodic trends, can't ignore that." time="11:04 AM" />
            <Bubble side="them" t="Good self-awareness. Drop your mock #03 attempt + the topic breakdown — I'll mark up the slips." time="11:06 AM" />
            <Bubble side="me" attach="Mock-03-Huzaifa.pdf" time="11:08 AM" />
            <Bubble side="them" t="Got it. I'll send detailed notes by tonight. Also — try the new periodic trends drill that just went up." time="11:42 AM" />
            <Bubble side="them" t="Yes, drop your mock #03 attempt — I'll review it tonight." time="11:43 AM" />
          </div>

          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: 8 }}><Icon name="upload" size={14} /></button>
            <input className="field" placeholder="Type a message…" style={{ flex: 1, background: "var(--bg-muted)", border: "none" }} defaultValue="" />
            <button className="btn btn-primary btn-sm">Send <Icon name="arrowR" size={13} /></button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Convo({ name, preview, t, unread, mentor, group, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
      borderBottom: "1px solid var(--border-faint)",
      background: active ? "var(--bg-inset)" : "transparent",
      borderLeft: active ? "3px solid var(--p600)" : "3px solid transparent",
      cursor: "pointer",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: mentor ? "var(--grad-brand-vivid)" : group ? "var(--bg-muted)" : "var(--bg-muted)",
        color: mentor ? "#fff" : "var(--text)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 11, flexShrink: 0,
      }}>{group ? <Icon name="user" size={15} /> : name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: unread ? 800 : 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{t}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ flex: 1, fontSize: 11, color: unread ? "var(--text)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: unread ? 600 : 500 }}>{preview}</div>
          {unread > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "var(--grad-brand-vivid)", color: "#fff" }}>{unread}</span>
          )}
        </div>
      </div>
    </div>
  );
}
function DateSep({ d }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-faint)", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.18em" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} /> {d} <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}
function Bubble({ side, t, attach, time }) {
  const me = side === "me";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: me ? "flex-end" : "flex-start", gap: 4, maxWidth: "75%", marginLeft: me ? "auto" : 0 }}>
      {attach ? (
        <div style={{
          padding: "12px 14px", borderRadius: "16px 16px 4px 16px",
          background: "var(--grad-brand-vivid)", color: "#fff",
          display: "flex", alignItems: "center", gap: 10, minWidth: 220,
        }}>
          <Icon name="doc" size={18} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{attach}</div>
            <div style={{ fontSize: 10, opacity: .85 }}>2.4 MB · PDF</div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: "11px 16px",
          borderRadius: me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: me ? "var(--grad-brand-vivid)" : "var(--bg-surface)",
          color: me ? "#fff" : "var(--text)",
          fontSize: 14, lineHeight: 1.5, fontWeight: 500,
          border: me ? "none" : "1px solid var(--border)",
          boxShadow: me ? "0 4px 12px -4px rgba(124,58,237,.35)" : "none",
        }}>{t}</div>
      )}
      <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--mono)" }}>{time}</div>
    </div>
  );
}

/* === Profile / Settings === */
function SettingsPage({ theme }) {
  return (
    <AppShell theme={theme} active="" title="Profile & Settings" subtitle="Manage your account, preferences, and study plan"
      action={<button className="btn btn-primary btn-sm">Save changes</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, height: "100%", overflow: "hidden" }}>
        {/* Nav */}
        <div className="card" style={{ padding: 12, height: "fit-content" }}>
          {[
            { l: "Profile",       i: "user",     a: true },
            { l: "Study plan",    i: "target" },
            { l: "Subscription",  i: "sparkles" },
            { l: "Notifications", i: "bell" },
            { l: "Appearance",    i: "moon" },
            { l: "Privacy",       i: "lock" },
            { l: "Connected apps",i: "settings" },
          ].map(s => (
            <div key={s.l} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 9, fontSize: 13, fontWeight: s.a ? 700 : 500,
              background: s.a ? "var(--sidebar-active-bg)" : "transparent",
              color: s.a ? "var(--sidebar-active-text)" : "var(--text)",
              cursor: "pointer",
            }}>
              <Icon name={s.i} size={15} />
              <span>{s.l}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          {/* Identity */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: "var(--grad-brand-vivid)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 30,
                  boxShadow: "0 12px 30px -8px rgba(124,58,237,.45)",
                }}>HS</div>
                <button style={{
                  position: "absolute", bottom: 0, right: 0, width: 28, height: 28,
                  borderRadius: "50%", background: "var(--bg-surface)", border: "2px solid var(--bg-canvas)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  color: "var(--text)",
                }}><Icon name="pencilSimple" size={13} /></button>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Huzaifa Saeed</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>huzaifa@saeedmdcat.pk · Pakistan</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <span className="chip chip-violet">★ Premium · MDCAT 2025</span>
                  <span className="chip chip-orange"><Icon name="flame" size={11} /> 12-day streak</span>
                  <span className="chip chip-green">Rank #1 this week</span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm"><Icon name="logout" size={13} /> Sign out</button>
            </div>

            <hr className="divider" style={{ margin: "20px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field2 label="Full name"><input className="field" defaultValue="Huzaifa Saeed" /></Field2>
              <Field2 label="Display name"><input className="field" defaultValue="Huzaifa S." /></Field2>
              <Field2 label="Email"><input className="field" defaultValue="huzaifa@saeedmdcat.pk" /></Field2>
              <Field2 label="Phone"><input className="field" defaultValue="+92 300 1234567" /></Field2>
              <Field2 label="City"><input className="field" defaultValue="Karachi" /></Field2>
              <Field2 label="Institution"><input className="field" defaultValue="KGS — Karachi Grammar School" /></Field2>
            </div>
          </div>

          {/* Preferences */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Study preferences</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>How the platform tunes itself for you</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Pref l="Daily MCQ target" sub="Suggested: 40 per day for May">
                <select className="field" style={{ width: 140 }}><option>40 / day</option></select>
              </Pref>
              <Pref l="Auto-drill weak topics" sub="Auto-build practice tests from weak spots every Sunday">
                <Switch on />
              </Pref>
              <Pref l="Spaced repetition" sub="Re-show questions you missed at intervals">
                <Switch on />
              </Pref>
              <Pref l="Pre-test focus mode" sub="Hide sidebar + dim notifications during a test">
                <Switch on />
              </Pref>
              <Pref l="Leaderboard visibility" sub="Show your name to other students">
                <Switch on />
              </Pref>
              <Pref l="Theme" sub="Use the panel below — light / true-dark">
                <div style={{ display: "flex", gap: 6, padding: 3, borderRadius: 8, background: "var(--bg-muted)" }}>
                  <span className={theme === "light" ? "chip" : ""} style={theme === "light" ? { background: "var(--bg-surface)", boxShadow: "0 1px 3px rgba(0,0,0,.1)", padding: "5px 10px" } : { padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="sun" size={11} /> Light</span>
                  <span className={theme === "dark" ? "chip" : ""} style={theme === "dark" ? { background: "var(--bg-surface)", boxShadow: "0 1px 3px rgba(0,0,0,.1)", padding: "5px 10px" } : { padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="moon" size={11} /> Dark</span>
                </div>
              </Pref>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field2({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function Pref({ l, sub, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 14px", borderRadius: 11,
      background: "var(--bg-subtle)", border: "1px solid var(--border-faint)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{l}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}
function Switch({ on }) {
  return (
    <div style={{
      width: 38, height: 22, borderRadius: 999, position: "relative",
      background: on ? "var(--p600)" : "var(--border-strong)", transition: "background .15s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 19 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
      }} />
    </div>
  );
}

window.NotesPage = NotesPage;
window.VideosPage = VideosPage;
window.MessagesPage = MessagesPage;
window.SettingsPage = SettingsPage;
