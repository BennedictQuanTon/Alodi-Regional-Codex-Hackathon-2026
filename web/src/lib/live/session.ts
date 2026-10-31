/** A session link scopes every API call to that session's own backend through the gateway. */
export function liveSessionId(search: string) {
  const id = new URLSearchParams(search).get("session");
  return id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : undefined;
}
export function liveApiBase(location: { origin: string; search: string }) {
  const id = liveSessionId(location.search);
  return id ? `${location.origin}/api/s/${id}` : `${location.origin}/api`;
}
