export const PRESENTATION_STATES = Object.freeze([
  "NORMAL","PRE_ADHAN","ADHAN","IQAMAH_COUNTDOWN","IQAMAH","SALAT",
  "PRAYER_PROHIBITION","SYURUQ","ISYRAQ","IMSAK",
  "FRIDAY_PRE_ADHAN","FRIDAY_KHUTBAH","FRIDAY_SALAT"
]);

export function isScheduleActive(item, now = new Date()) {
  if (!item || typeof item !== "object") return false;
  if (item.always_show === true) return true;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const startMs = item.starts_at ? Date.parse(item.starts_at) : null;
  const endMs = item.ends_at ? Date.parse(item.ends_at) : null;
  if (startMs !== null && nowMs < startMs) return false;
  if (endMs !== null && nowMs >= endMs) return false;
  return true;
}

export function activePlaylistItems(config, now = new Date()) {
  if (!config || !Array.isArray(config.playlist_items)) return [];
  return config.playlist_items.filter((item) => isScheduleActive(item, now));
}

export function activeRunningTextItems(config, state, now = new Date()) {
  if (!config || !Array.isArray(config.running_text)) return [];
  if (!PRESENTATION_STATES.includes(state)) return [];
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  return config.running_text
    .filter((item) => {
      if (!item?.enabled) return false;
      if (!Array.isArray(item.state_scope) || !item.state_scope.includes(state)) return false;
      const startMs = item.starts_at ? Date.parse(item.starts_at) : null;
      const endMs = item.ends_at ? Date.parse(item.ends_at) : null;
      if (startMs !== null && nowMs < startMs) return false;
      if (endMs !== null && nowMs >= endMs) return false;
      return true;
    })
    .slice()
    .sort((a,b) => (b.priority-a.priority) || String(a.id).localeCompare(String(b.id)));
}

export function runningTextLine(config, state, now = new Date()) {
  return activeRunningTextItems(config, state, now)
    .map((item) => item.text)
    .filter(Boolean)
    .join(" • ");
}
