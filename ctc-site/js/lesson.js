async function init() {
  const lessonId = qs("id");
  const main = document.getElementById("lesson-main");
  if (!lessonId) {
    main.innerHTML = `<p>Lesson not found.</p>`;
    return;
  }

  const [{ data: sessionData }] = await Promise.all([
    supabaseClient.auth.getSession(),
    loadBranches(),
  ]);
  const session = sessionData.session;

  const { data: lesson } = await supabaseClient
    .from("lessons")
    .select("*, classes(*), lesson_files(*)")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    main.innerHTML = `<p>Lesson not found.</p>`;
    return;
  }

  const branch = branchById(lesson.branch_id);
  const isTeacher = Boolean(session);
  const youtubeId = toYouTubeId(lesson.youtube_url);

  let videoHtml = "";
  if (youtubeId) {
    videoHtml = `
      <div class="video-embed">
        <iframe id="yt-frame" src="${buildYouTubeEmbedUrl(youtubeId, { loop: false })}" title="${escapeHtml(
      lesson.title
    )}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <div class="video-controls">
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin-bottom:0;">
          <input type="checkbox" id="yt-loop-toggle" /> Loop this video
        </label>
        <p class="field-note" style="margin:8px 0 0;">
          Use the ⚙️ settings icon in the player for playback speed and video quality.
          A cast icon appears automatically in the player if a TV is available on your network (Chrome).
        </p>
      </div>`;
  } else if (lesson.video_path) {
    const videoSrc = publicStorageUrl("lesson-videos", lesson.video_path);
    videoHtml = `
      <div class="video-embed">
        <video id="uploaded-video" controls src="${videoSrc}"></video>
      </div>
      <div class="video-controls" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin-bottom:0;">
          Speed:
          <select id="speed-select" style="width:auto;margin-bottom:0;padding:4px 8px;">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x (normal)</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;margin-bottom:0;">
          <input type="checkbox" id="video-loop-toggle" /> Loop
        </label>
        <button type="button" class="btn btn-outline" id="cast-btn" style="display:none;">📺 Cast to TV</button>
      </div>
      <p class="field-note" style="margin:-8px 0 16px;">
        Plays at the quality it was uploaded in. For adaptive quality on slower connections, use a YouTube link instead.
      </p>`;
  }

  let materialsHtml = "";
  if (lesson.lesson_files && lesson.lesson_files.length) {
    materialsHtml = `
      <div style="margin-bottom:16px;">
        <div class="eyebrow">Lesson Materials</div>
        <ul class="materials-list">
          ${lesson.lesson_files
            .map(
              (f) => `
            <li>
              <a href="${publicStorageUrl("lesson-files", f.file_path)}" target="_blank" rel="noopener noreferrer">
                📄 ${escapeHtml(f.file_name)}
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  main.innerHTML = `
    <div style="margin-bottom:16px;">
      ${branch ? `<div style="font-size:12px;color:var(--blue-dark);">${escapeHtml(branch.name)}${lesson.classes ? " · " + escapeHtml(lesson.classes.name) : ""}</div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <h1 style="color:var(--blue-deep);margin:6px 0 2px;">${escapeHtml(lesson.title)}</h1>
        ${isTeacher ? `<button id="fav-btn" class="btn btn-outline" style="flex-shrink:0;">☆ Favorite</button>` : ""}
      </div>
      ${lesson.scripture_reference ? `<p style="font-style:italic;color:var(--blue-dark);margin:0;">${escapeHtml(lesson.scripture_reference)}</p>` : ""}
      <p style="font-size:12px;color:var(--muted);margin-top:6px;">
        Uploaded by ${escapeHtml(lesson.created_by_name || "a teacher")} · ${formatDateTime(lesson.created_at)}
      </p>
    </div>
    ${videoHtml}
    ${lesson.description ? `<p style="white-space:pre-wrap;color:var(--ink);">${escapeHtml(lesson.description)}</p>` : ""}
    ${materialsHtml}
    ${isTeacher ? `<button class="btn btn-danger" id="delete-btn">Delete this lesson</button>` : ""}
  `;

  // ---------- Favorite star ----------
  const favBtn = document.getElementById("fav-btn");
  if (favBtn) {
    const { data: existing } = await supabaseClient
      .from("favorites")
      .select("id")
      .eq("teacher_id", session.user.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    let favoriteId = existing ? existing.id : null;
    if (favoriteId) favBtn.textContent = "★ Favorited";

    favBtn.addEventListener("click", async () => {
      if (favoriteId) {
        await supabaseClient.from("favorites").delete().eq("id", favoriteId);
        favoriteId = null;
        favBtn.textContent = "☆ Favorite";
      } else {
        const { data } = await supabaseClient
          .from("favorites")
          .insert({ teacher_id: session.user.id, lesson_id: lesson.id })
          .select()
          .single();
        favoriteId = data ? data.id : null;
        favBtn.textContent = "★ Favorited";
      }
    });
  }

  // ---------- YouTube loop toggle ----------
  const ytLoopToggle = document.getElementById("yt-loop-toggle");
  if (ytLoopToggle) {
    ytLoopToggle.addEventListener("change", () => {
      document.getElementById("yt-frame").src = buildYouTubeEmbedUrl(youtubeId, {
        loop: ytLoopToggle.checked,
      });
    });
  }

  // ---------- Uploaded-video controls ----------
  const videoEl = document.getElementById("uploaded-video");
  if (videoEl) {
    const speedSelect = document.getElementById("speed-select");
    speedSelect.addEventListener("change", () => {
      videoEl.playbackRate = parseFloat(speedSelect.value);
    });

    const loopToggle = document.getElementById("video-loop-toggle");
    loopToggle.addEventListener("change", () => {
      videoEl.loop = loopToggle.checked;
    });

    const castBtn = document.getElementById("cast-btn");
    if ("remote" in videoEl) {
      videoEl.remote
        .watchAvailability((available) => {
          castBtn.style.display = available ? "inline-flex" : "none";
        })
        .catch(() => {
          // Some browsers throw if remote playback isn't supported at all.
          castBtn.style.display = "none";
        });
      castBtn.addEventListener("click", async () => {
        try {
          await videoEl.remote.prompt();
        } catch (err) {
          alert("Casting isn't available right now: " + err.message);
        }
      });
    }
  }

  // ---------- Delete (any signed-in teacher, to fix mistaken uploads) ----------
  const deleteBtn = document.getElementById("delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this lesson? This can't be undone.")) return;

      if (lesson.lesson_files && lesson.lesson_files.length) {
        await supabaseClient.storage
          .from("lesson-files")
          .remove(lesson.lesson_files.map((f) => f.file_path));
      }
      if (lesson.video_path) {
        await supabaseClient.storage.from("lesson-videos").remove([lesson.video_path]);
      }
      await supabaseClient.from("lessons").delete().eq("id", lesson.id);
      window.location.href = "dashboard.html";
    });
  }
}

init();
