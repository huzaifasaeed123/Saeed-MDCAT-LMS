// In-memory access token store.
// Module-level variable survives re-renders but is wiped on page reload —
// that is intentional: reload triggers silentRefresh() in AuthContext.
let _accessToken = null;

export const getAccessToken  = ()      => _accessToken;
export const setAccessToken  = (token) => { _accessToken = token; };
export const clearAccessToken = ()     => { _accessToken = null; };
