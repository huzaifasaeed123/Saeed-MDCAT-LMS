/* global React, Logo, Icon */
// Auth: Login & Signup — full-bleed two-pane with brand stage.

function AuthShell({ theme, mode = "login" }) {
  return (
    <div className="lms-shell" data-theme={theme} style={{ width: "100%", height: "100%", display: "flex", background: "var(--bg)" }}>
      {/* === Brand stage (left) === */}
      <div style={{
        width: "44%", position: "relative", overflow: "hidden",
        background: "var(--grad-brand-vivid)", color: "#fff",
        padding: "40px 44px", display: "flex", flexDirection: "column",
      }}>
        {/* decorative orbs */}
        <div style={{ position: "absolute", top: -80, left: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)" }} />
        <div style={{ position: "absolute", top: 200, right: 80, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.08)", filter: "blur(2px)" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, color: "#fff" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="cap" size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Saeed MDCAT</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", opacity: .85 }}>SKN ACADEMY</div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, marginTop: "auto" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: .85, letterSpacing: "0.18em", textTransform: "uppercase" }}>MDCAT · 2025 Cycle</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, margin: "10px 0 14px" }}>
            Crack MDCAT with<br />the<i style={{ fontWeight: 700, fontStyle: "italic" }}> sharpest </i>practice in PK.
          </h1>
          <p style={{ fontSize: 15, opacity: .9, maxWidth: 420, lineHeight: 1.55 }}>
            18,000+ vetted MCQs · Chapter-wise mocks · Live leaderboards · Doctor-mentor community. Built by Saeed Sir & a panel of MBBS toppers.
          </p>

          <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
            <AuthStat n="18.2k" l="MCQs" />
            <AuthStat n="2,300+" l="Students" />
            <AuthStat n="92%" l="Top-10 hit rate" />
          </div>

          {/* Testimonial */}
          <div style={{
            marginTop: 36, padding: 18, borderRadius: 14,
            background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.22)",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, fontStyle: "italic" }}>
              “Three months on this platform took me from 720 to 192/200. The leaderboard is the only thing that kept me going at 2am.”
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.85)", color: "var(--p700)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>AR</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Areeba R. <span style={{ opacity: .75, fontWeight: 500 }}>· KEMU '28, Lahore</span></div>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, marginTop: 28, fontSize: 11, opacity: .75 }}>
          © 2026 SKN Academy · Saeed MDCAT LMS
        </div>
      </div>

      {/* === Form pane (right) === */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "30px 40px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <>New here? <a style={{ color: "var(--p700)", fontWeight: 700, textDecoration: "none" }}>Create an account →</a></>
          ) : (
            <>Already enrolled? <a style={{ color: "var(--p700)", fontWeight: 700, textDecoration: "none" }}>Sign in →</a></>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {mode === "login" ? "Welcome back" : "Get started"}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.025em", margin: "6px 0 4px", color: "var(--text-strong)" }}>
              {mode === "login" ? "Sign in to your" : "Create your"} <span className="txt-grad">study HQ</span>
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
              {mode === "login" ? "Pick up exactly where you left off." : "Free 7-day trial. No card needed."}
            </p>

            {mode === "signup" && (
              <FormGroup label="Full name">
                <input className="field" placeholder="Huzaifa Saeed" defaultValue="Huzaifa Saeed" />
              </FormGroup>
            )}
            <FormGroup label="Email">
              <input className="field" placeholder="you@example.com" defaultValue="huzaifa@saeedmdcat.pk" />
            </FormGroup>
            <FormGroup label="Password" trailing={mode === "login" ? <a style={{ fontSize: 12, fontWeight: 600, color: "var(--p700)", textDecoration: "none" }}>Forgot?</a> : null}>
              <div style={{ position: "relative" }}>
                <input className="field" type="password" placeholder="••••••••" defaultValue="************" style={{ paddingRight: 40 }} />
                <button style={{ all: "unset", position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", cursor: "pointer" }}>
                  <Icon name="eye" size={16} />
                </button>
              </div>
            </FormGroup>
            {mode === "signup" && (
              <FormGroup label="Target year">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {["MDCAT 2025", "MDCAT 2026", "MDCAT 2027"].map((y, i) => (
                    <label key={y} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 8px",
                      borderRadius: 10, border: i === 1 ? "1.5px solid var(--p600)" : "1px solid var(--border)",
                      background: i === 1 ? "color-mix(in srgb, var(--p500) 8%, transparent)" : "var(--bg-surface)",
                      cursor: "pointer", fontSize: 13, fontWeight: 600,
                      color: i === 1 ? "var(--p700)" : "var(--text)",
                    }}>{y}</label>
                  ))}
                </div>
              </FormGroup>
            )}

            <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 10 }}>
              {mode === "login" ? "Sign in" : "Create my account"}
              <Icon name="arrowR" size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: "var(--text-faint)", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.18em" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} /> OR CONTINUE WITH <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button className="btn btn-ghost" style={{ padding: "12px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v3.5h5a5 5 0 0 1-5 3.5 5.5 5.5 0 1 1 0-11 5 5 0 0 1 3.5 1.5l2.5-2.5A8.5 8.5 0 0 0 12 3.5a8.5 8.5 0 1 0 8.5 8.5c0-.5 0-1-.2-1.5H12z" /></svg>
                Google
              </button>
              <button className="btn btn-ghost" style={{ padding: "12px" }}>
                <Icon name="user" size={14} /> SSO / School ID
              </button>
            </div>

            <div style={{ marginTop: 28, fontSize: 11, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.55 }}>
              By {mode === "login" ? "signing in" : "creating an account"} you agree to our <a style={{ color: "var(--text-muted)" }}>Terms</a> and <a style={{ color: "var(--text-muted)" }}>Privacy Policy</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthStat({ n, l }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{n}</div>
      <div style={{ fontSize: 11, opacity: .85, fontWeight: 600 }}>{l}</div>
    </div>
  );
}
function FormGroup({ label, children, trailing }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.005em" }}>{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

window.AuthShell = AuthShell;
