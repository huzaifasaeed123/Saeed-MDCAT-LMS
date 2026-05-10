// In-memory cache for LeaderboardSnapshot documents and the subjects list.
// Written by leaderboardJob.js via clearAll() after each recompute.
// Read by leaderboardController.js — zero DB reads on cache hit.
//
// No TTL is needed: the job clears this cache right after it finishes writing
// fresh snapshots, so data is always as fresh as the last job run.

const snapshots    = new Map();   // key: "type:subjectTitle" → snapshot doc
let   subjectsList = null;        // cached subjects array

function snapshotKey(type, subjectTitle) {
  return `${type}:${subjectTitle || ''}`;
}

function getSnapshot(type, subjectTitle) {
  return snapshots.get(snapshotKey(type, subjectTitle)) ?? null;
}

function setSnapshot(type, subjectTitle, data) {
  snapshots.set(snapshotKey(type, subjectTitle), data);
}

function getSubjects() {
  return subjectsList;
}

function setSubjects(data) {
  subjectsList = data;
}

// Called by the job after every successful recompute so all reads get fresh data.
function clearAll() {
  snapshots.clear();
  subjectsList = null;
}

module.exports = { getSnapshot, setSnapshot, getSubjects, setSubjects, clearAll };
