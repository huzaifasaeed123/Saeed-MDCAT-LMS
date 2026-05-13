import React, { useMemo } from 'react';
import { FiBarChart2, FiVideo, FiBook, FiCheckSquare, FiAward } from 'react-icons/fi';
import { subjectGradient } from '../components/syllabusMeta';

const KPI_COLOR = {
  purple:  'bg-purple-500/20 text-purple-300',
  blue:    'bg-blue-500/20 text-blue-300',
  amber:   'bg-amber-500/20 text-amber-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
};

const KpiCard = ({ icon, color, n, label, sub }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${KPI_COLOR[color]}`}>{icon}</div>
    <p className="text-2xl font-extrabold text-white mt-3 leading-none">{n}</p>
    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1.5">{label}</p>
    <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
  </div>
);

const Legend = ({ dot, label, value }) => (
  <div className="flex items-center gap-2 text-slate-300">
    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
    <span className="flex-1">{label}</span>
    <span className="font-bold text-white">{value}</span>
  </div>
);

// All numbers come from props (parent's useMemo selectors) — pure render.
const StatsPane = ({ counts, tree, progressMap }) => {
  const totalTopics = counts.totalTopics || 1;
  const masteredPct = Math.round((counts.mastered / totalTopics) * 100);

  // Per-subject breakdown derived right here — cheap (~300-row scan).
  const bySubject = useMemo(() => {
    if (!tree) return [];
    return tree.subjects.map((s) => {
      let total = 0, mastered = 0, started = 0;
      for (const u of s.units) for (const o of u.outcomes) {
        total++;
        const p = progressMap[String(o._id)];
        if (p) started++;
        if (p?.status === 'mastered') mastered++;
      }
      const pct = total ? Math.round((mastered / total) * 100) : 0;
      return { subject: s.subject, total, mastered, started, pct };
    });
  }, [tree, progressMap]);

  // Donut arc lengths. r=42 → circumference = 263.9.
  const arc = (n) => Math.round((n / totalTopics) * 263.9 * 100) / 100;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<FiVideo />}        color="purple"  n={counts.lecturesDone} label="Lectures done" sub={`${Math.round((counts.lecturesDone / totalTopics) * 100)}% of syllabus`} />
        <KpiCard icon={<FiBook />}         color="blue"    n={counts.booksDone}    label="Books read"     sub={`${Math.round((counts.booksDone / totalTopics) * 100)}% of syllabus`} />
        <KpiCard icon={<FiCheckSquare />}  color="amber"   n={counts.mcqsDone}     label="MCQs solved"    sub="across all topics" />
        <KpiCard icon={<FiAward />}        color="emerald" n={counts.mastered}     label="Mastered"        sub={`${masteredPct}% overall`} />
      </div>

      {/* Donut + per-subject bars */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center">
          <div className="relative w-44 h-44">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="10"
                strokeDasharray={`${arc(counts.mastered)} 263.9`} />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#a855f7" strokeWidth="10"
                strokeDasharray={`${arc(counts.reviewing)} 263.9`}
                strokeDashoffset={`-${arc(counts.mastered)}`} />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f59e0b" strokeWidth="10"
                strokeDasharray={`${arc(counts.learning)} 263.9`}
                strokeDashoffset={`-${arc(counts.mastered) + arc(counts.reviewing)}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-extrabold text-white">{masteredPct}%</p>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Mastered</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 w-full text-xs">
            <Legend dot="bg-emerald-500" label="Mastered"  value={counts.mastered} />
            <Legend dot="bg-purple-500"  label="Reviewing" value={counts.reviewing} />
            <Legend dot="bg-amber-500"   label="Learning"  value={counts.learning} />
            <Legend dot="bg-slate-600"   label="New"       value={counts.newFromCatalog} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <FiBarChart2 className="text-emerald-400" /> Progress by subject
          </h4>
          {bySubject.length === 0 ? (
            <p className="text-sm text-slate-500">No subjects yet.</p>
          ) : (
            <div className="space-y-3">
              {bySubject.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-200 font-bold">{s.subject}</span>
                    <span className="text-slate-400">{s.mastered}/{s.total} · {s.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${subjectGradient(s.subject)}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPane;
