// Anonymous party RSVP counter — per-device only (no backend).
//
// This device's single vote ("yes" | "no" | null) is stored in localStorage.
// One vote per device: tapping the other option switches the answer instead
// of adding a second vote. Votes are NOT shared or aggregated anywhere.

let myChoice = null; // "yes" | "no" | null

const LS_KEY = "party-vote-navify-choice";

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

function vote(choice) {
  // Toggle off if tapping the current choice again, otherwise switch/set.
  myChoice = myChoice === choice ? null : choice;
  saveMyChoice(myChoice);
  render();
}

function render() {
  const totalEl = document.getElementById("total");
  if (!myChoice) {
    totalEl.textContent = "Tap your answer above";
  } else if (myChoice === "yes") {
    totalEl.textContent = "You're coming! 🎉";
  } else {
    totalEl.textContent = "Maybe next time.";
  }

  document.getElementById("voteYes").classList.toggle("chosen", myChoice === "yes");
  document.getElementById("voteNo").classList.toggle("chosen", myChoice === "no");
}

function init() {
  myChoice = loadMyChoice();
  document.getElementById("voteYes").onclick = () => vote("yes");
  document.getElementById("voteNo").onclick = () => vote("no");

  const note = document.getElementById("modeNote");
  if (note) {
    note.textContent =
      "One vote per device · anonymous · saved on this device only.";
  }
  render();
}

init();
