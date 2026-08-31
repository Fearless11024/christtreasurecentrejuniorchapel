const MAX_VIDEO_MB = 200;
const MAX_FILE_MB = 25;

let currentUser = null;
let classesCache = [];
let selectedBranchId = null;

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  await loadBranches();
  const branchSelect = document.getElementById("branch");
  branchSelect.innerHTML = BRANCHES.map(
    (b) => `<option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.tag)})</option>`
  ).join("");

  const stored = window.localStorage.getItem("jc-teacher-branch");
  selectedBranchId = branchById(stored) ? stored : BRANCHES[0]?.id ?? null;
  branchSelect.value = selectedBranchId;
  renderBranchDisplay();

  const { data: classes } = await supabaseClient.from("classes").select("*").order("sort_order");
  classesCache = classes || [];
  document.getElementById("class").innerHTML = classesCache
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.age_range || "")}</option>`)
    .join("");
}

function renderBranchDisplay() {
  const display = document.getElementById("branch-display");
  const branch = branchById(selectedBranchId);
  display.innerHTML = `
    <span class="badge">${branch ? escapeHtml(branch.name) : "Choose a branch"}</span>
    <button type="button" class="link-btn" id="change-branch-btn">Not right? Change branch</button>`;

  document.getElementById("change-branch-btn").addEventListener("click", () => {
    const branchSelect = document.getElementById("branch");
    display.style.display = "none";
    branchSelect.style.display = "block";
    branchSelect.focus();
  });
}

document.getElementById("branch").addEventListener("change", (e) => {
  selectedBranchId = e.target.value;
  window.localStorage.setItem("jc-teacher-branch", selectedBranchId);
  document.getElementById("branch").style.display = "none";
  document.getElementById("branch-display").style.display = "flex";
  renderBranchDisplay();
});

// Toggle video input fields based on chosen mode.
document.querySelectorAll('input[name="video-mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const mode = document.querySelector('input[name="video-mode"]:checked').value;
    document.getElementById("youtube-url").style.display = mode === "youtube" ? "block" : "none";
    document.getElementById("video-file").style.display = mode === "upload" ? "block" : "none";
    document.getElementById("video-note").style.display = mode === "upload" ? "block" : "none";
  });
});

const form = document.getElementById("upload-form");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
  statusEl.style.display = "none";
}

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.style.display = "block";
  errorEl.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";
  statusEl.style.display = "none";

  const title = document.getElementById("title").value.trim();
  const branchId = selectedBranchId;
  const classId = document.getElementById("class").value;
  const scripture = document.getElementById("scripture").value.trim();
  const description = document.getElementById("description").value.trim();
  const videoMode = document.querySelector('input[name="video-mode"]:checked').value;
  const youtubeUrl = document.getElementById("youtube-url").value.trim();
  const videoFile = document.getElementById("video-file").files[0] || null;
  const attachmentFiles = Array.from(document.getElementById("attachments").files);

  if (!title) return showError("Please enter a title.");
  if (!branchId) return showError("Please choose a branch.");
  if (videoFile && videoFile.size > MAX_VIDEO_MB * 1024 * 1024) {
    return showError(`Video file must be under ${MAX_VIDEO_MB}MB.`);
  }
  for (const f of attachmentFiles) {
    if (f.size > MAX_FILE_MB * 1024 * 1024) return showError(`"${f.name}" is over ${MAX_FILE_MB}MB.`);
  }

  submitBtn.disabled = true;

  try {
    let videoPath = null;

    if (videoMode === "upload" && videoFile) {
      showStatus("Uploading video...");
      const path = `${currentUser.id}/${uid()}-${videoFile.name}`;
      const { error: upErr } = await supabaseClient.storage.from("lesson-videos").upload(path, videoFile);
      if (upErr) throw upErr;
      videoPath = path;
    }

    showStatus("Saving lesson...");
    const { data: lesson, error: insertErr } = await supabaseClient
      .from("lessons")
      .insert({
        branch_id: branchId,
        class_id: classId || null,
        title,
        description: description || null,
        scripture_reference: scripture || null,
        youtube_url: videoMode === "youtube" ? youtubeUrl || null : null,
        video_path: videoPath,
        created_by: currentUser.id,
        created_by_name: currentUser.email.split("@")[0],
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    if (attachmentFiles.length) {
      showStatus("Uploading attachments...");
      for (const file of attachmentFiles) {
        const path = `${currentUser.id}/${lesson.id}/${uid()}-${file.name}`;
        const { error: fileErr } = await supabaseClient.storage.from("lesson-files").upload(path, file);
        if (fileErr) throw fileErr;

        const { error: rowErr } = await supabaseClient
          .from("lesson_files")
          .insert({ lesson_id: lesson.id, file_path: path, file_name: file.name });
        if (rowErr) throw rowErr;
      }
    }

    window.location.href = `lesson.html?id=${lesson.id}`;
  } catch (err) {
    showError(err.message || "Something went wrong.");
    submitBtn.disabled = false;
  }
});

init();
