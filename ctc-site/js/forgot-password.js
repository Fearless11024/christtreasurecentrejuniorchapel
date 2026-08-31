const form = document.getElementById("forgot-form");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";
  statusEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  const email = document.getElementById("email").value.trim();

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html",
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Send reset link";

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    return;
  }

  statusEl.textContent =
    "If that email has an account, a reset link has been sent. Check your inbox (and spam folder).";
  statusEl.style.display = "block";
  form.reset();
});
