function toYouTubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    let id = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/shorts/")[1];
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/embed/")[1];
    }
    if (!id) return null;
    id = id.split("&")[0].split("?")[0];
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

function publicStorageUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function toYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    let id = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/shorts/")[1];
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/embed/")[1];
    }
    if (!id) return null;
    return id.split("&")[0].split("?")[0];
  } catch {
    return null;
  }
}

function buildYouTubeEmbedUrl(videoId, { loop } = {}) {
  const params = new URLSearchParams({ rel: "0" });
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  // dateStr is a plain "YYYY-MM-DD" - parse as local, not UTC, to avoid off-by-one-day display.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function uid() {
  return crypto.randomUUID();
}
