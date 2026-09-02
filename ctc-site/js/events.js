let allEvents = [];
let currentFilter = "all";
let isTeacher = false;

async function init() {
  const [{ data: sessionData }] = await Promise.all([
    supabaseClient.auth.getSession(),
    loadBranches(),
  ]);
  isTeacher = Boolean(sessionData.session);
  document.getElementById("add-event-btn").style.display = isTeacher ? "inline-flex" : "none";

  const { data: events, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    document.getElementById("events-list").innerHTML = `<div class="empty">Couldn't load events: ${escapeHtml(
      error.message
    )}</div>`;
    return;
  }

  allEvents = events || [];
  renderBranchFilter();
  renderEvents();
}

function renderBranchFilter() {
  const row = document.getElementById("events-branch-row");
  row.innerHTML = `
    <button class="class-pill ${currentFilter === "all" ? "active" : ""}" data-branch="all">All branches</button>
    ${BRANCHES.map(
      (b) =>
        `<button class="class-pill ${currentFilter === b.id ? "active" : ""}" data-branch="${b.id}">${escapeHtml(
          b.name
        )}</button>`
    ).join("")}
  `;
  row.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.branch;
      renderBranchFilter();
      renderEvents();
    });
  });
}

function renderEvents() {
  const list = document.getElementById("events-list");
  const todayStr = new Date().toISOString().slice(0, 10);

  let events = allEvents;
  if (currentFilter !== "all") {
    events = events.filter((e) => e.branch_id === currentFilter || !e.branch_id);
  }

  const upcoming = events.filter((e) => e.event_date >= todayStr);
  const past = events.filter((e) => e.event_date < todayStr).reverse();

  function eventCard(e) {
    const branch = branchById(e.branch_id);
    const daysAway = daysUntil(e.event_date);
    const mailtoLink = `mailto:?subject=${encodeURIComponent(
      "Reminder: " + e.title
    )}&body=${encodeURIComponent(
      `Reminder about an upcoming Junior Chapel event:\n\n${e.title}\n${formatEventDate(e.event_date)}${
        e.event_time ? " · " + e.event_time : ""
      }\n\n${e.description || ""}`
    )}`;
    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:600;color:var(--blue-deep);">${escapeHtml(e.title)}</div>
            <div style="font-size:13px;color:var(--blue-dark);margin-top:2px;">
              📅 ${formatEventDate(e.event_date)}${e.event_time ? " · " + escapeHtml(e.event_time) : ""}
              ${branch ? " · " + escapeHtml(branch.name) : " · All branches"}
              ${daysAway !== null ? ` · <strong>${daysAway === 0 ? "Today!" : daysAway === 1 ? "Tomorrow" : daysAway + " days away"}</strong>` : ""}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${isTeacher ? `<a class="btn btn-outline" href="${mailtoLink}" style="font-size:12px;padding:6px 10px;">✉️ Remind the team</a>` : ""}
            ${
              isTeacher
                ? `<button class="link-btn" data-delete-event="${e.id}" style="color:var(--red);">Delete</button>`
                : ""
            }
          </div>
        </div>
        ${e.description ? `<p style="margin:10px 0 0;font-size:14px;color:var(--ink);white-space:pre-wrap;">${escapeHtml(e.description)}</p>` : ""}
      </div>`;
  }

  let html = "";
  html += `<div class="eyebrow">Upcoming</div>`;
  html += upcoming.length
    ? upcoming.map(eventCard).join("")
    : `<div class="empty" style="margin-bottom:24px;">No upcoming events yet.</div>`;

  if (past.length) {
    html += `<div class="eyebrow" style="margin-top:24px;">Past Events</div>`;
    html += past.map(eventCard).join("");
  }

  list.innerHTML = html;

  list.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this event?")) return;
      await supabaseClient.from("events").delete().eq("id", btn.dataset.deleteEvent);
      allEvents = allEvents.filter((e) => e.id !== btn.dataset.deleteEvent);
      renderEvents();
    });
  });
}

init();
