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

  await loadBranches();
  const branchSelect = document.getElementById("ev-branch");
  branchSelect.innerHTML =
    `<option value="">All branches</option>` +
    BRANCHES.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
}

const form = document.getElementById("event-form");
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";

  const title = document.getElementById("ev-title").value.trim();
  const branchId = document.getElementById("ev-branch").value || null;
  const eventDate = document.getElementById("ev-date").value;
  const eventTime = document.getElementById("ev-time").value.trim();
  const description = document.getElementById("ev-description").value.trim();

  if (!title) {
    errorEl.textContent = "Please enter a title.";
    errorEl.style.display = "block";
    return;
  }
  if (!eventDate) {
    errorEl.textContent = "Please pick a date.";
    errorEl.style.display = "block";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing...";

  const { error } = await supabaseClient.from("events").insert({
    title,
    branch_id: branchId,
    event_date: eventDate,
    event_time: eventTime || null,
    description: description || null,
    created_by: currentUser.id,
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Event";
    return;
  }

  window.location.href = "events.html";
});

init();
