(() => {
"use strict";

const DB_KEY = "aquarius_equipment_manager_v03";
const SESSION_KEY = "aquarius_session_v03";
const $ = id => document.getElementById(id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random());
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => new Date().toISOString().slice(0,10);
const dateDE = value => value ? new Date(value+"T12:00:00").toLocaleDateString("de-DE") : "–";

const itemDefinitions = [
  {key:"Flasche", icon:"🧯", variants:["10 l Stahl","12 l Stahl","15 l Stahl","10 l Alu","12 l Alu"]},
  {key:"Jacket", icon:"🦺", variants:["XS","S","M","L","XL"]},
  {key:"Atemregler", icon:"🫁", variants:["Standard"]},
  {key:"Blei", icon:"⚖️", variants:["1 kg","2 kg"]},
  {key:"Maske", icon:"🥽", variants:["Standard"]},
  {key:"Flossen", icon:"🦶", variants:["36–37","38–39","40–41","42–43","44–45","46–47"]},
  {key:"Schnorchel", icon:"🤿", variants:["Standard"]},
  {key:"Lampe", icon:"🔦", variants:["Standard"]},
  {key:"Tauchcomputer", icon:"⌚", variants:["Standard"]}
];

const seed = () => {
  const maxId = uid(), annaId = uid();
  return {
    members:[
      {id:maxId,name:"Max Mustermann",email:"max@example.de",group:"Mitglied",status:"Aktiv"},
      {id:annaId,name:"Anna Beispiel",email:"anna@example.de",group:"Jugend",status:"Aktiv"}
    ],
    inventory:[
      {id:uid(),number:"F-001",category:"Flasche",name:"Scubapro",variant:"12 l Stahl",status:"Verfügbar"},
      {id:uid(),number:"F-002",category:"Flasche",name:"Scubapro",variant:"12 l Stahl",status:"Verfügbar"},
      {id:uid(),number:"F-003",category:"Flasche",name:"Mares",variant:"15 l Stahl",status:"Wartung"},
      {id:uid(),number:"J-001",category:"Jacket",name:"Mares",variant:"L",status:"Verfügbar"},
      {id:uid(),number:"J-002",category:"Jacket",name:"Scubapro",variant:"M",status:"Verfügbar"},
      {id:uid(),number:"AR-001",category:"Atemregler",name:"Apeks",variant:"Standard",status:"Verfügbar"},
      {id:uid(),number:"FL-001",category:"Flossen",name:"Mares",variant:"42–43",status:"Verfügbar"},
      {id:uid(),number:"M-001",category:"Maske",name:"Cressi",variant:"Standard",status:"Verfügbar"}
    ],
    reservations:[],
    history:[{id:uid(),time:new Date().toISOString(),text:"Version 0.3 initialisiert"}],
    memberLoginId:maxId
  };
};

let db;
try { db = JSON.parse(localStorage.getItem(DB_KEY)) || seed(); } catch { db = seed(); }
let session = null;
let activeApprovalId = null;

function persist(){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function log(text){ db.history.unshift({id:uid(),time:new Date().toISOString(),text}); persist(); }

function currentMember(){
  if(session?.role !== "Mitglied") return null;
  return db.members.find(m => m.id === session.memberId) || db.members[0] || null;
}

function login(){
  const username = $("loginUser").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  if(password !== "aquarius" || !["wart","mitglied"].includes(username)){
    $("loginError").textContent = "Benutzername oder Passwort falsch.";
    return;
  }
  session = username === "wart"
    ? {role:"Gerätewart", username}
    : {role:"Mitglied", username, memberId:db.memberLoginId || db.members[0]?.id};
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  $("loginError").textContent = "";
  startApp();
}

function logout(){
  if(!confirm("Möchtest du den Benutzer wechseln?")) return;
  session = null;
  localStorage.removeItem(SESSION_KEY);
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginUser").value = "";
  $("loginPassword").value = "";
  setTimeout(() => $("loginUser").focus(), 50);
}

function navItems(){
  if(session.role === "Gerätewart"){
    return [
      ["dashboard","🏠","Dashboard"],["reservations","📅","Reservierungen"],["inventory","🤿","Inventar"],
      ["members","👥","Mitglieder"],["history","📜","Historie"]
    ];
  }
  return [
    ["dashboard","🏠","Dashboard"],["reservations","📅","Meine Reservierungen"],["loans","📦","Meine Ausleihen"]
  ];
}

function buildNav(){
  const items = navItems();
  $("bottomNav").style.gridTemplateColumns = `repeat(${items.length},1fr)`;
  $("bottomNav").innerHTML = items.map(([page,icon,label]) =>
    `<button data-page="${page}"><span class="nav-icon">${icon}</span>${esc(label)}</button>`
  ).join("");
  $("bottomNav").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
}

function showPage(page, filter=""){
  if(session.role === "Mitglied" && ["members","inventory","history"].includes(page)) page = "dashboard";
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(`page-${page}`).classList.remove("hidden");
  $("bottomNav").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  if(page === "reservations" && filter) $("reservationStatusFilter").value = filter;
  renderAll();
}

function startApp(){
  if(!session) return;
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  const member = currentMember();
  $("sessionLabel").textContent = session.role === "Gerätewart"
    ? "Angemeldet als Gerätewart"
    : `Angemeldet als ${member?.name || "Mitglied"}`;
  document.querySelectorAll("[data-admin-only]").forEach(el => el.classList.toggle("hidden", session.role !== "Gerätewart"));
  $("reservationMemberField").classList.toggle("hidden", session.role !== "Gerätewart");
  $("reservationsTitle").textContent = session.role === "Gerätewart" ? "Reservierungen" : "Meine Reservierungen";
  $("reservationsSubtitle").textContent = session.role === "Gerätewart" ? "Anfragen prüfen und genehmigen." : "Nur deine eigenen Reservierungen sind sichtbar.";
  buildNav();
  buildReservationItemForm();
  showPage("dashboard");
}

function reservationScope(){
  if(session.role === "Gerätewart") return db.reservations;
  const member = currentMember();
  return db.reservations.filter(r => r.memberId === member?.id);
}

function badgeClass(status){
  if(["Genehmigt","Verfügbar"].includes(status)) return "badge-green";
  if(["Teilweise genehmigt","Reserviert","Wartung"].includes(status)) return "badge-orange";
  if(["Abgelehnt","Storniert","Defekt"].includes(status)) return "badge-red";
  return "badge-blue";
}

function renderDashboard(){
  const mine = reservationScope();
  const open = mine.filter(r => r.status === "Beantragt").length;
  const approved = mine.filter(r => ["Genehmigt","Teilweise genehmigt"].includes(r.status)).length;
  const loans = session.role === "Mitglied"
    ? db.inventory.filter(i => i.status === "Ausgeliehen" && i.assignedMemberId === currentMember()?.id).length
    : db.inventory.filter(i => i.status === "Ausgeliehen").length;
  const maintenance = db.inventory.filter(i => ["Wartung","Defekt"].includes(i.status)).length;

  $("dashboardIntro").textContent = session.role === "Gerätewart"
    ? "Tippe auf eine Kachel, um direkt in die gefilterte Ansicht zu wechseln."
    : "Hier siehst du deine Reservierungen und Ausleihen.";

  const tiles = session.role === "Gerätewart" ? [
    ["📨",open,"Offene Reservierungen","reservations","Beantragt"],
    ["✅",approved,"Genehmigte Reservierungen","reservations","Genehmigt"],
    ["📦",loans,"Aktuell ausgeliehen","inventory","Ausgeliehen"],
    ["🔧",maintenance,"Wartung oder Defekt","inventory","Wartung"],
    ["🤿",db.inventory.length,"Inventargegenstände","inventory",""],
    ["👥",db.members.length,"Mitglieder","members",""]
  ] : [
    ["📨",open,"Meine offenen Anfragen","reservations","Beantragt"],
    ["✅",approved,"Meine Genehmigungen","reservations","Genehmigt"],
    ["📦",loans,"Meine Ausleihen","loans",""],
    ["➕","", "Neue Reservierung","new-reservation",""]
  ];

  $("dashboardTiles").innerHTML = tiles.map(([icon,num,label,page,filter]) =>
    `<button class="tile" data-target="${page}" data-filter="${filter}">
      <div class="tile-icon">${icon}</div>
      <div class="tile-number">${num}</div><div class="tile-label">${esc(label)}</div>
    </button>`
  ).join("");

  $("dashboardTiles").querySelectorAll(".tile").forEach(tile => tile.addEventListener("click", () => {
    if(tile.dataset.target === "new-reservation") openReservationDialog();
    else showPage(tile.dataset.target, tile.dataset.filter);
  }));

  const recent = mine.slice(0,3);
  $("dashboardRecent").innerHTML = `<h3>Letzte Reservierungen</h3>` +
    (recent.length ? recent.map(r => `<div class="muted" style="padding:8px 0;border-top:1px solid var(--border)">
      <b>${esc(r.memberName)}</b> · ${dateDE(r.from)}–${dateDE(r.to)} · ${esc(r.status)}
    </div>`).join("") : `<div class="muted">Noch keine Reservierungen vorhanden.</div>`);
}

function renderReservations(){
  const q = $("reservationSearch").value.trim().toLowerCase();
  const status = $("reservationStatusFilter").value;
  let data = reservationScope().filter(r => {
    const text = `${r.memberName} ${r.items.map(i => `${i.category} ${i.variant}`).join(" ")}`.toLowerCase();
    return (!q || text.includes(q)) && (!status || r.status === status);
  });

  $("reservationsList").innerHTML = data.length ? data.map(r => `
    <article class="item">
      <div class="item-head">
        <div><h3>${esc(r.memberName)}</h3><div class="muted">${dateDE(r.from)}–${dateDE(r.to)}</div></div>
        <span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span>
      </div>
      <ul class="positions">${r.items.map(i => `<li><b>${i.qty} × ${esc(i.category)}</b>${i.variant !== "Standard" ? ` · ${esc(i.variant)}` : ""}${i.approvedQty !== undefined ? ` <span class="muted">· genehmigt: ${i.approvedQty}</span>` : ""}</li>`).join("")}</ul>
      <div class="actions">
        ${session.role === "Gerätewart" && r.status === "Beantragt" ? `<button class="btn soft" data-approve="${r.id}">Prüfen</button>` : ""}
        ${r.status === "Beantragt" && r.memberId === currentMember()?.id ? `<button class="btn danger" data-cancel="${r.id}">Stornieren</button>` : ""}
      </div>
    </article>`).join("") : `<div class="empty">Keine passenden Reservierungen.</div>`;

  document.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => openApproval(b.dataset.approve)));
  document.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", () => cancelReservation(b.dataset.cancel)));
}

function buildReservationItemForm(){
  $("reservationItems").innerHTML = itemDefinitions.map((def,index) => `
    <div class="reserve-card">
      <label class="reserve-toggle">
        <input type="checkbox" data-item-check="${index}"> ${def.icon} ${esc(def.key)}
      </label>
      <div class="reserve-fields hidden" data-item-fields="${index}">
        <label>Ausführung
          <select data-item-variant="${index}">${def.variants.map(v => `<option>${esc(v)}</option>`).join("")}</select>
        </label>
        <label>${def.key === "Blei" ? "Anzahl Bleiblöcke" : "Anzahl"}
          <input data-item-qty="${index}" type="number" min="1" max="20" value="1">
        </label>
      </div>
    </div>`).join("");
  document.querySelectorAll("[data-item-check]").forEach(ch => ch.addEventListener("change", () => {
    document.querySelector(`[data-item-fields="${ch.dataset.itemCheck}"]`).classList.toggle("hidden", !ch.checked);
  }));
}

function openReservationDialog(){
  $("reservationMember").innerHTML = db.members.filter(m => m.status === "Aktiv").map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
  if(session.role === "Mitglied" && currentMember()) $("reservationMember").value = currentMember().id;
  $("reservationFrom").value = today();
  $("reservationTo").value = today();
  $("reservationFormError").textContent = "";
  document.querySelectorAll("[data-item-check]").forEach(ch => { ch.checked = false; document.querySelector(`[data-item-fields="${ch.dataset.itemCheck}"]`).classList.add("hidden"); });
  $("reservationDialog").showModal();
}

function saveReservation(){
  const from = $("reservationFrom").value, to = $("reservationTo").value;
  if(!from || !to || to < from){ $("reservationFormError").textContent = "Bitte einen gültigen Zeitraum auswählen."; return; }
  const items = [];
  itemDefinitions.forEach((def,index) => {
    const checked = document.querySelector(`[data-item-check="${index}"]`).checked;
    if(checked){
      const qty = Number(document.querySelector(`[data-item-qty="${index}"]`).value);
      const variant = document.querySelector(`[data-item-variant="${index}"]`).value;
      if(qty > 0) items.push({category:def.key,variant,qty});
    }
  });
  if(!items.length){ $("reservationFormError").textContent = "Bitte mindestens eine Kategorie auswählen."; return; }
  const memberId = session.role === "Gerätewart" ? $("reservationMember").value : currentMember()?.id;
  const member = db.members.find(m => m.id === memberId);
  if(!member){ $("reservationFormError").textContent = "Mitglied konnte nicht ermittelt werden."; return; }
  db.reservations.unshift({id:uid(),memberId,memberName:member.name,from,to,status:"Beantragt",items,createdAt:new Date().toISOString()});
  log(`Reservierung beantragt: ${member.name} (${items.length} Kategorien)`);
  $("reservationDialog").close();
  renderAll();
  showPage("reservations");
}

function openApproval(id){
  const r = db.reservations.find(x => x.id === id);
  if(!r) return;
  activeApprovalId = id;
  $("approvalMember").textContent = `${r.memberName} · ${dateDE(r.from)}–${dateDE(r.to)}`;
  $("approvalItems").innerHTML = r.items.map((item,index) => `
    <div class="approval-row">
      <div><b>${esc(item.category)}</b><div class="muted">${esc(item.variant)} · beantragt: ${item.qty}</div></div>
      <label>Genehmigt<input type="number" min="0" max="${item.qty}" value="${item.qty}" data-approved-index="${index}"></label>
    </div>`).join("");
  $("approvalDialog").showModal();
}

function saveApproval(){
  const r = db.reservations.find(x => x.id === activeApprovalId);
  if(!r) return;
  let totalApproved = 0, totalRequested = 0;
  r.items.forEach((item,index) => {
    const input = document.querySelector(`[data-approved-index="${index}"]`);
    const n = Math.max(0, Math.min(item.qty, Number(input.value) || 0));
    item.approvedQty = n; totalApproved += n; totalRequested += item.qty;
  });
  r.status = totalApproved === 0 ? "Abgelehnt" : totalApproved === totalRequested ? "Genehmigt" : "Teilweise genehmigt";
  log(`Reservierung ${r.status.toLowerCase()}: ${r.memberName}`);
  $("approvalDialog").close();
  renderAll();
}

function rejectReservation(){
  const r = db.reservations.find(x => x.id === activeApprovalId);
  if(!r) return;
  r.items.forEach(item => item.approvedQty = 0);
  r.status = "Abgelehnt";
  log(`Reservierung abgelehnt: ${r.memberName}`);
  $("approvalDialog").close();
  renderAll();
}

function cancelReservation(id){
  const r = db.reservations.find(x => x.id === id);
  if(!r || !confirm("Reservierung wirklich stornieren?")) return;
  r.status = "Storniert";
  log(`Reservierung storniert: ${r.memberName}`);
  renderAll();
}

function renderMembers(){
  if(session.role !== "Gerätewart") return;
  const q = $("memberSearch").value.trim().toLowerCase(), status = $("memberStatusFilter").value;
  const data = db.members.filter(m => (!q || `${m.name} ${m.email}`.toLowerCase().includes(q)) && (!status || m.status === status))
    .sort((a,b) => a.name.localeCompare(b.name,"de"));
  $("membersList").innerHTML = data.length ? data.map(m => `
    <article class="item"><div class="item-head"><div><h3>${esc(m.name)}</h3><div class="muted">${esc(m.group)} · ${esc(m.email || "keine E-Mail")}</div></div>
    <span class="badge ${m.status === "Aktiv" ? "badge-green" : "badge-red"}">${m.status}</span></div>
    <div class="actions"><button class="btn soft" data-edit-member="${m.id}">Bearbeiten</button></div></article>`).join("") : `<div class="empty">Keine Mitglieder gefunden.</div>`;
  document.querySelectorAll("[data-edit-member]").forEach(b => b.addEventListener("click", () => openMember(b.dataset.editMember)));
}

function openMember(id=""){
  const m = db.members.find(x => x.id === id);
  $("memberId").value = m?.id || "";
  $("memberName").value = m?.name || "";
  $("memberEmail").value = m?.email || "";
  $("memberGroup").value = m?.group || "Mitglied";
  $("memberStatus").value = m?.status || "Aktiv";
  $("memberDialog").showModal();
}

function saveMember(){
  const name = $("memberName").value.trim();
  if(!name) return alert("Name fehlt.");
  const id = $("memberId").value;
  const obj = {id:id || uid(),name,email:$("memberEmail").value.trim(),group:$("memberGroup").value,status:$("memberStatus").value};
  const idx = db.members.findIndex(m => m.id === obj.id);
  if(idx >= 0) db.members[idx] = obj; else db.members.push(obj);
  log(`${idx >= 0 ? "Mitglied geändert" : "Mitglied angelegt"}: ${name}`);
  $("memberDialog").close(); renderAll();
}

function renderInventory(){
  if(session.role !== "Gerätewart") return;
  const q = $("inventorySearch").value.trim().toLowerCase(), status = $("inventoryStatusFilter").value;
  const data = db.inventory.filter(i => (!q || `${i.number} ${i.category} ${i.name} ${i.variant}`.toLowerCase().includes(q)) && (!status || i.status === status))
    .sort((a,b) => a.number.localeCompare(b.number,"de"));
  $("inventoryList").innerHTML = data.length ? data.map(i => `
    <article class="item"><div class="item-head"><div><h3>${esc(i.number)} · ${esc(i.name)}</h3><div class="muted">${esc(i.category)} · ${esc(i.variant)}</div></div>
    <span class="badge ${badgeClass(i.status)}">${esc(i.status)}</span></div>
    <div class="actions"><button class="btn soft" data-edit-inventory="${i.id}">Bearbeiten</button></div></article>`).join("") : `<div class="empty">Kein Inventar gefunden.</div>`;
  document.querySelectorAll("[data-edit-inventory]").forEach(b => b.addEventListener("click", () => openInventory(b.dataset.editInventory)));
}

function openInventory(id=""){
  const i = db.inventory.find(x => x.id === id);
  $("inventoryId").value = i?.id || "";
  $("inventoryNumber").value = i?.number || "";
  $("inventoryCategory").value = i?.category || "Flasche";
  $("inventoryName").value = i?.name || "";
  $("inventoryVariant").value = i?.variant || "";
  $("inventoryStatus").value = i?.status || "Verfügbar";
  $("inventoryDialog").showModal();
}

function saveInventory(){
  const number = $("inventoryNumber").value.trim(), name = $("inventoryName").value.trim();
  if(!number || !name) return alert("Inventarnummer und Bezeichnung werden benötigt.");
  const id = $("inventoryId").value;
  if(db.inventory.some(i => i.number.toLowerCase() === number.toLowerCase() && i.id !== id)) return alert("Inventarnummer ist bereits vorhanden.");
  const obj = {id:id || uid(),number,category:$("inventoryCategory").value,name,variant:$("inventoryVariant").value.trim() || "Standard",status:$("inventoryStatus").value};
  const idx = db.inventory.findIndex(i => i.id === obj.id);
  if(idx >= 0) db.inventory[idx] = obj; else db.inventory.push(obj);
  log(`${idx >= 0 ? "Inventar geändert" : "Inventar angelegt"}: ${number}`);
  $("inventoryDialog").close(); renderAll();
}

function renderHistory(){
  if(session.role !== "Gerätewart") return;
  $("historyList").innerHTML = db.history.length ? db.history.map(h => `
    <article class="item"><h3>${esc(h.text)}</h3><div class="muted">${new Date(h.time).toLocaleString("de-DE")}</div></article>`).join("") : `<div class="empty">Keine Einträge.</div>`;
}

function renderLoans(){
  const member = currentMember();
  const loans = db.inventory.filter(i => i.status === "Ausgeliehen" && i.assignedMemberId === member?.id);
  $("loansList").innerHTML = loans.length ? loans.map(i => `<article class="item"><h3>${esc(i.number)} · ${esc(i.name)}</h3><div class="muted">${esc(i.category)} · ${esc(i.variant)}</div></article>`).join("") : `<div class="empty">Aktuell ist dir keine Ausrüstung zugeordnet.</div>`;
}

function renderAll(){
  renderDashboard(); renderReservations(); renderMembers(); renderInventory(); renderHistory(); renderLoans(); persist();
}

$("loginButton").addEventListener("click", login);
$("loginPassword").addEventListener("keydown", e => { if(e.key === "Enter") login(); });
$("loginUser").addEventListener("keydown", e => { if(e.key === "Enter") $("loginPassword").focus(); });
$("logoutButton").addEventListener("click", logout);
$("newReservationButton").addEventListener("click", openReservationDialog);
$("saveReservationButton").addEventListener("click", saveReservation);
$("saveApprovalButton").addEventListener("click", saveApproval);
$("rejectReservationButton").addEventListener("click", rejectReservation);
$("newMemberButton").addEventListener("click", () => openMember());
$("saveMemberButton").addEventListener("click", saveMember);
$("newInventoryButton").addEventListener("click", () => openInventory());
$("saveInventoryButton").addEventListener("click", saveInventory);
["reservationSearch","reservationStatusFilter"].forEach(id => $(id).addEventListener("input", renderReservations));
["memberSearch","memberStatusFilter"].forEach(id => $(id).addEventListener("input", renderMembers));
["inventorySearch","inventoryStatusFilter"].forEach(id => $(id).addEventListener("input", renderInventory));

try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { session = null; }
if(session) startApp();
})();
