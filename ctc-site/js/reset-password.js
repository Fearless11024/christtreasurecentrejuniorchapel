const introText = document.getElementById("intro-text");
const form = document.getElementById("reset-form");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

const toggleBtn = document.getElementById("toggle-password");
const passwordInput = document.getElementById("password");
toggleBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleBtn.textContent = isHidden ? "🙈" : "👁️";
});

let recoveryReady = false;

// Supabase reads the recovery token from the URL automatically and fires
// this event once it's set up a temporary session for changing the password.
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryReady = true;
    introText.textContent = "Enter a new password for your account below.";
    form.style.display = "block";
  }
});

// If the link is invalid/expired, nothing will fire - let the visitor know after a moment.
setTimeout(() => {
  if (!recoveryReady) {
    introText.textContent =
      "This reset link is invalid or has expired. Please request a new one.";
    introText.innerHTML += ' <a href="forgot-password.html">Request a new link</a>.';
  }
}, 3000);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";
  statusEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  const { error } = await supabaseClient.auth.updateUser({
    password: passwordInput.value,
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Set new password";
    return;
  }

  statusEl.textContent = "Password updated! Taking you to your dashboard...";
  statusEl.style.display = "block";
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1500);
});
