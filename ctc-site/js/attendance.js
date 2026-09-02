let currentUser = null;
let classesCache = [];
let roster = [];
let currentClassId = null;

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  document.getElementById("att-date").value = new Date().toISOString().slice(0, 10);

  const { data: classes } = await supabaseClient.from("classes").select("*").order("sort_order");
  classesCache = classes || [];
  const classSelect = document.getElementById("att-class");
  classSelect.innerHTML = classesCache
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.age_range || "")}</option>`)
    .join("");
  currentClassId = classesCache[0]?.id ?? null;

  classSelect.addEventListener("change", () => {
    currentClassId = classSelect.value;
    loadRosterAndAttendance();
    loadTrend();
  });
  document.getElementById("att-date").addEventListener("change", loadRosterAndAttendance);

  await loadRosterAndAttendance();
  await loadTrend();

  document.getElementById("add-child-form").addEventListener("submit", addChild);
  document.getElementById("save-attendance-btn").addEventListener("click", saveAttendance);
}

async function loadRosterAndAttendance() {
  if (!currentClassId) return;

  const { data: children } = await supabaseClient
    .from("children")
    .select("*")
    .eq("class_id", currentClassId)
    .order("full_name");
  roster = children || [];

  const date = document.getElementById("att-date").value;
  const { data: records } = await supabaseClient
    .from("attendance_records")
    .select("*")
    .eq("attendance_date", date)
    .in("child_id", roster.map((c) => c.id).length ? roster.map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"]);

  const presentMap = new Map((records || []).map((r) => [r.child_id, r.present]));

  const list = document.getElementById("roster-list");
  if (!roster.length) {
    list.innerHTML = `<div class="empty">No children on this class's roster yet. Add one above.</div>`;
    return;
  }

  list.innerHTML = roster
    .map(
      (c) => `
    <div class="dash-row">
      <label style="display:flex;align-items:center;gap:10px;font-weight:400;margin-bottom:0;cursor:pointer;">
        <input type="checkbox" class="att-checkbox" data-child="${c.id}" ${
        presentMap.get(c.id) !== false ? "checked" : ""
      } />
        ${escapeHtml(c.full_name)}
      </label>
      <button class="link-btn" data-remove-child="${c.id}" style="color:var(--red);">Remove</button>
    </div>`
    )
    .join("");

  list.querySelectorAll("[data-remove-child]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this child from the roster? This also removes their attendance history.")) return;
      await supabaseClient.from("children").delete().eq("id", btn.dataset.removeChild);
      await loadRosterAndAttendance();
      await loadTrend();
    });
  });
}

async function addChild(e) {
  e.preventDefault();
  const nameInput = document.getElementById("new-child-name");
  const name = nameInput.value.trim();
  if (!name || !currentClassId) return;

  const branchId = window.localStorage.getItem("jc-teacher-branch") || null;
  await supabaseClient.from("children").insert({
    full_name: name,
    class_id: currentClassId,
    branch_id: branchId,
    created_by: currentUser.id,
  });
  nameInput.value = "";
  await loadRosterAndAttendance();
}

async function saveAttendance() {
  const date = document.getElementById("att-date").value;
  const checkboxes = document.querySelectorAll(".att-checkbox");
  const btn = document.getElementById("save-attendance-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  for (const cb of checkboxes) {
    await supabaseClient.from("attendance_records").upsert(
      {
        child_id: cb.dataset.child,
        attendance_date: date,
        present: cb.checked,
        created_by: currentUser.id,
      },
      { onConflict: "child_id,attendance_date" }
    );
  }

  btn.disabled = false;
  btn.textContent = "Save Attendance";
  await loadTrend();
  alert("Attendance saved.");
}

async function loadTrend() {
  const trendEl = document.getElementById("trend-list");
  if (!currentClassId || !roster.length) {
    trendEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">No data yet.</p>`;
    return;
  }

  const { data: records } = await supabaseClient
    .from("attendance_records")
    .select("attendance_date, present")
    .in("child_id", roster.map((c) => c.id))
    .order("attendance_date", { ascending: false })
    .limit(200);

  if (!records || !records.length) {
    trendEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">No attendance recorded yet for this class.</p>`;
    return;
  }

  const byDate = new Map();
  records.forEach((r) => {
    if (!byDate.has(r.attendance_date)) byDate.set(r.attendance_date, 0);
    if (r.present) byDate.set(r.attendance_date, byDate.get(r.attendance_date) + 1);
  });

  const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1)).slice(0, 8);

  trendEl.innerHTML = dates
    .map(
      (d) => `
    <div class="dash-row">
      <div>${formatEventDate(d)}</div>
      <div style="font-weight:600;color:var(--blue-deep);">${byDate.get(d)} present</div>
    </div>`
    )
    .join("");
}

init();
