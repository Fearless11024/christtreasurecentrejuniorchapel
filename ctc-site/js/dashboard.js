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
  await loadFavorites();
  setupSearch();
  await loadSuggestions();
  await loadStaffBirthdays();
}

async function loadStaffBirthdays() {
  const { data: profiles } = await supabaseClient
    .from("teacher_profiles")
    .select("nickname, birth_month, birth_day")
    .not("birth_month", "is", null);

  const container = document.getElementById("staff-birthdays");
  if (!profiles || !profiles.length) {
    container.innerHTML = `<div class="empty">No staff birthdays on file. Add yours from your Profile page.</div>`;
    return;
  }

  const today = new Date();
  const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const inWindow = profiles.filter((p) => {
    const thisYear = new Date(today.getFullYear(), p.birth_month - 1, p.birth_day);
    const diffDays = Math.floor((thisYear - stripTime(today)) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  });

  if (!inWindow.length) {
    container.innerHTML = `<div class="empty">No staff birthdays this week.</div>`;
    return;
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  container.innerHTML = `<div class="card">🎉 ${inWindow
    .map((p) => `${escapeHtml(p.nickname || "A teacher")} (${monthNames[p.birth_month - 1]} ${p.birth_day})`)
    .join(", ")}</div>`;
}

async function loadSuggestions() {
  const { data: suggestions } = await supabaseClient
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const container = document.getElementById("suggestions-list");
  if (!suggestions || !suggestions.length) {
    container.innerHTML = `<div class="empty">No suggestions yet.</div>`;
    return;
  }

  container.innerHTML = suggestions
    .map(
      (s) => `
    <div class="dash-row">
      <div>
        <div>${escapeHtml(s.content)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">
          ${escapeHtml(s.suggested_by_name || "Anonymous")} · ${formatDateTime(s.created_at)}
        </div>
      </div>
      <button class="link-btn" data-delete-sug="${s.id}" style="color:var(--red);">Dismiss</button>
    </div>`
    )
    .join("");

  container.querySelectorAll("[data-delete-sug]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("suggestions").delete().eq("id", btn.dataset.deleteSug);
      await loadSuggestions();
    });
  });
}

async function loadFavorites() {
  const { data: favs } = await supabaseClient
    .from("favorites")
    .select("id, lessons(*, classes(*))")
    .eq("teacher_id", currentUser.id)
    .order("created_at", { ascending: false });

  const container = document.getElementById("my-favorites");
  if (!favs || !favs.length) {
    container.innerHTML = `<div class="empty">No favorites yet — star a lesson from its page to save it here.</div>`;
    return;
  }

  container.innerHTML = favs
    .map((f) => {
      const l = f.lessons;
      if (!l) return "";
      const branch = branchById(l.branch_id);
      return `
      <div class="dash-row">
        <div>
          <a href="lesson.html?id=${l.id}" style="font-weight:600;color:var(--blue-deep);text-decoration:none;">
            ★ ${escapeHtml(l.title)}
          </a>
          <div style="font-size:12px;color:var(--blue-dark);">
            ${branch ? escapeHtml(branch.name) : ""} ${l.classes ? "· " + escapeHtml(l.classes.name) : ""}
          </div>
        </div>
        <button class="link-btn" data-unfav="${f.id}" style="color:var(--red);">Remove</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-unfav]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("favorites").delete().eq("id", btn.dataset.unfav);
      await loadFavorites();
    });
  });
}

function setupSearch() {
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  let timer = null;

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value.trim()), 250);
  });

  async function runSearch(term) {
    if (!term) {
      results.innerHTML = "";
      return;
    }
    const { data } = await supabaseClient
      .from("lessons")
      .select("*, classes(*)")
      .or(`title.ilike.%${term}%,description.ilike.%${term}%,scripture_reference.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || !data.length) {
      results.innerHTML = `<div class="empty">No lessons match "${escapeHtml(term)}".</div>`;
      return;
    }

    results.innerHTML = data
      .map((l) => {
        const branch = branchById(l.branch_id);
        return `
        <a href="lesson.html?id=${l.id}" class="lesson-card" style="margin-bottom:8px;">
          <div class="title-row"><span>${escapeHtml(l.title)}</span></div>
          <div class="by">${branch ? escapeHtml(branch.name) : ""} ${l.classes ? "· " + escapeHtml(l.classes.name) : ""}</div>
        </a>`;
      })
      .join("");
  }
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
