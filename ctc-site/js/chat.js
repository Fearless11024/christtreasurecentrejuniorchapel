let currentUser = null;
let currentUserName = "";
let currentRoom = "all";
let messageChannel = null;

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

  const { data: profile } = await supabaseClient
    .from("teacher_profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();
  currentUserName = (profile && profile.nickname) || currentUser.email.split("@")[0];

  renderRoomTabs();
  await switchRoom("all");
  subscribeToPresence();

  document.getElementById("chat-form").addEventListener("submit", sendMessage);
}

function renderRoomTabs() {
  const myBranchId = window.localStorage.getItem("jc-teacher-branch");
  const myBranch = branchById(myBranchId);

  const tabs = document.getElementById("room-tabs");
  tabs.innerHTML = `
    <button class="class-pill active" data-room="all">🌍 All Teachers</button>
    ${myBranch ? `<button class="class-pill" data-room="branch:${myBranch.id}">📍 ${escapeHtml(myBranch.name)} Only</button>` : ""}
  `;
  tabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      switchRoom(btn.dataset.room);
    });
  });
}

async function switchRoom(room) {
  currentRoom = room;

  if (messageChannel) {
    await supabaseClient.removeChannel(messageChannel);
    messageChannel = null;
  }

  await loadHistory();
  subscribeToNewMessages();
}

async function loadHistory() {
  const { data: messages, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .eq("room", currentRoom)
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
  messageChannel = supabaseClient
    .channel("chat-room-" + currentRoom)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${currentRoom}` },
      (payload) => {
        renderMessage(payload.new);
        scrollToBottom();
        notifyNewMessage(payload.new);
      }
    )
    .subscribe();
}

function notifyNewMessage(msg) {
  if (msg.sender_id === currentUser.id) return;
  if (document.visibilityState === "visible") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(msg.sender_name, { body: msg.content });
  }
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
        await channel.track({
          name: currentUserName,
          branch: window.localStorage.getItem("jc-teacher-branch") || null,
          online_at: new Date().toISOString(),
        });
      }
    });
}

function renderOnlineList(state) {
  const list = document.getElementById("online-list");
  const entries = Object.entries(state).map(([userId, arr]) => ({ userId, ...arr[0] }));

  if (!entries.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No one else is online right now.</p>`;
    return;
  }

  list.innerHTML = entries
    .map((p) => {
      const isMe = p.userId === currentUser.id;
      const branch = branchById(p.branch);
      return `
      <div class="online-row">
        <span class="online-dot"></span> ${escapeHtml(p.name)}${isMe ? " (you)" : ""}${
        branch ? ` <span style="color:var(--muted);font-size:11px;">· ${escapeHtml(branch.name)}</span>` : ""
      }
      </div>`;
    })
    .join("");
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const content = input.value.trim();
  if (!content) return;

  input.value = "";
  const { error } = await supabaseClient.from("chat_messages").insert({
    room: currentRoom,
    sender_id: currentUser.id,
    sender_name: currentUserName,
    content,
  });

  if (error) alert("Couldn't send message: " + error.message);
}

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

init();
