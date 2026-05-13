import React from 'react';
import { FiBell, FiBookOpen, FiCalendar, FiRefreshCw } from 'react-icons/fi';
import TopicRow from '../components/TopicRow';
import StickyNotesPanel from '../components/StickyNotesPanel';
import DailyPlanner from '../components/DailyPlanner';

const SEVERITY = {
  high: 'bg-red-500/15 text-red-300 border-red-500/40',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  info: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
};

const Section = ({ icon, title, count, hot, hint, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <span className="text-emerald-400">{icon}</span> {title}
      </h3>
      {count != null && (
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
          hot ? 'bg-red-500/15 text-red-300 border-red-500/35' : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {count}
        </span>
      )}
    </div>
    {hint && <p className="text-xs text-slate-500 mb-2.5">{hint}</p>}
    {children}
  </div>
);

const Empty = ({ msg }) => (
  <div className="text-center py-6 px-4 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl">
    <p className="text-sm text-slate-400">{msg}</p>
  </div>
);

// All data comes from props — derived once in the parent via useMemo selectors.
// Local mutations bubble up via the on… callbacks; the parent owns the truth.
const TodayPane = ({
  today, reminders, due, upcoming, suggestedNew,
  todos, notes,
  onOpenTopic,
  onTodoCreated, onTodoUpdated, onTodoDeleted, onTodosSeeded,
  onNoteCreated, onNoteUpdated, onNoteDeleted,
}) => (
  <div className="space-y-5">
    {reminders.length > 0 && (
      <Section icon={<FiBell />} title="Reminders for today" count={reminders.length}>
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className={`text-sm px-3 py-2 rounded-md border ${SEVERITY[r.severity] || SEVERITY.info}`}>
              {r.message}
            </div>
          ))}
        </div>
      </Section>
    )}

    <StickyNotesPanel
      notes={notes}
      onCreated={onNoteCreated}
      onUpdated={onNoteUpdated}
      onDeleted={onNoteDeleted}
    />

    <DailyPlanner
      todos={todos}
      onCreated={onTodoCreated}
      onUpdated={onTodoUpdated}
      onDeleted={onTodoDeleted}
      onSeeded={onTodosSeeded}
    />

    <Section icon={<FiRefreshCw />} title="Due for revision" count={due.length} hot
      hint="Topics your memory is about to forget. Grade Again / Good / Easy — the schedule adapts.">
      {due.length === 0 ? (
        <Empty msg="Nothing due — great job staying on top of it." />
      ) : (
        <div className="space-y-2">
          {due.map((t) => (
            <TopicRow key={t.topic} topic={t} today={today} onClick={() => onOpenTopic(t.topic)} />
          ))}
        </div>
      )}
    </Section>

    <Section icon={<FiBookOpen />} title="New topics to learn" count={suggestedNew.length}>
      {suggestedNew.length === 0 ? (
        <Empty msg="You've started everything in the catalog." />
      ) : (
        <div className="space-y-2">
          {suggestedNew.map((t) => (
            <TopicRow key={t._id} topic={t} today={today} compact onClick={() => onOpenTopic(t._id)} />
          ))}
        </div>
      )}
    </Section>

    <Section icon={<FiCalendar />} title="Upcoming this week" count={upcoming.length}
      hint="Reviews scheduled for the next 7 days based on your Leitner intervals.">
      {upcoming.length === 0 ? (
        <Empty msg="No upcoming revisions." />
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => (
            <TopicRow key={t.topic} topic={t} today={today} compact onClick={() => onOpenTopic(t.topic)} />
          ))}
        </div>
      )}
    </Section>
  </div>
);

export default TodayPane;
