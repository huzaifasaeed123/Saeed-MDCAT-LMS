// ─── SSE Client Manager ───────────────────────────────────────────────────────
// Holds one Set<res> per userId so multiple browser tabs work correctly.
// Any backend module can import { pushToUser } and push events to a specific
// user — messages, notifications, leaderboard updates, etc.
// ─────────────────────────────────────────────────────────────────────────────

const clients = new Map(); // Map<userId:string, Set<res>>

const addClient = (userId, res) => {
  const id = userId.toString();
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(res);
};

const removeClient = (userId, res) => {
  const id = userId.toString();
  const set = clients.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(id);
};

// Push an event to every open tab/device for one user.
// Returns true if at least one connection was found.
const pushToUser = (userId, type, data = {}) => {
  const set = clients.get(userId.toString());
  if (!set || set.size === 0) return false;
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* connection already closed */ }
  }
  return true;
};

// Push to many users at once (broadcast, notifications, etc.)
const pushToUsers = (userIds, type, data = {}) => {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const userId of userIds) {
    const set = clients.get(userId.toString());
    if (!set) continue;
    for (const res of set) {
      try { res.write(payload); } catch {}
    }
  }
};

// Push to every connected user (leaderboard updates, system-wide events)
const pushToAll = (type, data = {}) => {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const [, set] of clients) {
    for (const res of set) {
      try { res.write(payload); } catch {}
    }
  }
};

const isConnected  = (userId)  => (clients.get(userId.toString())?.size ?? 0) > 0;
const clientCount  = ()        => clients.size; // unique users connected

module.exports = { addClient, removeClient, pushToUser, pushToUsers, pushToAll, isConnected, clientCount };
