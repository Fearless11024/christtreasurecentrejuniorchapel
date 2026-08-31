document.getElementById("signup-note").textContent = TEACHER_SIGNUP_NOTE;

const toggleBtn = document.getElementById("toggle-password");
const passwordInput = document.getElementById("password");
toggleBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleBtn.textContent = isHidden ? "🙈" : "👁️";
  toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
});

const form = document.getElementById("login-form");
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit-btn");
const branchSelect = document.getElementById("branch");

async function populateBranches() {
  await loadBranches();

  if (branchesLoadError || !BRANCHES.length) {
    branchSelect.innerHTML = `<option value="">No branches found</option>`;
    branchSelect.disabled = true;
    errorEl.textContent = branchesLoadError
      ? "Couldn't load branches from the database (" + branchesLoadError.message + "). See the \"schema cache\" section of the README."
      : "No branches are set up yet. Ask your admin to add one, or check the database setup.";
    errorEl.style.display = "block";
    submitBtn.disabled = true;
    return;
  }

  branchSelect.innerHTML = BRANCHES.map(
    (b) => `<option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.tag)}) — ${escapeHtml(b.place || "")}</option>`
  ).join("");
}
populateBranches();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const branchId = branchSelect.value;
  const remember = document.getElementById("remember-me").checked;

  // Must be set before signing in so the session gets written to the
  // right storage (localStorage vs sessionStorage).
  window.localStorage.setItem("jc-remember", remember ? "true" : "false");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
    return;
  }

  // Remember which branch this teacher uploads for.
  window.localStorage.setItem("jc-teacher-branch", branchId);
  window.localStorage.setItem("jc-role", "teacher");

  window.location.href = "dashboard.html";
});
