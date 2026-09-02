const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  document.getElementById("email-display").value = currentUser.email;

  document.getElementById("birth-month").innerHTML =
    `<option value="">--</option>` + MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  document.getElementById("birth-day").innerHTML =
    `<option value="">--</option>` +
    Array.from({ length: 31 }, (_, i) => i + 1).map((d) => `<option value="${d}">${d}</option>`).join("");

  const { data: profile } = await supabaseClient
    .from("teacher_profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile) {
    document.getElementById("nickname").value = profile.nickname || "";
    if (profile.birth_month) document.getElementById("birth-month").value = profile.birth_month;
    if (profile.birth_day) document.getElementById("birth-day").value = profile.birth_day;
  }
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("error");
  const statusEl = document.getElementById("status");
  errorEl.style.display = "none";
  statusEl.style.display = "none";

  const nickname = document.getElementById("nickname").value.trim();
  const birthMonth = document.getElementById("birth-month").value || null;
  const birthDay = document.getElementById("birth-day").value || null;

  const { error } = await supabaseClient.from("teacher_profiles").upsert({
    id: currentUser.id,
    full_name: currentUser.email.split("@")[0],
    nickname: nickname || null,
    birth_month: birthMonth ? parseInt(birthMonth, 10) : null,
    birth_day: birthDay ? parseInt(birthDay, 10) : null,
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = "block";
    return;
  }

  statusEl.textContent = "Profile saved!";
  statusEl.style.display = "block";
});

init();
