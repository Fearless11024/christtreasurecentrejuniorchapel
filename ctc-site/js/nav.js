async function renderHeader() {
  const header = document.getElementById("site-header");
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const rightSide = session
    ? `<div class="nav-actions">
         <span class="nav-email">${escapeHtml(session.user.email)}</span>
         <a class="btn" href="dashboard.html">Teacher Dashboard</a>
         <a class="btn" href="profile.html">👤 Profile</a>
         <a class="btn" href="chat.html">💬 Chat</a>
         <button class="btn" id="sign-out-btn">Sign out</button>
       </div>`
    : `<a class="btn btn-primary" href="login.html">Teacher Login</a>`;

  header.innerHTML = `
    <div class="inner">
      <img class="logo" src="assets/ctc-logo.png" alt="Christ Treasure Centre logo" />
      <div class="brand-text">
        <div class="name">Christ Treasure Centre</div>
        <div class="sub">Junior Chapel</div>
      </div>
      <a class="btn btn-outline" href="events.html">📅 Programme</a>
      <a class="btn btn-outline" href="suggest.html">💡 Suggest</a>
      ${rightSide}
    </div>`;

  const signOutBtn = document.getElementById("sign-out-btn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });
  }
}

renderHeader();
