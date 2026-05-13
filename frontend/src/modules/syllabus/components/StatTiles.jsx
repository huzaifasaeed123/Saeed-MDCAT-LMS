import React from 'react';
import { FiBookOpen, FiAward, FiAlertCircle, FiZap } from 'react-icons/fi';

const COLOR = {
  blue:    { accent: 'bg-blue-500',    iconBg: 'bg-blue-500/20 text-blue-300',       fill: 'from-blue-500 to-cyan-400' },
  emerald: { accent: 'bg-emerald-500', iconBg: 'bg-emerald-500/20 text-emerald-300', fill: 'from-emerald-500 to-blue-500' },
  red:     { accent: 'bg-red-500',     iconBg: 'bg-red-500/20 text-red-300',         fill: 'from-red-500 to-orange-500' },
  amber:   { accent: 'bg-amber-500',   iconBg: 'bg-amber-500/20 text-amber-300',     fill: 'from-amber-500 to-orange-500' },
};

const Tile = ({ color, icon, n, label, sub, progress }) => {
  const c = COLOR[color];
  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-hidden hover:border-slate-700 transition-colors">
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${c.accent}`} />
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${c.iconBg}`}>{icon}</div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold text-right truncate max-w-[70%]">{sub}</span>
      </div>
      <div className="text-2xl font-extrabold text-white leading-none">{n}</div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">{label}</div>
      {progress != null && (
        <div className="h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${c.fill}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

const StatTiles = ({ totalTopics, started, mastered, masteredPct, due, streak }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
    <Tile color="blue"    icon={<FiBookOpen />}    n={totalTopics}        label="Total Topics" sub={`${started} started`} />
    <Tile color="emerald" icon={<FiAward />}       n={mastered}           label="Mastered"      sub={`${masteredPct}% of syllabus`} progress={masteredPct} />
    <Tile color="red"     icon={<FiAlertCircle />} n={due}                label="Due Today"     sub={due > 0 ? 'Revise now' : 'All caught up'} />
    <Tile color="amber"   icon={<FiZap />}         n={`${streak} 🔥`}    label="Day Streak"    sub="Keep it burning" />
  </div>
);

export default StatTiles;
