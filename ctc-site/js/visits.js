async function logVisitOnce() {
  const todayKey = "jc-visit-logged-" + new Date().toDateString();
  if (window.localStorage.getItem(todayKey)) return;

  const { error } = await supabaseClient.from("page_visits").insert({});
  if (!error) {
    window.localStorage.setItem(todayKey, "1");
  }
}
