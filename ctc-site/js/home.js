let allClasses = [];
let allLessons = [];
let isTeacher = false;
let currentBranchId = null;

function classStorageKey(branchId) {
  return `jc-class-${branchId}`;
}

async function init() {
  const [{ data: sessionData }] = await Promise.all([
    supabaseClient.auth.getSession(),
    loadBranches(),
  ]);
  isTeacher = Boolean(sessionData.session);

  // A logged-in teacher skips the visitor/teacher question entirely.
  if (isTeacher) {
    window.localStorage.setItem("jc-role", "teacher");
    await showMainContent();
    return;
  }

  const forcedRole = qs("role"); // e.g. index.html?role=visitor from the login page's "continue as visitor" link
  if (forcedRole === "visitor") window.localStorage.setItem("jc-role", "visitor");

  const storedRole = window.localStorage.getItem("jc-role");

  if (storedRole === "teacher") {
    window.location.href = "login.html";
    return;
  }

  if (storedRole === "visitor") {
    await showMainContent();
    return;
  }

  // No choice remembered yet - ask.
  document.getElementById("role-gate").style.display = "block";
  document.getElementById("role-visitor-btn").addEventListener("click", async () => {
    window.localStorage.setItem("jc-role", "visitor");
    document.getElementById("role-gate").style.display = "none";
    await showMainContent();
  });
  document.getElementById("role-teacher-btn").addEventListener("click", () => {
    window.localStorage.setItem("jc-role", "teacher");
    window.location.href = "login.html";
  });
}

async function showMainContent() {
  document.getElementById("role-gate").style.display = "none";
  document.getElementById("visitor-content").style.display = "block";

  if (!isTeacher) {
    document.getElementById("not-visitor-line").innerHTML =
      `Are you a teacher? <a href="login.html" id="switch-to-teacher">Log in here</a>.`;
    logVisitOnce();
  }

  const [{ data: classes }, { data: lessons }] = await Promise.all([
    supabaseClient.from("classes").select("*").order("sort_order"),
    supabaseClient
      .from("lessons")
      .select("*, classes(*)")
      .order("created_at", { ascending: false }),
  ]);
  allClasses = classes || [];
  allLessons = lessons || [];
  currentBranchId = BRANCHES[0]?.id ?? null;

  renderBranches();
  renderClassSection();
}

function renderBranches() {
  const row = document.getElementById("branch-row");
  if (!BRANCHES.length) {
    row.innerHTML = `<p style="color:var(--muted);font-size:13px;">No branches yet.</p>`;
    return;
  }
  row.innerHTML = BRANCHES.map(
    (b) => `
    <button class="branch-pill ${b.id === currentBranchId ? "active" : ""}" data-branch="${b.id}">
      <span class="b-name">📍 ${escapeHtml(b.name)}</span>
      <span class="b-sub">${escapeHtml(b.tag)} · ${escapeHtml(b.place || "")}</span>
    </button>`
  ).join("");

  row.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentBranchId = btn.dataset.branch;
      renderBranches();
      renderClassSection();
    });
  });
}

function getSelectedClassId() {
  if (isTeacher) return window.__teacherClassId ?? null;
  return window.localStorage.getItem(classStorageKey(currentBranchId));
}

function setSelectedClassId(id) {
  if (isTeacher) {
    window.__teacherClassId = id;
  } else if (id) {
    window.localStorage.setItem(classStorageKey(currentBranchId), id);
  } else {
    window.localStorage.removeItem(classStorageKey(currentBranchId));
  }
}

function renderClassSection() {
  const section = document.getElementById("class-section");
  const eyebrow = document.getElementById("class-eyebrow");
  const picker = document.getElementById("class-picker");
  const branch = branchById(currentBranchId);
  section.style.display = "block";
  eyebrow.textContent = branch ? `Classes at ${branch.name}` : "Classes";

  const selectedClassId = getSelectedClassId();

  if (isTeacher) {
    picker.innerHTML = `
      <div class="pill-row">
        <button class="class-pill ${selectedClassId === null ? "active" : ""}" data-class="">All classes</button>
        ${allClasses
          .map(
            (c) => `
          <button class="class-pill ${selectedClassId === c.id ? "active" : ""}" data-class="${c.id}">
            ${escapeHtml(c.name)} <span style="opacity:.75;">· ${escapeHtml(c.age_range || "")}</span>
          </button>`
          )
          .join("")}
      </div>`;
    picker.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        setSelectedClassId(btn.dataset.class || null);
        renderClassSection();
        renderLessons();
      });
    });
  } else if (selectedClassId) {
    const c = allClasses.find((x) => x.id === selectedClassId);
    picker.innerHTML = `
      <div class="viewing-bar">
        <span class="badge">Viewing: ${escapeHtml(c ? c.name : "")} ${c ? `· ${escapeHtml(c.age_range || "")}` : ""}</span>
        <button class="link-btn" id="switch-class-btn">Not your class? Switch</button>
      </div>`;
    document.getElementById("switch-class-btn").addEventListener("click", () => {
      setSelectedClassId(null);
      renderClassSection();
      renderLessons();
    });
  } else {
    picker.innerHTML = `
      <p style="color:var(--ink-soft);font-size:14px;margin:0 0 12px;">
        Which class are you in? Lessons are shown for your own age group.
      </p>
      <div class="pill-row">
        ${allClasses
          .map(
            (c) => `
          <button class="class-pill" data-class="${c.id}">
            ${escapeHtml(c.name)} <span style="opacity:.75;">· ${escapeHtml(c.age_range || "")}</span>
          </button>`
          )
          .join("")}
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:10px;">
        Not sure which class you're in? Ask your teacher.
      </p>`;
    picker.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        setSelectedClassId(btn.dataset.class);
        renderClassSection();
        renderLessons();
      });
    });
  }

  renderLessons();
}

function renderLessons() {
  const lessonsSection = document.getElementById("lessons-section");
  const grid = document.getElementById("lessons-grid");
  const uploadBtn = document.getElementById("upload-btn");
  const selectedClassId = getSelectedClassId();

  const canSeeLessons = isTeacher || Boolean(selectedClassId);
  lessonsSection.style.display = canSeeLessons ? "block" : "none";
  uploadBtn.style.display = isTeacher ? "inline-flex" : "none";
  if (!canSeeLessons) return;

  let list = allLessons.filter((l) => l.branch_id === currentBranchId);
  if (selectedClassId) list = list.filter((l) => l.class_id === selectedClassId);

  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">No lessons here yet.</div>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (l) => `
    <a class="lesson-card" href="lesson.html?id=${l.id}">
      <div class="title-row">
        <span>${escapeHtml(l.title)}</span>
        ${l.youtube_url || l.video_path ? "🎬" : ""}
      </div>
      ${l.scripture_reference ? `<div class="scripture">${escapeHtml(l.scripture_reference)}</div>` : ""}
      ${l.description ? `<div class="desc">${escapeHtml(l.description)}</div>` : ""}
      <div class="by">By ${escapeHtml(l.created_by_name || "a teacher")} · ${formatDateShort(l.created_at)}</div>
    </a>`
    )
    .join("");
}

init();
