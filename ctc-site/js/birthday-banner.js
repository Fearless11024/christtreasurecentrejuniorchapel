const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

async function renderBirthdayBanner() {
  const { data: birthdays } = await supabaseClient.from("birthdays").select("*");
  if (!birthdays || !birthdays.length) return;

  const today = new Date();
  const inWindow = birthdays.filter((b) => {
    // Build this year's date for the birthday and check if it falls within +/- today..7 days.
    const thisYear = new Date(today.getFullYear(), b.birth_month - 1, b.birth_day);
    const diffDays = Math.floor((thisYear - stripTime(today)) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  });

  if (!inWindow.length) return;

  const banner = document.getElementById("birthday-banner");
  const names = inWindow
    .map((b) => `${escapeHtml(b.child_name)} (${MONTH_NAMES_SHORT[b.birth_month - 1]} ${b.birth_day})`)
    .join(", ");

  banner.style.display = "block";
  banner.innerHTML = `
    <div class="card" style="background:var(--blue-soft);border-color:var(--blue-soft-border);text-align:center;margin-bottom:20px;">
      🎉 <strong>Birthdays this week:</strong> ${names}
    </div>`;
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

renderBirthdayBanner();
