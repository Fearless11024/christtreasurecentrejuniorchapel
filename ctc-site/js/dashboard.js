let currentUser = null;

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("signed-in-as").textContent = `Signed in as ${currentUser.email}`;

  await supabaseClient.from("teacher_profiles").upsert(
    { id: currentUser.id, full_name: currentUser.email.split("@")[0] },
    { onConflict: "id", ignoreDuplicates: true }
  );

  await loadBranches();
  renderBranches();
  renderTeachingBranch();
  await loadLessons();
  await loadClasses();
  await loadVisitCounts();
}

async function loadVisitCounts() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ count: todayCount }, { count: totalCount }] = await Promise.all([
    supabaseClient
      .from("page_visits")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString()),
    supabaseClient.from("page_visits").select("*", { count: "exact", head: true }),
  ]);

  document.getElementById("visits-today").textContent = todayCount ?? "-";
  document.getElementById("visits-total").textContent = totalCount ?? "-";
}

function renderTeachingBranch() {
  const line = document.getElementById("teaching-branch-line");
  const currentId = window.localStorage.getItem("jc-teacher-branch");
  const current = branchById(currentId);

  line.innerHTML = `
    Uploading for:
    <strong>${current ? escapeHtml(current.name) : "no branch chosen yet"}</strong>
    <select id="teaching-branch-select" style="display:inline-block;width:auto;margin:0 0 0 8px;padding:4px 8px;">
      ${BRANCHES.map(
        (b) =>
          `<option value="${b.id}" ${b.id === currentId ? "selected" : ""}>${escapeHtml(b.name)}</option>`
      ).join("")}
    </select>`;

  document.getElementById("teaching-branch-select").addEventListener("change", (e) => {
    window.localStorage.setItem("jc-teacher-branch", e.target.value);
    renderTeachingBranch();
  });
}

async function loadLessons() {
  const { data: lessons } = await supabaseClient
    .from("lessons")
    .select("*, classes(*)")
    .eq("created_by", currentUser.id)
    .order("created_at", { ascending: false });

  const container = document.getElementById("my-lessons");
  if (!lessons || !lessons.length) {
    container.innerHTML = `<div class="empty">You haven't uploaded any lessons yet.</div>`;
    return;
  }

  container.innerHTML = lessons
    .map((l) => {
      const branch = branchById(l.branch_id);
      return `
      <div class="dash-row">
        <div>
          <a href="lesson.html?id=${l.id}" style="font-weight:600;color:var(--blue-deep);text-decoration:none;">
            ${escapeHtml(l.title)}
          </a>
          <div style="font-size:12px;color:var(--blue-dark);">
            ${branch ? escapeHtml(branch.name) : ""} ${l.classes ? "· " + escapeHtml(l.classes.name) : ""}
            · ${formatDateTime(l.created_at)}
          </div>
        </div>
        <button class="link-btn" data-delete="${l.id}" style="color:var(--red);">Delete</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteLesson(btn.dataset.delete));
  });
}

async function deleteLesson(lessonId) {
  if (!confirm("Delete this lesson? This can't be undone.")) return;

  const { data: files } = await supabaseClient
    .from("lesson_files")
    .select("file_path")
    .eq("lesson_id", lessonId);
  if (files && files.length) {
    await supabaseClient.storage.from("lesson-files").remove(files.map((f) => f.file_path));
  }

  const { data: lesson } = await supabaseClient
    .from("lessons")
    .select("video_path")
    .eq("id", lessonId)
    .single();
  if (lesson && lesson.video_path) {
    await supabaseClient.storage.from("lesson-videos").remove([lesson.video_path]);
  }

  await supabaseClient.from("lessons").delete().eq("id", lessonId);
  await loadLessons();
}

async function loadClasses() {
  const { data: classes } = await supabaseClient.from("classes").select("*").order("sort_order");
  const row = document.getElementById("classes-row");
  row.innerHTML = (classes || [])
    .map(
      (c) => `<span class="class-pill" style="cursor:default;">${escapeHtml(c.name)} · ${escapeHtml(c.age_range || "")}</span>`
    )
    .join("");
}

function renderBranches() {
  const row = document.getElementById("branches-row");
  row.innerHTML = BRANCHES.map(
    (b) => `<span class="class-pill" style="cursor:default;">📍 ${escapeHtml(b.name)} — ${escapeHtml(b.tag)}, ${escapeHtml(b.place || "")}</span>`
  ).join("");
}

document.getElementById("add-class-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("new-class-name").value.trim();
  const ageRange = document.getElementById("new-class-age").value.trim();
  if (!name) return;

  await supabaseClient.from("classes").insert({ name, age_range: ageRange || null });
  document.getElementById("new-class-name").value = "";
  document.getElementById("new-class-age").value = "";
  await loadClasses();
});

document.getElementById("add-branch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("new-branch-name").value.trim();
  const tag = document.getElementById("new-branch-tag").value;
  const place = document.getElementById("new-branch-place").value.trim();
  if (!name) return;

  const id = uniqueBranchId(name);
  const sortOrder = BRANCHES.length ? Math.max(...BRANCHES.map((b) => b.sort_order || 0)) + 1 : 1;

  const { error } = await supabaseClient
    .from("branches")
    .insert({ id, name, tag, place: place || null, sort_order: sortOrder });

  if (error) {
    alert("Couldn't add branch: " + error.message);
    return;
  }

  document.getElementById("new-branch-name").value = "";
  document.getElementById("new-branch-place").value = "";
  await loadBranches();
  renderBranches();
});

init();
