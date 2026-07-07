let participants = [];
let votes = {};
let activeTeam = "all";
let query = "";

// When no backend is available (e.g. GitHub Pages static hosting), fall back
// to per-device storage. Votes are then local to each browser, not shared.
let backendAvailable = true;
const LS_KEY = "party-vote-navify";

function loadLocalVotes() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveLocalVotes() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(votes));
  } catch {}
}

// Festive avatar palette
const AVATAR_COLORS = [
  "#7c3aed", "#ec4899", "#f59e0b", "#0b8a3d", "#0e7490",
  "#c2410c", "#be123c", "#2563eb", "#9333ea", "#0d9488",
];

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

async function load() {
  const pRes = await fetch("participants.json");
  participants = await pRes.json();
  try {
    const vRes = await fetch("/api/votes");
    if (!vRes.ok) throw new Error("no backend");
    votes = await vRes.json();
    backendAvailable = true;
  } catch {
    backendAvailable = false;
    votes = loadLocalVotes();
  }
  updateModeNote();
  buildFilters();
  render();
}

function updateModeNote() {
  const note = document.getElementById("modeNote");
  if (!note) return;
  if (backendAvailable) {
    note.textContent =
      "Your vote is saved automatically and shared with everyone. You can change it anytime.";
  } else {
    note.textContent =
      "This is a static preview: your vote is saved on this device only and is not shared. You can change it anytime.";
  }
}

function buildFilters() {
  const teams = [...new Set(participants.map((p) => p.team))].sort((a, b) =>
    a.localeCompare(b)
  );
  const box = document.getElementById("filters");
  const mk = (id, label) => {
    const b = document.createElement("button");
    b.className = "chip" + (activeTeam === id ? " active" : "");
    b.textContent = label;
    b.onclick = () => {
      activeTeam = id;
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
      render();
    };
    return b;
  };
  box.appendChild(mk("all", "All"));
  teams.forEach((t) => box.appendChild(mk(t, t)));
}

function updateCounters() {
  let yes = 0, no = 0;
  participants.forEach((p) => {
    if (votes[p.id] === "yes") yes++;
    else if (votes[p.id] === "no") no++;
  });
  document.getElementById("countYes").textContent = yes;
  document.getElementById("countNo").textContent = no;
  document.getElementById("countPending").textContent =
    participants.length - yes - no;
}

async function castVote(id, choice) {
  const current = votes[id] || null;
  const next = current === choice ? null : choice; // toggle off if same
  // optimistic update
  if (next === null) delete votes[id];
  else votes[id] = next;
  render();

  if (!backendAvailable) {
    saveLocalVotes();
    return;
  }
  try {
    await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, choice: next }),
    });
  } catch (e) {
    // reload from server on failure
    try {
      const vRes = await fetch("/api/votes");
      votes = await vRes.json();
      render();
    } catch {}
  }
}

function personCard(p) {
  const vote = votes[p.id];
  const el = document.createElement("div");
  el.className = "person" + (vote ? " voted-" + vote : "");

  const av = document.createElement("div");
  av.className = "avatar";
  av.style.background = colorFor(p.name);
  av.textContent = initials(p.name);

  const info = document.createElement("div");
  info.className = "person-info";
  info.innerHTML = `<div class="person-name"></div><div class="person-team"></div>`;
  info.querySelector(".person-name").textContent = p.name;
  info.querySelector(".person-team").textContent = p.team;

  const actions = document.createElement("div");
  actions.className = "actions";
  const yesBtn = document.createElement("button");
  yesBtn.className = "btn yes" + (vote === "yes" ? " active" : "");
  yesBtn.textContent = "✓ Yes";
  yesBtn.onclick = () => castVote(p.id, "yes");
  const noBtn = document.createElement("button");
  noBtn.className = "btn no" + (vote === "no" ? " active" : "");
  noBtn.textContent = "✕ No";
  noBtn.onclick = () => castVote(p.id, "no");
  actions.append(yesBtn, noBtn);

  el.append(av, info, actions);
  return el;
}

function render() {
  updateCounters();
  const container = document.getElementById("teams");
  container.innerHTML = "";

  const q = query.trim().toLowerCase();
  let filtered = participants.filter((p) => {
    const matchTeam = activeTeam === "all" || p.team === activeTeam;
    const matchQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q);
    return matchTeam && matchQuery;
  });

  document.getElementById("empty").hidden = filtered.length > 0;

  // group by team
  const groups = {};
  filtered.forEach((p) => {
    (groups[p.team] ||= []).push(p);
  });
  const teamNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  teamNames.forEach((team) => {
    const group = document.createElement("div");
    group.className = "team-group";
    const title = document.createElement("div");
    title.className = "team-title";
    title.innerHTML = `${team}<span class="badge">${groups[team].length}</span>`;
    group.appendChild(title);
    groups[team]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => group.appendChild(personCard(p)));
    container.appendChild(group);
  });
}

document.getElementById("search").addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

// periodic refresh so everyone sees live results (backend mode only)
setInterval(async () => {
  if (!backendAvailable) return;
  try {
    const vRes = await fetch("/api/votes");
    if (!vRes.ok) return;
    votes = await vRes.json();
    render();
  } catch {}
}, 5000);

load();
