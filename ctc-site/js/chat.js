let currentUser = null;
let currentUserName = "";

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;
  currentUserName = currentUser.email.split("@")[0];

  await loadHistory();
  subscribeToNewMessages();
  subscribeToPresence();

  document.getElementById("chat-form").addEventListener("submit", sendMessage);
}

async function loadHistory() {
  const { data: messages, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  const container = document.getElementById("chat-messages");
  if (error) {
    container.innerHTML = `<p style="color:var(--red);font-size:13px;">Couldn't load chat: ${escapeHtml(
      error.message
    )}</p>`;
    return;
  }

  container.innerHTML = "";
  (messages || []).forEach(renderMessage);
  scrollToBottom();
}

function renderMessage(msg) {
  const container = document.getElementById("chat-messages");
  const isOwn = msg.sender_id === currentUser.id;
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${isOwn ? "own" : ""}`;
  bubble.innerHTML = `
    <span class="chat-meta">${escapeHtml(msg.sender_name)} · ${formatDateTime(msg.created_at)}</span>
    ${escapeHtml(msg.content)}`;
  container.appendChild(bubble);
}

function scrollToBottom() {
  const container = document.getElementById("chat-messages");
  container.scrollTop = container.scrollHeight;
}

function subscribeToNewMessages() {
  supabaseClient
    .channel("chat-messages-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        renderMessage(payload.new);
        scrollToBottom();
      }
    )
    .subscribe();
}

function subscribeToPresence() {
  const channel = supabaseClient.channel("teachers-online", {
    config: { presence: { key: currentUser.id } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      renderOnlineList(channel.presenceState());
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: currentUserName, online_at: new Date().toISOString() });
      }
    });
}

function renderOnlineList(state) {
  const list = document.getElementById("online-list");
  const entries = Object.values(state).map((arr) => arr[0]);

  if (!entries.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No one else is online right now.</p>`;
    return;
  }

  list.innerHTML = entries
    .map(
      (p) => `
    <div class="online-row">
      <span class="online-dot"></span>
      ${escapeHtml(p.name)}
    </div>`
    )
    .join("");
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const content = input.value.trim();
  if (!content) return;

  input.value = "";
  const { error } = await supabaseClient.from("chat_messages").insert({
    sender_id: currentUser.id,
    sender_name: currentUserName,
    content,
  });

  if (error) alert("Couldn't send message: " + error.message);
}

init();
