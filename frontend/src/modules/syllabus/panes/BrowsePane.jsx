import React, { useMemo, useState } from 'react';
import { FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import TopicRow from '../components/TopicRow';
import { subjectGradient } from '../components/syllabusMeta';

// Subject segments + tree search + collapsible unit cards. Pure:
// reads `tree` + `progressMap` from props, dispatches onOpenTopic on click.
const BrowsePane = ({ tree, progressMap, onOpenTopic }) => {
  const [active, setActive] = useState(null); // null = All
  const [query,  setQuery]  = useState('');
  const [openUnit, setOpenUnit] = useState({});

  const subjectStats = useMemo(() => {
    if (!tree) return [];
    return tree.subjects.map((s) => {
      let total = 0, mastered = 0;
      for (const u of s.units) for (const o of u.outcomes) {
        total++;
        if (progressMap[String(o._id)]?.status === 'mastered') mastered++;
      }
      return { subject: s.subject, total, mastered };
    });
  }, [tree, progressMap]);

  const filteredTree = useMemo(() => {
    if (!tree) return [];
    let subjects = tree.subjects;
    if (active) subjects = subjects.filter((s) => s.subject === active);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      subjects = subjects.map((s) => ({
        ...s,
        units: s.units.map((u) => ({
          ...u,
          outcomes: u.outcomes.filter((o) =>
            (o.outcomeText || '').toLowerCase().includes(q)
            || (o.outcomeCode || '').toLowerCase().includes(q)
            || (u.unitTitle  || '').toLowerCase().includes(q)
          ),
        })).filter((u) => u.outcomes.length > 0),
      })).filter((s) => s.units.length > 0);
    }
    return subjects;
  }, [tree, active, query]);

  if (!tree) {
    return <div className="text-center py-6 text-sm text-slate-400">No syllabus data.</div>;
  }

  return (
    <div>
      {/* Subject segments */}
      <div className="flex flex-wrap gap-1 mb-3 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
        <button
          onClick={() => setActive(null)}
          className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            active === null ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All <span className="opacity-70">({subjectStats.reduce((s, x) => s + x.total, 0)})</span>
        </button>
        {subjectStats.map((s) => (
          <button
            key={s.subject}
            onClick={() => setActive(s.subject)}
            className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              active === s.subject
                ? `${subjectGradient(s.subject)} text-white shadow-md`
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.subject} <span className="opacity-70">({s.mastered}/{s.total})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics, codes or unit titles…"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
        />
      </div>

      {filteredTree.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">No matching topics.</div>
      ) : (
        <div className="space-y-3">
          {filteredTree.map((s) => (
            <div key={s.subject}>
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${subjectGradient(s.subject)}`} />
                {s.subject}
              </h3>
              <div className="space-y-2">
                {s.units.map((u) => {
                  const key = `${s.subject}-${u.unitNumber}`;
                  const isOpen = openUnit[key] ?? !!query.trim();
                  let unitMastered = 0;
                  for (const o of u.outcomes) if (progressMap[String(o._id)]?.status === 'mastered') unitMastered++;
                  const pct = u.outcomes.length ? Math.round((unitMastered / u.outcomes.length) * 100) : 0;
                  return (
                    <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenUnit((o) => ({ ...o, [key]: !isOpen }))}
                        className="w-full px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center text-left hover:bg-slate-800/50"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit {u.unitNumber}</p>
                          <p className="text-sm font-bold text-white mt-0.5">{u.unitTitle}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{u.outcomes.length} outcome{u.outcomes.length === 1 ? '' : 's'} · {unitMastered} mastered</p>
                        </div>
                        <div className="w-20 text-right">
                          <div className="text-xs font-bold text-emerald-400">{pct}%</div>
                          <div className="h-1 bg-slate-800 rounded mt-1 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {isOpen ? <FiChevronUp className="text-slate-500" /> : <FiChevronDown className="text-slate-500" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-1.5">
                          {u.outcomes.map((o) => {
                            const p = progressMap[String(o._id)];
                            return (
                              <TopicRow
                                key={o._id}
                                topic={{
                                  ...o, subject: s.subject, unitNumber: u.unitNumber, unitTitle: u.unitTitle,
                                  status: p?.status || 'new', nextReviewDay: p?.nextReviewDay,
                                }}
                                today={null}
                                compact
                                onClick={() => onOpenTopic(o._id)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowsePane;
