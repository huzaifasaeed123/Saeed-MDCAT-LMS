// Udemy-style player for "structure" mode courses.
// Left: curriculum tree (Subject → Chapter → Topic → Resource).
// Right: inline player for the active resource + Prev/Next footer.
import React, { useState, useMemo, useEffect } from 'react';
import {
  FiChevronDown, FiChevronRight, FiChevronLeft,
  FiVideo, FiFileText, FiCheckSquare, FiBookOpen, FiLayers, FiTag,
  FiExternalLink, FiPlay, FiLink, FiLock, FiClock,
  FiMenu, FiX, FiMaximize2, FiList,
} from 'react-icons/fi';

const STATIC_BASE = 'http://localhost:5000';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (v) => {
  if (!v) return '';
  try {
    return new Date(v).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const getStatus = (r) => {
  const { availability: av, unlockAt, lockAt } = r;
  if (!av || av === 'public') return 'available';
  const now = new Date();
  if (av === 'unlock_date') return unlockAt && now < new Date(unlockAt) ? 'locked' : 'available';
  if (av === 'window') {
    if (unlockAt && now < new Date(unlockAt)) return 'locked';
    if (lockAt   && now > new Date(lockAt))   return 'closed';
    return 'available';
  }
  return 'available';
};

const RES_CFG = {
  lecture:  { label: 'Lecture',  Icon: FiVideo,       color: 'text-red-500',     solidBg: 'bg-red-500',     hoverBg: 'hover:bg-red-600',     lightBg: 'bg-red-50',     border: 'border-red-200'     },
  notes:    { label: 'Notes',    Icon: FiFileText,    color: 'text-orange-500',  solidBg: 'bg-orange-500',  hoverBg: 'hover:bg-orange-600',  lightBg: 'bg-orange-50',  border: 'border-orange-200'  },
  test:     { label: 'Test',     Icon: FiCheckSquare, color: 'text-emerald-600', solidBg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-700', lightBg: 'bg-emerald-50', border: 'border-emerald-200' },
  external: { label: 'External', Icon: FiLink,        color: 'text-purple-600',  solidBg: 'bg-purple-600',  hoverBg: 'hover:bg-purple-700',  lightBg: 'bg-purple-50',  border: 'border-purple-200'  },
};

const sortByOrder = (arr = []) => [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));

// Build a flat playlist of all resources (with breadcrumb path).
const buildPlaylist = (subjects, labels) => {
  const list = [];
  sortByOrder(subjects || []).forEach((subject) => {
    sortByOrder(subject.chapters || []).forEach((chapter) => {
      if (chapter.useTopics) {
        sortByOrder(chapter.topics || []).forEach((topic) => {
          sortByOrder(topic.resources || []).forEach((r) => {
            list.push({
              resource: r,
              path: { subject, chapter, topic },
              breadcrumb: `${subject.title || labels.l1} · ${chapter.title || labels.l2} · ${topic.title || labels.l3}`,
            });
          });
        });
      } else {
        sortByOrder(chapter.resources || []).forEach((r) => {
          list.push({
            resource: r,
            path: { subject, chapter, topic: null },
            breadcrumb: `${subject.title || labels.l1} · ${chapter.title || labels.l2}`,
          });
        });
      }
    });
  });
  return list;
};

// ─── ResourceTreeRow ──────────────────────────────────────────────────────────
const ResourceTreeRow = ({ resource, isActive, onClick, status }) => {
  const cfg = RES_CFG[resource.type] || RES_CFG.lecture;
  const title = resource.title || (resource.type === 'test' && resource.testId?.title) || 'Untitled';
  const locked = status === 'locked';
  const closed = status === 'closed';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary-50 ring-1 ring-primary-200'
          : closed
            ? 'opacity-50'
            : 'hover:bg-gray-100'
      }`}
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
        isActive ? 'bg-white shadow-sm' : cfg.lightBg
      }`}>
        {locked
          ? <FiLock className="w-3.5 h-3.5 text-amber-500" />
          : <cfg.Icon className={`w-3.5 h-3.5 ${cfg.color}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight truncate ${
          isActive ? 'font-semibold text-primary-700' : locked ? 'text-gray-500' : 'text-gray-700'
        }`}>{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {cfg.label}{locked ? ' · Locked' : closed ? ' · Closed' : ''}
        </p>
      </div>
    </button>
  );
};

// ─── TopicGroup ───────────────────────────────────────────────────────────────
const TopicGroup = ({ topic, activeResId, onSelectResource, label, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const resources = sortByOrder(topic.resources || []);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-lg hover:bg-violet-50 transition-colors"
      >
        {open ? <FiChevronDown className="w-3.5 h-3.5 text-violet-400" />
              : <FiChevronRight className="w-3.5 h-3.5 text-violet-400" />}
        <FiTag className="w-3 h-3 text-violet-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-violet-700 truncate flex-1">
          {topic.title || `Untitled ${label}`}
        </span>
        <span className="text-[10px] text-violet-400 flex-shrink-0">{resources.length}</span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-violet-100 pl-2">
          {resources.length === 0
            ? <p className="text-[11px] text-gray-300 italic px-2 py-1">Empty</p>
            : resources.map((r) => (
                <ResourceTreeRow key={r._id} resource={r}
                  isActive={r._id === activeResId}
                  onClick={() => onSelectResource(r._id)}
                  status={getStatus(r)} />
              ))
          }
        </div>
      )}
    </div>
  );
};

// ─── ChapterGroup ─────────────────────────────────────────────────────────────
const ChapterGroup = ({ chapter, activeResId, onSelectResource, label, topicLabel, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const topics = sortByOrder(chapter.topics || []);
  const resources = sortByOrder(chapter.resources || []);
  const count = chapter.useTopics ? topics.length : resources.length;

  // If active resource is inside this chapter, open it
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-sky-50 transition-colors"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-sky-400" />
              : <FiChevronRight className="w-4 h-4 text-sky-400" />}
        <FiBookOpen className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-sky-900 truncate flex-1">
          {chapter.title || `Untitled ${label}`}
        </span>
        <span className="text-[10px] text-sky-400 flex-shrink-0 bg-sky-50 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l border-sky-100 pl-2">
          {chapter.useTopics ? (
            topics.length === 0
              ? <p className="text-[11px] text-gray-300 italic px-2 py-1">No {topicLabel.toLowerCase()}s</p>
              : topics.map((t) => (
                  <TopicGroup key={t._id} topic={t}
                    activeResId={activeResId} onSelectResource={onSelectResource}
                    label={topicLabel}
                    defaultOpen={(t.resources || []).some((r) => r._id === activeResId)} />
                ))
          ) : (
            resources.length === 0
              ? <p className="text-[11px] text-gray-300 italic px-2 py-1">Empty</p>
              : resources.map((r) => (
                  <ResourceTreeRow key={r._id} resource={r}
                    isActive={r._id === activeResId}
                    onClick={() => onSelectResource(r._id)}
                    status={getStatus(r)} />
                ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── SubjectGroup ─────────────────────────────────────────────────────────────
const SubjectGroup = ({ subject, activeResId, onSelectResource, labels, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const chapters = sortByOrder(subject.chapters || []);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  // Find which chapter contains the active resource
  const activeChapterId = useMemo(() => {
    for (const ch of chapters) {
      if (ch.useTopics) {
        for (const t of (ch.topics || [])) {
          if ((t.resources || []).some((r) => r._id === activeResId)) return ch._id;
        }
      } else if ((ch.resources || []).some((r) => r._id === activeResId)) {
        return ch._id;
      }
    }
    return null;
  }, [chapters, activeResId]);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-50/50 hover:from-indigo-100 hover:to-indigo-50 transition-colors"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-indigo-500" />
              : <FiChevronRight className="w-4 h-4 text-indigo-500" />}
        <FiLayers className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <span className="text-sm font-bold text-indigo-900 truncate flex-1">
          {subject.title || `Untitled ${labels.l1}`}
        </span>
        <span className="text-[10px] text-indigo-500 flex-shrink-0 bg-white border border-indigo-100 px-1.5 py-0.5 rounded-full">
          {chapters.length} {labels.l2.toLowerCase()}{chapters.length !== 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {chapters.length === 0
            ? <p className="text-xs text-gray-300 italic px-3 py-2">No {labels.l2.toLowerCase()}s</p>
            : chapters.map((ch) => (
                <ChapterGroup key={ch._id} chapter={ch}
                  activeResId={activeResId} onSelectResource={onSelectResource}
                  label={labels.l2} topicLabel={labels.l3}
                  defaultOpen={ch._id === activeChapterId} />
              ))
          }
        </div>
      )}
    </div>
  );
};

// ─── CurriculumSidebar ────────────────────────────────────────────────────────
const CurriculumSidebar = ({ subjects, activeResId, onSelectResource, labels, totalResources, currentIdx, onClose }) => (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="px-4 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
          <FiList className="w-4 h-4 text-primary-500" /> Course Curriculum
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {currentIdx + 1} of {totalResources} · {subjects.length} {labels.l1.toLowerCase()}{subjects.length !== 1 ? 's' : ''}
        </p>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
          <FiX className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* Tree */}
    <div className="flex-1 overflow-y-auto p-2.5">
      {subjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No content yet.</p>
      ) : (
        sortByOrder(subjects).map((subject) => {
          // Open by default if it contains the active resource
          const containsActive = (subject.chapters || []).some((ch) => {
            if (ch.useTopics) {
              return (ch.topics || []).some((t) => (t.resources || []).some((r) => r._id === activeResId));
            }
            return (ch.resources || []).some((r) => r._id === activeResId);
          });
          return (
            <SubjectGroup key={subject._id} subject={subject}
              activeResId={activeResId} onSelectResource={onSelectResource}
              labels={labels} defaultOpen={containsActive} />
          );
        })
      )}
    </div>
  </div>
);

// ─── PlayerArea ───────────────────────────────────────────────────────────────
const PlayerArea = ({ entry, onStartTest, onOpenViewer }) => {
  if (!entry) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <FiPlay className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Select a lesson to begin learning.</p>
        </div>
      </div>
    );
  }

  const { resource, breadcrumb } = entry;
  const cfg = RES_CFG[resource.type] || RES_CFG.lecture;
  const title = resource.title || (resource.type === 'test' && resource.testId?.title) || 'Untitled';
  const status = getStatus(resource);
  const locked = status === 'locked';
  const closed = status === 'closed';

  // Locked / closed banner
  if (locked || closed) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <p className="text-xs font-semibold text-primary-500 uppercase tracking-wider truncate">{breadcrumb}</p>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mt-1 truncate">{title}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className={`max-w-md w-full text-center rounded-2xl border p-8 ${
            locked ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
              locked ? 'bg-amber-100' : 'bg-gray-200'
            }`}>
              {locked ? <FiLock className="w-8 h-8 text-amber-500" />
                      : <FiClock className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className={`text-lg font-bold mb-2 ${locked ? 'text-amber-700' : 'text-gray-700'}`}>
              {locked ? 'This lesson is locked' : 'This lesson has closed'}
            </h3>
            <p className={`text-sm ${locked ? 'text-amber-600' : 'text-gray-500'}`}>
              {locked && resource.unlockAt && (
                <>Opens on <strong>{fmtDate(resource.unlockAt)}</strong> PKT</>
              )}
              {closed && resource.lockAt && (
                <>Closed on <strong>{fmtDate(resource.lockAt)}</strong> PKT</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Drive video / PDF embed
  const isVideo = resource.type === 'lecture' && resource.driveFileId;
  const isPdf   = resource.type === 'notes'   && resource.driveFileId;
  const isExtPdf= resource.type === 'notes'   && !resource.driveFileId && resource.fileUrl;
  const isTest  = resource.type === 'test'    && resource.testId;
  const isExt   = resource.type === 'external' && resource.externalUrl;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-gray-100 bg-white flex items-start gap-3 flex-shrink-0">
        <div className={`w-10 h-10 rounded-xl ${cfg.lightBg} flex items-center justify-center flex-shrink-0`}>
          <cfg.Icon className={`w-5 h-5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider truncate">{breadcrumb}</p>
          <h2 className="text-base sm:text-lg font-bold text-gray-800 mt-0.5 truncate">{title}</h2>
        </div>
        {(isVideo || isPdf) && (
          <button
            onClick={() => onOpenViewer({
              type: isVideo ? 'video' : 'pdf',
              driveFileId: resource.driveFileId,
              title,
            })}
            title="Fullscreen"
            className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <FiMaximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Player body */}
      <div className="flex-1 min-h-0 bg-gray-900 flex items-center justify-center">
        {isVideo && (
          <iframe
            key={resource._id}
            src={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
            title={title}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full h-full border-0"
          />
        )}
        {isPdf && (
          <iframe
            key={resource._id}
            src={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
            title={title}
            allowFullScreen
            className="w-full h-full border-0 bg-white"
          />
        )}
        {isExtPdf && (
          <iframe
            key={resource._id}
            src={`${STATIC_BASE}${resource.fileUrl}`}
            title={title}
            className="w-full h-full border-0 bg-white"
          />
        )}
        {isTest && (
          <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-emerald-100 p-8 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
                <FiCheckSquare className="w-10 h-10 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Practice Test</p>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 mb-6">
                Click below to launch the test. Your progress will be saved automatically.
              </p>
              <button
                onClick={() => onStartTest(resource.testId._id || resource.testId)}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors shadow-md hover:shadow-lg"
              >
                <FiPlay className="w-4 h-4" /> Start Test
              </button>
            </div>
          </div>
        )}
        {isExt && (
          <div className="w-full h-full bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-purple-100 p-8 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-purple-100 flex items-center justify-center mb-5">
                <FiLink className="w-10 h-10 text-purple-600" />
              </div>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">External Test</p>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 mb-6 break-all">
                {resource.externalUrl}
              </p>
              <a
                href={resource.externalUrl} target="_blank" rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors shadow-md hover:shadow-lg"
              >
                <FiExternalLink className="w-4 h-4" /> Open Test
              </a>
            </div>
          </div>
        )}
        {!isVideo && !isPdf && !isExtPdf && !isTest && !isExt && (
          <div className="text-center text-gray-300 p-8">
            <cfg.Icon className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">No playable content for this resource.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── StructureCourseView ──────────────────────────────────────────────────────
const StructureCourseView = ({ subjects, onStartTest, onOpenViewer, labels }) => {
  const lbls = {
    l1: labels?.l1 || 'Subject',
    l2: labels?.l2 || 'Chapter',
    l3: labels?.l3 || 'Topic',
  };

  // Flat playlist
  const playlist = useMemo(() => buildPlaylist(subjects, lbls), [subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default to the first available (non-locked) resource, else first
  const defaultIdx = useMemo(() => {
    const i = playlist.findIndex((p) => getStatus(p.resource) === 'available');
    return i === -1 ? 0 : i;
  }, [playlist]);

  const [selectedIdx, setSelectedIdx] = useState(defaultIdx);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync if course data changes
  useEffect(() => { setSelectedIdx(defaultIdx); }, [defaultIdx]);

  if (!subjects || subjects.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border">
        <FiLayers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No content available yet.</p>
      </div>
    );
  }

  if (playlist.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border">
        <FiPlay className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">This course has no resources yet.</p>
      </div>
    );
  }

  const current = playlist[selectedIdx];
  const activeResId = current?.resource?._id;

  const goTo = (idx) => {
    if (idx >= 0 && idx < playlist.length) {
      setSelectedIdx(idx);
      setSidebarOpen(false);
      document.getElementById('structure-course-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSelectResource = (resId) => {
    const i = playlist.findIndex((p) => p.resource._id === resId);
    if (i !== -1) goTo(i);
  };

  const prevEntry = selectedIdx > 0 ? playlist[selectedIdx - 1] : null;
  const nextEntry = selectedIdx < playlist.length - 1 ? playlist[selectedIdx + 1] : null;

  return (
    <div className="relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-80 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl border-r border-gray-200">
            <CurriculumSidebar
              subjects={subjects}
              activeResId={activeResId}
              onSelectResource={onSelectResource}
              labels={lbls}
              totalResources={playlist.length}
              currentIdx={selectedIdx}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white shadow-sm"
          >
            <FiMenu className="w-4 h-4" /> Curriculum
          </button>
          <span className="text-sm font-medium text-gray-500">
            {selectedIdx + 1} <span className="text-gray-300 mx-0.5">/</span> {playlist.length}
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => goTo(selectedIdx - 1)} disabled={selectedIdx === 0}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed">
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => goTo(selectedIdx + 1)} disabled={selectedIdx === playlist.length - 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed">
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-[600px]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-72 lg:w-80 flex-col border-r border-gray-200 flex-shrink-0">
            <CurriculumSidebar
              subjects={subjects}
              activeResId={activeResId}
              onSelectResource={onSelectResource}
              labels={lbls}
              totalResources={playlist.length}
              currentIdx={selectedIdx}
              onClose={null}
            />
          </aside>

          {/* Content */}
          <main id="structure-course-main" className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-white">
            <PlayerArea entry={current} onStartTest={onStartTest} onOpenViewer={onOpenViewer} />

            {/* Footer nav */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                {/* Prev */}
                <button
                  onClick={() => goTo(selectedIdx - 1)} disabled={!prevEntry}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 flex-1 max-w-[42%]"
                >
                  <FiChevronLeft className="w-4 h-4 flex-shrink-0" />
                  <div className="text-left min-w-0 hidden sm:block">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider leading-none">Previous</p>
                    <p className="text-sm truncate mt-0.5">
                      {prevEntry?.resource?.title || prevEntry?.resource?.testId?.title || 'Start'}
                    </p>
                  </div>
                  <span className="sm:hidden">Prev</span>
                </button>

                {/* Counter */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-700">
                    {selectedIdx + 1}
                    <span className="text-gray-300 mx-1">/</span>
                    <span className="text-gray-500">{playlist.length}</span>
                  </span>
                  <div className="flex gap-1 mt-1.5">
                    {playlist.slice(0, Math.min(playlist.length, 11)).map((_, i) => (
                      <button key={i} onClick={() => goTo(i)} title={playlist[i]?.resource?.title}
                        className={`rounded-full transition-all ${
                          i === selectedIdx
                            ? 'w-4 h-1.5 bg-primary-500'
                            : getStatus(playlist[i].resource) === 'locked'
                              ? 'w-1.5 h-1.5 bg-amber-300'
                              : 'w-1.5 h-1.5 bg-gray-300 hover:bg-primary-300'
                        }`}
                      />
                    ))}
                    {playlist.length > 11 && (
                      <span className="text-[10px] text-gray-400 ml-0.5">+{playlist.length - 11}</span>
                    )}
                  </div>
                </div>

                {/* Next */}
                <button
                  onClick={() => goTo(selectedIdx + 1)} disabled={!nextEntry}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-primary-200 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 flex-1 max-w-[42%]"
                >
                  <div className="text-right min-w-0 hidden sm:block">
                    <p className="text-[10px] uppercase text-primary-500 tracking-wider leading-none">Next</p>
                    <p className="text-sm truncate mt-0.5">
                      {nextEntry?.resource?.title || nextEntry?.resource?.testId?.title || 'End'}
                    </p>
                  </div>
                  <span className="sm:hidden">Next</span>
                  <FiChevronRight className="w-4 h-4 flex-shrink-0" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default StructureCourseView;
