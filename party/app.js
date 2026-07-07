// Anonymous party RSVP counter with one vote per device.
//
// This device's current choice ("yes" | "no" | null) is remembered in
// localStorage, so a device only ever holds ONE vote. Changing the choice
// moves the vote (decrement old, increment new) rather than adding another.
//
// Shared totals live in Firebase Realtime Database when configured (live,
// cross-device). Without Firebase keys the page shows this device's vote only
// (per-device counter) so it still works on plain static hosting.

let mode = "local"; // "firebase" | "local"
let myChoice = null; // "yes" | "no" | null
let counts = { yes: 0, no: 0 };

const LS_KEY = "party-vote-navify-choice";

// Firebase handles (set when configured)
let fbDb = null;
let fbRefs = null; // { yes, no }
let fbRunTransaction = null;
let fbRef = null;

function loadMyChoice() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}
function saveMyChoice(v) {
  try {
    if (v === null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, v);
  } catch {}
}

function firebaseConfigured() {
  const c = window.FIREBASE_CONFIG;
  if (!c) return false;
  return !Object.values(c).some(
    (v) => typeof v === "string" && v.includes("PASTE_")
  );
}

async function initFirebase() {
  const [{ initializeApp }, dbMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"),
  ]);
  const { getDatabase, ref, onValue, runTransaction } = dbMod;
  const appFb = initializeApp(window.FIREBASE_CONFIG);
  fbDb = getDatabase(appFb);
  fbRef = ref;
  fbRunTransaction = runTransaction;
  fbRefs = {
    yes: ref(fbDb, "counts/yes"),
    no: ref(fbDb, "counts/no"),
  };
  // Live subscription to the aggregate counts.
  onValue(ref(fbDb, "counts"), (snap) => {
    const val = snap.val() || {};
    counts = { yes: val.yes || 0, no: val.no || 0 };
    render();
  });
  mode = "firebase";
}

async function bump(choiceKey, delta) {
  if (mode !== "firebase") return;
  await fbRunTransaction(fbRefs[choiceKey], (cur) => {
    const n = (cur || 0) + delta;
    return n < 0 ? 0 : n;
  });
}

async function vote(choice) {
  if (myChoice === choice) return; // already this choice, nothing to do

  const prev = myChoice;
  myChoice = choice;
  saveMyChoice(choice);

  if (mode === "firebase") {
    // Move the single device vote: remove old, add new.
    if (prev) await bump(prev, -1);
    await bump(choice, +1);
    // render happens via the live onValue subscription
  } else {
    // Local mode: counts only reflect this device's single vote.
    counts = { yes: 0, no: 0 };
    counts[choice] = 1;
    render();
  }
}

function render() {
  document.getElementById("countYes").textContent = counts.yes;
  document.getElementById("countNo").textContent = counts.no;

  const total = counts.yes + counts.no;
  const pctYes = total ? Math.round((counts.yes / total) * 100) : 0;
  document.getElementById("barYes").style.width = pctYes + "%";

  const totalEl = document.getElementById("total");
  if (total === 0) {
    totalEl.textContent = "No votes yet — be the first!";
  } else {
    totalEl.textContent = `${total} vote${total === 1 ? "" : "s"} · ${pctYes}% coming`;
  }

  const yesBtn = document.getElementById("voteYes");
  const noBtn = document.getElementById("voteNo");
  yesBtn.classList.toggle("chosen", myChoice === "yes");
  noBtn.classList.toggle("chosen", myChoice === "no");
}

function updateModeNote() {
  const note = document.getElementById("modeNote");
  if (!note) return;
  if (mode === "firebase") {
    note.textContent =
      "One vote per device · anonymous · shared live count. You can switch your answer anytime.";
  } else {
    note.textContent =
      "One vote per device · anonymous. Shared live totals aren't configured yet, so this shows your own vote only.";
  }
}

async function init() {
  myChoice = loadMyChoice();

  if (firebaseConfigured()) {
    try {
      await initFirebase();
    } catch (e) {
      console.warn("Firebase init failed, using local mode", e);
    }
  }

  if (mode === "local") {
    // Reflect this device's stored vote in the local counter.
    counts = { yes: 0, no: 0 };
    if (myChoice) counts[myChoice] = 1;
  }

  document.getElementById("voteYes").onclick = () => vote("yes");
  document.getElementById("voteNo").onclick = () => vote("no");

  updateModeNote();
  render();
}

init();
