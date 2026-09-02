// Loaded after config.js and the Supabase CDN script on every page.
//
// "Remember me" support: if a teacher unchecks "Remember me" at login,
// we store their session in sessionStorage (cleared when the browser
// closes) instead of localStorage (kept until they sign out). This
// storage object checks that choice on every read/write.
const rememberMeStorage = {
  getItem: (key) => {
    const remember = window.localStorage.getItem("jc-remember") !== "false";
    return (remember ? window.localStorage : window.sessionStorage).getItem(key);
  },
  setItem: (key, value) => {
    const remember = window.localStorage.getItem("jc-remember") !== "false";
    (remember ? window.localStorage : window.sessionStorage).setItem(key, value);
  },
  removeItem: (key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: rememberMeStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
