// ─── SSE Client Manager ───────────────────────────────────────────────────────
// Holds one Set<res> per userId so multiple browser tabs work correctly.
// Any backend module can import { pushToUser } and push events to a specific
// user — messages, notifications, leaderboard updates, etc.
//
// Bonus role-aware bookkeeping: admin connections are tracked in a separate
// Set so we can push an `active_users` count update to admin dashboards
// whenever the connect/disconnect map changes. Pure in-memory, no DB cost.
// ─────────────────────────────────────────────────────────────────────────────

const clients      = new Map();  // Map<userId:string, Set<res>>  — all users
const adminClients = new Set();  // Set<res>                       — admin-only

// Broadcast throttle. connect/disconnect storms (e.g. server boot, page reloads
// across many users) would otherwise spam every admin dashboard with one frame
// per event. We coalesce them into one frame every COUNT_BROADCAST_INTERVAL_MS.
const COUNT_BROADCAST_INTERVAL_MS = 1500;
let   countBroadcastTimer = null;

const computeActive = () => {
  let totalConnections = 0;
  for (const set of clients.values()) totalConnections += set.size;
  return {
    users:       clients.size,    // unique logged-in users with ≥ 1 open tab
    connections: totalConnections, // total open SSE sockets (tabs/devices)
  };
};

// Send the current active count to every admin connection. Called whenever a
// client connects or disconnects (debounced).
const broadcastActiveCount = () => {
  if (countBroadcastTimer) return; // already scheduled
  countBroadcastTimer = setTimeout(() => {
    countBroadcastTimer = null;
    if (adminClients.size === 0) return; // no admins listening — skip work
    const { users, connections } = computeActive();
    const payload = `data: ${JSON.stringify({ type: 'active_users', users, connections })}\n\n`;
    for (const res of adminClients) {
      try { res.write(payload); } catch { /* connection gone */ }
    }
  }, COUNT_BROADCAST_INTERVAL_MS);
};

const addClient = (userId, res, { role } = {}) => {
  const id = userId.toString();
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(res);
  if (role === 'admin') adminClients.add(res);
  broadcastActiveCount();
};

const removeClient = (userId, res) => {
  const id = userId.toString();
  const set = clients.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(id);
  // Cheap unconditional delete — Set.delete on missing key is a no-op.
  adminClients.delete(res);
  broadcastActiveCount();
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

// Snapshot of the current active count — used by streamController to seed
// the initial 'connected' frame for admin clients (so the dashboard doesn't
// have to wait up to 1.5s for the first broadcast).
const getActiveCount = () => computeActive();

module.exports = {
  addClient, removeClient,
  pushToUser, pushToUsers, pushToAll,
  isConnected, clientCount, getActiveCount,
};
