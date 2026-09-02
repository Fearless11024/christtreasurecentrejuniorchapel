const form = document.getElementById("suggest-form");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.style.display = "none";
  statusEl.style.display = "none";

  const name = document.getElementById("sg-name").value.trim();
  const content = document.getElementById("sg-content").value.trim();
  if (!content) {
    errorEl.textContent = "Please write your suggestion first.";
    errorEl.style.display = "block";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const { error } = await supabaseClient.from("suggestions").insert({
    suggested_by_name: name || null,
    content,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit";

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    return;
  }

  statusEl.textContent = "Thanks! Your suggestion has been sent to the teachers.";
  statusEl.style.display = "block";
  form.reset();
});
