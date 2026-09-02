const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

let currentUser = null;
let classesCache = [];

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  const monthSelect = document.getElementById("bd-month");
  monthSelect.innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");

  const daySelect = document.getElementById("bd-day");
  daySelect.innerHTML = Array.from({ length: 31 }, (_, i) => i + 1)
    .map((d) => `<option value="${d}">${d}</option>`)
    .join("");

  const { data: classes } = await supabaseClient.from("classes").select("*").order("sort_order");
  classesCache = classes || [];
  document.getElementById("bd-class").innerHTML =
    `<option value="">No specific class</option>` +
    classesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  await loadBirthdays();
}

async function loadBirthdays() {
  const { data: birthdays } = await supabaseClient
    .from("birthdays")
    .select("*, classes(*)")
    .order("birth_month", { ascending: true })
    .order("birth_day", { ascending: true });

  const list = document.getElementById("birthday-list");
  if (!birthdays || !birthdays.length) {
    list.innerHTML = `<div class="empty">No birthdays added yet.</div>`;
    return;
  }

  list.innerHTML = birthdays
    .map(
      (b) => `
    <div class="dash-row">
      <div>
        <strong>${escapeHtml(b.child_name)}</strong>
        <div style="font-size:12px;color:var(--blue-dark);">
          ${MONTH_NAMES[b.birth_month - 1]} ${b.birth_day} ${b.classes ? "· " + escapeHtml(b.classes.name) : ""}
        </div>
      </div>
      <button class="link-btn" data-delete="${b.id}" style="color:var(--red);">Delete</button>
    </div>`
    )
    .join("");

  list.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("birthdays").delete().eq("id", btn.dataset.delete);
      await loadBirthdays();
    });
  });
}

document.getElementById("birthday-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const childName = document.getElementById("bd-name").value.trim();
  if (!childName) return;

  const { error } = await supabaseClient.from("birthdays").insert({
    child_name: childName,
    birth_month: parseInt(document.getElementById("bd-month").value, 10),
    birth_day: parseInt(document.getElementById("bd-day").value, 10),
    class_id: document.getElementById("bd-class").value || null,
    branch_id: window.localStorage.getItem("jc-teacher-branch") || null,
    created_by: currentUser.id,
  });

  if (error) {
    alert("Couldn't add birthday: " + error.message);
    return;
  }

  document.getElementById("bd-name").value = "";
  await loadBirthdays();
});

init();
