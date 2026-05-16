/* global React, Logo, Icon */
// Brand / Color / Typography / Components panel — covers both themes.

function ThemePanel({ theme }) {
  const isDark = theme === "dark";
  return (
    <div className="lms-shell" data-theme={theme} style={{
      width: "100%", height: "100%", background: "var(--bg)",
      padding: "40px 44px", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
            Brand System · {isDark ? "Night" : "Day"} mode
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-strong)" }}>
            Saeed MDCAT Design System
          </div>
          <div style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 4, maxWidth: 640 }}>
            A premium, energetic system anchored on the SKN Academy brand gradient — deep violet through magenta to coral orange — applied with restraint across the LMS.
          </div>
        </div>
        <Logo size="lg" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* === Brand gradient + primary palette === */}
        <section className="card" style={{ padding: 22, gridColumn: "1 / -1" }}>
          <SectionHead eyebrow="01 · Color" title="Brand gradient & palette" />
          <div style={{
            height: 88, borderRadius: 14, background: "var(--grad-brand-vivid)",
            display: "flex", alignItems: "center", padding: "0 24px", color: "#fff",
            boxShadow: "0 12px 30px -10px rgba(124,58,237,.45)",
            marginTop: 10, marginBottom: 18,
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: .8, fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Brand gradient</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Violet → Magenta → Coral</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
              <Stop hex="#6D28D9" label="Violet 700" />
              <Stop hex="#A21CAF" label="Magenta 700" />
              <Stop hex="#EC4899" label="Pink 500" />
              <Stop hex="#F97316" label="Orange 500" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 6 }}>
            {[
              ["50",  "#f5f3ff"], ["100", "#ede9fe"], ["200", "#ddd6fe"],
              ["300", "#c4b5fd"], ["400", "#a78bfa"], ["500", "#8b5cf6"],
              ["600", "#7c3aed"], ["700", "#6d28d9"], ["800", "#5b21b6"],
              ["900", "#4c1d95"], ["950", "#2e1065"],
            ].map(([n, hex]) => <Swatch key={n} step={n} hex={hex} dark={n >= "600"} />)}
          </div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", marginTop: 8 }}>Primary · Violet</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 6, marginTop: 14 }}>
            {[
              ["50",  "#fff7ed"], ["100", "#ffedd5"], ["200", "#fed7aa"],
              ["300", "#fdba74"], ["400", "#fb923c"], ["500", "#f97316"],
              ["600", "#ea580c"], ["700", "#c2410c"], ["800", "#9a3412"],
              ["900", "#7c2d12"], ["950", "#431407"],
            ].map(([n, hex]) => <Swatch key={n} step={n} hex={hex} dark={n >= "500"} />)}
          </div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", marginTop: 8 }}>Accent · Coral / Orange</div>
        </section>

        {/* === Surfaces === */}
        <section className="card" style={{ padding: 22 }}>
          <SectionHead eyebrow="02 · Surfaces" title={isDark ? "True-black hierarchy" : "Soft warm white"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <SurfaceTile name="bg"          val={isDark ? "#0a0a0f" : "#f7f6fb"} role="App background" />
            <SurfaceTile name="surface"     val={isDark ? "#111118" : "#ffffff"} role="Card surface" />
            <SurfaceTile name="elevated"    val={isDark ? "#16151f" : "#ffffff"} role="Modals · menus" />
            <SurfaceTile name="muted"       val={isDark ? "#15141d" : "#f4f3f8"} role="Inputs · chips" />
            <SurfaceTile name="border"      val={isDark ? "#232230" : "#ebe9f1"} role="1px dividers" thin />
            <SurfaceTile name="border-strong" val={isDark ? "#3a3848" : "#d8d5e2"} role="Focused inputs" thin />
          </div>
        </section>

        {/* === Type === */}
        <section className="card" style={{ padding: 22 }}>
          <SectionHead eyebrow="03 · Typography" title="Plus Jakarta Sans" />
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <TypeRow label="Display / 42 · 800" sample="Aa Bb" size={42} weight={800} />
            <TypeRow label="H1 / 28 · 800"      sample="Master the MDCAT" size={28} weight={800} />
            <TypeRow label="H2 / 20 · 700"      sample="Practice Tests" size={20} weight={700} />
            <TypeRow label="Body / 14 · 500"    sample="Anatomy of the heart and circulation." size={14} weight={500} />
            <TypeRow label="Caption / 11 · 600 mono" sample="MDCAT · 2025 Q-BANK" size={11} weight={600} mono />
          </div>
        </section>

        {/* === Components === */}
        <section className="card" style={{ padding: 22, gridColumn: "1 / -1" }}>
          <SectionHead eyebrow="04 · Components" title="Buttons · Chips · Inputs · Cards" />
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 22, marginTop: 16 }}>

            <div>
              <MiniLabel>Buttons</MiniLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary"><Icon name="zap" size={14} /> Start Practice</button>
                <button className="btn btn-orange"><Icon name="plus" size={14} /> New Test</button>
                <button className="btn btn-solid">Solid</button>
                <button className="btn btn-ghost">Ghost</button>
                <button className="btn btn-primary btn-sm">Small</button>
                <button className="btn btn-ghost btn-xs">XS</button>
              </div>

              <MiniLabel style={{ marginTop: 18 }}>Inputs</MiniLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <input className="field" placeholder="Search Question Bank" />
                <select className="field" defaultValue="">
                  <option value="" disabled>All Subjects</option>
                </select>
              </div>
            </div>

            <div>
              <MiniLabel>Status chips</MiniLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <span className="chip chip-violet"><Icon name="cap" size={11} /> Tutor</span>
                <span className="chip chip-orange"><Icon name="flame" size={11} /> Streak · 12</span>
                <span className="chip chip-green"><Icon name="check" size={11} /> Passed</span>
                <span className="chip chip-red"><Icon name="x" size={11} /> Failed</span>
                <span className="chip chip-amber"><Icon name="lock" size={11} /> Locked</span>
                <span className="chip chip-blue"><Icon name="book" size={11} /> Chemistry</span>
                <span className="chip chip-muted">Unused · 91</span>
              </div>

              <MiniLabel style={{ marginTop: 18 }}>Avatars · Badges</MiniLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                {["HS","AR","ZF","MS"].map((i, idx) => (
                  <div key={i} style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: idx === 0 ? "var(--grad-brand-vivid)" : "var(--bg-muted)",
                    color: idx === 0 ? "#fff" : "var(--text)", display: "flex",
                    alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12,
                    border: idx === 0 ? "none" : "1px solid var(--border)",
                    marginLeft: idx === 0 ? 0 : -10,
                  }}>{i}</div>
                ))}
                <span className="chip chip-violet"><Icon name="trophy" size={11} /> Rank #1</span>
              </div>
            </div>

            <div>
              <MiniLabel>Score card</MiniLabel>
              <div className="card" style={{ padding: 14, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Accuracy</span>
                  <span className="chip chip-green">▲ 8%</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4 }}>
                  <span className="txt-grad">87.2%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--bg-muted)", marginTop: 10, overflow: "hidden" }}>
                  <div style={{ width: "72%", height: "100%", background: "var(--grad-brand-vivid)" }} />
                </div>
              </div>

              <MiniLabel style={{ marginTop: 18 }}>Tone</MiniLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                <Tone color="var(--green)" name="Success" hex="#16A34A" />
                <Tone color="var(--red)" name="Danger"  hex="#DC2626" />
                <Tone color="var(--amber)" name="Warn"  hex="#D97706" />
                <Tone color="var(--blue)" name="Info"   hex="#2563EB" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>{eyebrow}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-0.015em", marginTop: 2 }}>{title}</div>
    </div>
  );
}
function MiniLabel({ children, style }) {
  return <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.16em", textTransform: "uppercase", ...style }}>{children}</div>;
}
function Stop({ hex, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--mono)", color: "rgba(255,255,255,.92)" }}>
      <div style={{ width: 18, height: 18, borderRadius: 5, background: hex, border: "1.5px solid rgba(255,255,255,.65)" }} />
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ opacity: .85 }}>{hex}</div>
      </div>
    </div>
  );
}
function Swatch({ step, hex, dark }) {
  return (
    <div style={{
      height: 60, borderRadius: 8, background: hex, padding: "8px 10px",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      color: dark ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.7)",
      fontFamily: "var(--mono)", fontSize: 10, border: "1px solid rgba(0,0,0,.06)",
    }}>
      <div style={{ fontWeight: 700 }}>{step}</div>
      <div style={{ opacity: .8 }}>{hex}</div>
    </div>
  );
}
function SurfaceTile({ name, val, role, thin }) {
  return (
    <div style={{
      borderRadius: 10, padding: "12px 12px",
      background: val, border: `${thin ? "1.5px solid " + val : "1px solid var(--border)"}`,
      minHeight: thin ? 48 : 64,
    }}>
      <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)" }}>{role}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
        <span style={{ fontFamily: "var(--mono)" }}>{name}</span>
        <span style={{ color: "var(--text-faint)", fontWeight: 500, marginLeft: 6 }}>{val}</span>
      </div>
    </div>
  );
}
function TypeRow({ label, sample, size, weight, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 18, borderBottom: "1px dashed var(--border)", paddingBottom: 10 }}>
      <div style={{ fontFamily: mono ? "var(--mono)" : "var(--font)", fontSize: size, fontWeight: weight, lineHeight: 1, color: "var(--text-strong)", letterSpacing: size > 24 ? "-0.025em" : "-0.01em" }}>{sample}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}
function Tone({ color, name, hex }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
      <span style={{ fontWeight: 600 }}>{name}</span>
      <span style={{ fontFamily: "var(--mono)", color: "var(--text-faint)", marginLeft: "auto" }}>{hex}</span>
    </div>
  );
}

window.ThemePanel = ThemePanel;
