async function guardTeacher() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) window.location.href = "login.html";
}
guardTeacher();

document.getElementById("cert-date").value = new Date().toISOString().slice(0, 10);

document.getElementById("cert-type").addEventListener("change", (e) => {
  document.getElementById("custom-type-wrap").style.display = e.target.value === "custom" ? "block" : "none";
});

document.getElementById("generate-btn").addEventListener("click", () => {
  const name = document.getElementById("cert-name").value.trim();
  if (!name) {
    alert("Please enter the child's name.");
    return;
  }
  const typeSelect = document.getElementById("cert-type");
  const achievement =
    typeSelect.value === "custom"
      ? document.getElementById("cert-custom").value.trim() || "Outstanding Achievement"
      : typeSelect.value;
  const dateStr = document.getElementById("cert-date").value;

  document.getElementById("cert-name-display").textContent = name;
  document.getElementById("cert-type-display").textContent = achievement;
  document.getElementById("cert-date-display").textContent = dateStr ? formatEventDate(dateStr) : "";

  document.getElementById("certificate").style.display = "block";
  document.getElementById("print-btn").style.display = "inline-flex";
  document.getElementById("certificate").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("print-btn").addEventListener("click", () => {
  window.print();
});
