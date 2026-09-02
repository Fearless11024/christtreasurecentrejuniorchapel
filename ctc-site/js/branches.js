let BRANCHES = [];
let branchesLoadError = null;

async function loadBranches() {
  const { data, error } = await supabaseClient.from("branches").select("*").order("sort_order");
  branchesLoadError = error || null;
  if (error) {
    console.error("Could not load branches:", error.message);
  }
  BRANCHES = data || [];
  return BRANCHES;
}

function branchById(id) {
  return BRANCHES.find((b) => b.id === id) || null;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Returns a branch id that doesn't collide with any already loaded.
function uniqueBranchId(name) {
  const base = slugify(name) || "branch";
  let candidate = base;
  let n = 2;
  while (BRANCHES.some((b) => b.id === candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
