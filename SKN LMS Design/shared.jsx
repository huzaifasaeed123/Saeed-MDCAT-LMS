/* global React */
// Shared building blocks: Logo, Sidebar, TopBar, AppShell, Icons.

const { useState } = React;

/* ============ LOGO ============ */
// Mark uses a stethoscope-inspired glyph + gradient wordmark.
// Sized small/medium/large.
function Logo({ size = "md", mono = false }) {
  const sizes = {
    sm: { glyph: 28, font: 16, gap: 8 },
    md: { glyph: 36, font: 19, gap: 10 },
    lg: { glyph: 64, font: 34, gap: 14 },
  };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <div
        style={{
          width: s.glyph, height: s.glyph, borderRadius: s.glyph * 0.28,
          background: mono ? "transparent" : "var(--grad-brand-vivid)",
          border: mono ? "1.5px solid currentColor" : "none",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: mono ? "none" : "0 4px 12px -4px rgba(124,58,237,.55)",
          flexShrink: 0,
        }}
      >
        <svg width={s.glyph * 0.62} height={s.glyph * 0.62} viewBox="0 0 24 24" fill="none">
          {/* Stethoscope-ish "S" + book glyph */}
          <path d="M5 4v6a4 4 0 0 0 8 0V4" stroke={mono ? "currentColor" : "#fff"} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 14v3a4 4 0 0 0 8 0v-1" stroke={mono ? "currentColor" : "#fff"} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="14" r="2" stroke={mono ? "currentColor" : "#fff"} strokeWidth="1.8" />
          <circle cx="5" cy="4" r=".9" fill={mono ? "currentColor" : "#fff"} />
          <circle cx="13" cy="4" r=".9" fill={mono ? "currentColor" : "#fff"} />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <div
          className={mono ? "" : "txt-grad"}
          style={{ fontWeight: 800, fontSize: s.font, letterSpacing: "-0.025em", color: mono ? "currentColor" : undefined }}
        >
          Saeed MDCAT
        </div>
        <div style={{ fontSize: s.font * 0.5, fontWeight: 600, color: "var(--text-faint)", marginTop: 3, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Academy
        </div>
      </div>
    </div>
  );
}

/* ============ ICONS ============ */
const Icon = ({ name, size = 20, stroke = 1.7, ...rest }) => {
  const paths = {
    home: <><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" /></>,
    book: <><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" /><path d="M4 17a3 3 0 0 1 3-3h11" /></>,
    zap:  <><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></>,
    doc:  <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h6" /></>,
    flag: <><path d="M5 22V4" /><path d="M5 4h12l-2 5 2 5H5" /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M5 6H3v2a3 3 0 0 0 3 3M19 6h2v2a3 3 0 0 1-3 3" /><path d="M10 14h4l1 4H9l1-4z" /><path d="M8 22h8" /></>,
    chat: <><path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4A8 8 0 1 1 21 12z" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
    note: <><path d="M5 4h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M16 4v4h4" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5 4l-3 8v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3-8z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
    bell:  <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    megaphone: <><path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4l-8 5H5a2 2 0 0 0-2 2z" /><path d="M19 8a4 4 0 0 1 0 8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    chevronR: <><path d="M9 6l6 6-6 6" /></>,
    chevronL: <><path d="M15 6l-6 6 6 6" /></>,
    chevronD: <><path d="M6 9l6 6 6-6" /></>,
    chevronU: <><path d="M6 15l6-6 6 6" /></>,
    lock:  <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 1 1 8 0v4" /></>,
    check: <><path d="m5 12 5 5L20 7" /></>,
    x:     <><path d="M6 6l12 12M6 18 18 6" /></>,
    plus:  <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    sun:   <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon:  <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
    filter:<><path d="M3 5h18l-7 9v6l-4-2v-4z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    eye:   <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    barchart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
    flame: <><path d="M12 2s4 4 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3s-2 2-2 5a6 6 0 0 0 12 0c0-7-7-11-7-11z" /></>,
    sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path d="M19 14l.7 2.2L22 17l-2.3.8L19 20l-.7-2.2L16 17l2.3-.8z" /></>,
    bookmark: <><path d="M6 3h12v18l-6-4-6 4V3z" /></>,
    heart: <><path d="M20.8 5.6a5 5 0 0 0-7.2 0L12 7.2l-1.6-1.6a5 5 0 0 0-7.2 7.2L12 21l8.8-8.2a5 5 0 0 0 0-7.2z" /></>,
    user:  <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
    upload: <><path d="M12 21V9M7 14l5-5 5 5M5 3h14" /></>,
    play:  <><polygon points="6 4 20 12 6 20" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    flagSmall: <><path d="M5 22V4M5 4h13l-2 4 2 4H5" /></>,
    grid:  <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    list:  <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
    arrowR:<><path d="M5 12h14M13 5l7 7-7 7" /></>,
    arrowL:<><path d="M19 12H5M11 5l-7 7 7 7" /></>,
    pin: <><path d="M12 17v5M5 12l7-9 7 9-4 1v4H9v-4l-4-1z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
    star: <><polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 9 12 2" /></>,
    cap: <><path d="M22 9 12 4 2 9l10 5 10-5z" /><path d="M6 11v5a6 4 0 0 0 12 0v-5" /></>,
    pencilSimple: <><path d="M3 21l3-.7L19 7.3 17 5 4 18l-1 3z" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      {...rest}>
      {paths[name] || null}
    </svg>
  );
};

/* ============ SIDEBAR ============ */
function Sidebar({ active = "Dashboard", collapsed = false }) {
  const nav = [
    { label: "Dashboard",         icon: "home",   locked: false },
    { label: "My Courses",        icon: "book",   locked: false },
    { label: "Create Practice",   icon: "zap",    locked: false },
    { label: "Test History",      icon: "doc",    locked: false },
    { label: "MCQ Reports",       icon: "flag",   locked: false },
    { label: "Leaderboard",       icon: "trophy", locked: false, badge: "#1" },
    { label: "Community",         icon: "chat",   locked: false },
    { label: "Notes",             icon: "note",   locked: false },
    { label: "Videos",            icon: "video",  locked: false },
    { label: "Messages",          icon: "inbox",  locked: false, badge: "3" },
  ];
  return (
    <aside style={{
      width: collapsed ? 76 : 248, flexShrink: 0,
      background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "20px 14px 18px",
    }}>
      <div style={{ padding: "4px 6px 22px" }}>
        {collapsed ? (
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: "var(--grad-brand-vivid)",
            boxShadow: "0 4px 12px -4px rgba(124,58,237,.55)"
          }} />
        ) : <Logo size="md" />}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {nav.map((item) => {
          const isActive = item.label === active;
          return (
            <button key={item.label} style={{
              all: "unset",
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderRadius: 10, cursor: "pointer", color: "var(--sidebar-text)",
              background: isActive ? "var(--sidebar-active-bg)" : "transparent",
              fontWeight: isActive ? 700 : 500, fontSize: 14,
              position: "relative",
            }}>
              {isActive && <div style={{
                position: "absolute", left: -14, top: 8, bottom: 8, width: 3, borderRadius: 4,
                background: "var(--grad-brand-vivid)",
              }} />}
              <span style={{ color: isActive ? "var(--sidebar-active-text)" : "var(--text-muted)", display: "flex" }}>
                <Icon name={item.icon} size={18} />
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1, color: isActive ? "var(--sidebar-active-text)" : undefined }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "3px 7px", borderRadius: 999,
                      background: "var(--grad-brand-vivid)", color: "#fff",
                    }}>{item.badge}</span>
                  )}
                  {item.locked && <Icon name="lock" size={13} />}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <button style={{
          all: "unset", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
          borderRadius: 10, cursor: "pointer", color: "var(--text-muted)", width: "100%",
          fontWeight: 500, fontSize: 14,
        }}>
          <Icon name="logout" size={18} />
          {!collapsed && <span>Log out</span>}
        </button>

        <div style={{
          marginTop: 8, padding: "10px", borderRadius: 12, background: "var(--bg-muted)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "var(--grad-brand-vivid)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14,
          }}>HS</div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Huzaifa Saeed</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>huzaifa@saeedmdcat.pk</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ============ TOPBAR ============ */
function TopBar({ title, subtitle, action }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", padding: "18px 28px",
      borderBottom: "1px solid var(--border)", background: "var(--bg-canvas)",
      gap: 24, minHeight: 76,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
        background: "var(--bg-muted)", borderRadius: 10, width: 340,
      }}>
        <Icon name="search" size={16} stroke={2} />
        <input placeholder="Search courses, MCQs, topics…" style={{
          all: "unset", flex: 1, fontSize: 13, color: "var(--text)", fontFamily: "var(--font)",
        }} />
        <kbd style={{
          fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-faint)",
          padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border-strong)",
        }}>⌘K</kbd>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{
          all: "unset", padding: 9, borderRadius: 10, cursor: "pointer",
          color: "var(--text-muted)", position: "relative",
        }}>
          <Icon name="megaphone" size={18} />
        </button>
        <button style={{
          all: "unset", padding: 9, borderRadius: 10, cursor: "pointer",
          color: "var(--text-muted)", position: "relative",
        }}>
          <Icon name="bell" size={18} />
          <span style={{
            position: "absolute", top: 6, right: 6, width: 7, height: 7,
            borderRadius: "50%", background: "var(--o500)", border: "2px solid var(--bg-canvas)",
          }} />
        </button>
        {action}
      </div>
    </header>
  );
}

/* ============ APP SHELL (sidebar + content area) ============ */
function AppShell({ theme = "light", active, title, subtitle, action, children, collapsed = false }) {
  return (
    <div className="lms-shell" data-theme={theme} style={{ display: "flex", width: "100%", height: "100%" }}>
      <Sidebar active={active} collapsed={collapsed} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <TopBar title={title} subtitle={subtitle} action={action} />
        <div style={{ flex: 1, overflow: "hidden", padding: "26px 32px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Logo, Icon, Sidebar, TopBar, AppShell });
