"use strict";
/* ============ CONFIG ============ */
// Catalyst Advanced I/O function that forwards the request to QuickML (keeps your key secret).
const API_URL = "/server/concrete_proxy/predict";
const TIMEOUT_MS = 30000;
const RMSE = 4.958;

/* ============ TEAM (edit names, photos here) ============ */
const TEAM = [
  { name: "Priyanshu Kumar", roll: "2024/C/02",   img: "images/member1.jpg" },
  { name: "Gaurav Kumar",    roll: "2024/C/301",  img: "images/member2.jpg" },
  { name: "Raushan Kumar",   roll: "2024/C/16",   img: "images/member3.jpg" },
  { name: "Pankaj Kumar",    roll: "2025/CL/6023", img: "images/pankaj.jpg" }
];

/* Field keys must match the QuickML endpoint exactly (including double spaces). */
const FIELDS = [
  { id: "cement", key: "Cement (component 1)(kg in a m^3 mixture)", label: "Cement", min: 102, max: 540, mean: 281.2, unit: "kg/m³", step: 1 },
  { id: "slag",   key: "Blast Furnace Slag (component 2)(kg in a m^3 mixture)", label: "Blast furnace slag", min: 0, max: 359.4, mean: 73.9, unit: "kg/m³", step: 1 },
  { id: "fly",    key: "Fly Ash (component 3)(kg in a m^3 mixture)", label: "Fly ash", min: 0, max: 200.1, mean: 54.2, unit: "kg/m³", step: 1 },
  { id: "water",  key: "Water  (component 4)(kg in a m^3 mixture)", label: "Water", min: 121.8, max: 247, mean: 181.6, unit: "kg/m³", step: 1 },
  { id: "sp",     key: "Superplasticizer (component 5)(kg in a m^3 mixture)", label: "Superplasticizer", min: 0, max: 32.2, mean: 6.2, unit: "kg/m³", step: 0.1 },
  { id: "coarse", key: "Coarse Aggregate  (component 6)(kg in a m^3 mixture)", label: "Coarse aggregate", min: 801, max: 1145, mean: 972.9, unit: "kg/m³", step: 1 },
  { id: "fine",   key: "Fine Aggregate (component 7)(kg in a m^3 mixture)", label: "Fine aggregate", min: 594, max: 992.6, mean: 773.6, unit: "kg/m³", step: 1 },
  { id: "age",    key: "Age (day)", label: "Age", min: 1, max: 365, mean: 45.7, unit: "days", step: 1 }
];
const PRESETS = {
  demo: [194, 0, 100, 165, 9, 1000, 790, 28],
  m25:  [300, 0, 0, 180, 0, 1000, 780, 28],
  dam:  [200, 100, 80, 170, 6, 1000, 770, 90],
  clear: null
};
const GRADES = [["M40", 48.3], ["M35", 43.3], ["M30", 38.3], ["M25", 31.6]];

const $ = (s) => document.querySelector(s);
const form = $("#form"), errBox = $("#err"), btn = $("#go");
let history = [];

/* ============ BUILD UI ============ */
function buildFields() {
  $("#fields").innerHTML = FIELDS.map(f => `
    <div class="f" id="box-${f.id}">
      <label for="${f.id}">${f.label} <small>${f.unit}</small></label>
      <input type="number" id="${f.id}" inputmode="decimal" step="${f.step}" placeholder="${f.mean}" autocomplete="off">
      <input type="range" id="r-${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.mean}" aria-label="${f.label} slider">
      <p id="h-${f.id}">Dataset range ${f.min} to ${f.max}</p>
    </div>`).join("");
  FIELDS.forEach(f => {
    const n = $("#" + f.id), r = $("#r-" + f.id);
    n.addEventListener("input", () => { if (n.value !== "" && !isNaN(n.value)) r.value = n.value; check(f); live(); });
    r.addEventListener("input", () => { n.value = r.value; check(f); live(); });
  });
  $("#dt").innerHTML = FIELDS.map(f => `<tr><td>${f.label}</td><td>${f.unit}</td><td>${f.min}</td><td>${f.mean}</td><td>${f.max}</td></tr>`).join("");
  $("#team-list").innerHTML = TEAM.map(m => `
    <div class="mem"><img src="${m.img}" alt="${m.name}" loading="lazy" onerror="this.style.visibility='hidden'">
    <h4>${m.name}</h4><p>Roll No: ${m.roll}</p><span>Diploma Civil Engineering</span></div>`).join("");
}

function val(f) {
  const v = $("#" + f.id).value.trim();
  return v === "" ? NaN : Number(v);
}
function check(f) {
  const v = val(f), box = $("#box-" + f.id), h = $("#h-" + f.id);
  box.classList.remove("bad", "warn");
  h.textContent = `Dataset range ${f.min} to ${f.max}`;
  if (isNaN(v)) return;
  if (v < f.min || v > f.max) { box.classList.add("warn"); h.textContent = `Outside training range (${f.min} to ${f.max}): less reliable`; }
}
function live() {
  const g = id => { const v = val(FIELDS.find(f => f.id === id)); return isNaN(v) ? 0 : v; };
  const bind = g("cement") + g("slag") + g("fly");
  const total = bind + g("water") + g("sp") + g("coarse") + g("fine");
  const wcm = bind > 0 ? (g("water") / bind).toFixed(2) : "--";
  $("#live").innerHTML = `<span>Binder: <b>${bind.toFixed(0)}</b> kg</span><span>w/cm: <b>${wcm}</b></span><span>Total mass: <b>${total.toFixed(0)}</b> kg/m³</span>`;
}

/* ============ VALIDATION ============ */
function collect() {
  const data = {}, problems = [];
  FIELDS.forEach(f => {
    const v = val(f), box = $("#box-" + f.id);
    box.classList.remove("bad");
    const needPos = ["cement", "water", "coarse", "fine", "age"].includes(f.id);
    if (isNaN(v)) problems.push(`${f.label}: enter a number (use 0 if not used).`);
    else if (v < 0) problems.push(`${f.label}: cannot be negative.`);
    else if (needPos && v === 0) problems.push(`${f.label}: must be greater than 0.`);
    else if (f.id === "age" && v > 3650) problems.push("Age: maximum 3650 days.");
    if (problems.length && problems[problems.length - 1].startsWith(f.label)) box.classList.add("bad");
    data[f.key] = v;
  });
  return { data, problems };
}

/* ============ API ============ */
function findNumber(o, depth = 0) {
  if (typeof o === "number" && isFinite(o)) return o;
  if (typeof o === "string" && o.trim() !== "" && !isNaN(o)) return Number(o);
  if (depth > 6 || o === null || typeof o !== "object") return null;
  const pref = ["result", "prediction", "predictions", "output", "predicted_strength", "Concrete compressive strength(MPa, megapascals) "];
  for (const k of pref) if (k in o) { const r = findNumber(o[k], depth + 1); if (r !== null) return r; }
  for (const k in o) { const r = findNumber(o[k], depth + 1); if (r !== null) return r; }
  return null;
}
async function predict(data) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ data }), signal: ctrl.signal
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!res.ok) throw new Error(`Server replied ${res.status}. ${(json && (json.message || json.error)) || text.slice(0, 160)}`);
    const n = findNumber(json);
    if (n === null) throw new Error("The API answered, but no number was found in the response: " + text.slice(0, 160));
    return n;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The request timed out. Please try again.");
    if (e instanceof TypeError) throw new Error("Cannot reach the API. Check that the Catalyst function '" + API_URL + "' is deployed and you are online.");
    throw e;
  } finally { clearTimeout(t); }
}

/* ============ RESULT ============ */
function show(mpa, data) {
  const arc = $("#arc");
  arc.style.strokeDashoffset = 540 * (1 - Math.min(Math.max(mpa, 0) / 82.6, 1));
  animate($("#out"), mpa, 2);
  const lo = Math.max(mpa - RMSE, 0), hi = mpa + RMSE;
  $("#band").textContent = `${lo.toFixed(1)} to ${hi.toFixed(1)} MPa`;
  const safe = GRADES.find(g => lo >= g[1]), paper = GRADES.find(g => mpa >= g[1]);
  $("#gr").textContent = safe ? safe[0] + " (with error margin)" : (paper ? paper[0] + " on paper only" : "Below M25 target");
  const badge = $("#grade");
  badge.className = "badge" + (safe ? " ok" : "");
  badge.textContent = safe ? `Meets ${safe[0]} target` : paper ? `Borderline for ${paper[0]}` : "Low strength mix";
  const v = id => data[FIELDS.find(f => f.id === id).key];
  const bind = v("cement") + v("slag") + v("fly");
  $("#wcm").textContent = (v("water") / bind).toFixed(2);
  $("#den").textContent = (bind + v("water") + v("sp") + v("coarse") + v("fine")).toFixed(0);
  const s = 400 - v("cement");
  $("#sav").textContent = s > 0 ? `${s.toFixed(0)} kg/m³ (${(s / 4).toFixed(0)}%)` : "None";
  $("#note").textContent = "Estimate only. Typical error about ±5 MPa. Confirm with standard cube tests.";
  history.unshift({ v: FIELDS.map(f => data[f.key]), mpa });
  history = history.slice(0, 10); drawHist();
}
function animate(el, to, d) {
  const t0 = performance.now();
  (function s(now) {
    const p = Math.min((now - t0) / 900, 1);
    el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(d);
    if (p < 1) requestAnimationFrame(s);
  })(t0);
}
function drawHist() {
  $("#ht tbody").innerHTML = history.map((h, i) =>
    `<tr><td>${history.length - i}</td><td>${h.v[0]}</td><td>${h.v[1]}</td><td>${h.v[2]}</td><td>${h.v[3]}</td><td>${h.v[4]}</td><td>${h.v[7]}d</td><td><b style="color:var(--y)">${h.mpa.toFixed(2)}</b></td></tr>`).join("")
    || `<tr><td colspan="8" style="color:var(--mu)">No predictions yet.</td></tr>`;
}

/* ============ EVENTS ============ */
form.addEventListener("submit", async e => {
  e.preventDefault(); errBox.textContent = "";
  const { data, problems } = collect();
  if (problems.length) { errBox.textContent = problems.join("\n"); return; }
  btn.disabled = true; btn.classList.add("load"); btn.firstElementChild.textContent = "PREDICTING";
  try { show(await predict(data), data); }
  catch (er) { errBox.textContent = "⚠ " + er.message; }
  finally { btn.disabled = false; btn.classList.remove("load"); btn.firstElementChild.textContent = "PREDICT STRENGTH"; }
});
document.querySelectorAll(".presets button").forEach(b => b.addEventListener("click", () => {
  const p = PRESETS[b.dataset.p];
  FIELDS.forEach((f, i) => { const n = $("#" + f.id); n.value = p ? p[i] : ""; if (p) $("#r-" + f.id).value = p[i]; check(f); });
  errBox.textContent = ""; live();
}));
$("#clr").addEventListener("click", () => { history = []; drawHist(); });
document.querySelectorAll("[data-n]").forEach(el => {
  const to = +el.dataset.n, d = +(el.dataset.d || 0), t0 = performance.now();
  (function s(now) { const p = Math.min((now - t0) / 1400, 1); el.textContent = (to * p).toFixed(d); if (p < 1) requestAnimationFrame(s); })(t0);
});
buildFields(); live(); drawHist();
