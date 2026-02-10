/**
 * SYRIX ESPORTS - DEEP STRUCTURE LOGIC v13.0
 * TARGET: Root Collections -> Map Documents -> Subcollections
 */

// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e",
    measurementId: "G-VGXG0NCTGX"
};

const CONSTANTS = {
    ADMIN_UIDS: ["REPLACE_WITH_YOUR_DISCORD_ID"],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    DAYS: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

// --- 2. GLOBAL STATE ---
let db, auth, currentUser;
let canvas, ctx, currentTool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null, currentRosterId = null, compSlotIndex = null;
let tempLineupX = 0, tempLineupY = 0, currentLineupId = null;

// --- 3. CORE FUNCTIONS ---

// >> LANDING PAGE (Root Level Data)
function loadLandingData() {
    console.log("Loading Landing Data...");

    // Events (Root)
    db.collection("events").orderBy("date").onSnapshot(snap => {
        const div = document.getElementById('landing-matches');
        if (div) {
            div.innerHTML = "";
            let w = 0, t = 0;
            snap.forEach(doc => {
                const m = doc.data();
                if (m.result) { t++; if (parseInt(m.result.us) > parseInt(m.result.them)) w++; }
                else if (m.date >= new Date().toISOString().split('T')[0]) {
                    div.innerHTML += `
                        <div class="match-card-landing">
                            <span class="match-date">${m.date} // ${m.time || 'TBD'}</span>
                            <div class="match-versus">VS ${m.opponent}</div>
                            <div class="match-meta">${m.map || 'TBD'}</div>
                        </div>`;
                }
            });
            const wr = t > 0 ? Math.round((w / t) * 100) : 0;
            if (document.getElementById('stat-winrate')) document.getElementById('stat-winrate').innerText = `${wr}%`;
        }
    });

    // Roster (Root)
    db.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('landing-roster');
        if (div) {
            div.innerHTML = "";
            if (document.getElementById('stat-roster')) document.getElementById('stat-roster').innerText = snap.size;
            snap.forEach(doc => {
                const p = doc.data();
                div.innerHTML += `
                    <div class="roster-card">
                        <img src="${p.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}">
                        <div class="roster-info"><h3>${doc.id}</h3><span>${p.role}</span></div>
                    </div>`;
            });
        }
    });
}

// >> AUTHENTICATION
function handleHubAuth(user) {
    if (!user) {
        document.getElementById('hubLocked').style.display = 'flex';
        document.getElementById('hubUnlocked').style.display = 'none';
        return;
    }

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        if (!snap.empty || CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
            document.getElementById('hubLocked').style.display = 'none';
            document.getElementById('hubUnlocked').style.display = 'flex';
            document.getElementById('user-name').innerText = user.displayName ? user.displayName.toUpperCase() : "AGENT";

            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
                document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'inline-block');
            }

            // LOAD MODULES
            loadCaptainMsg(); loadAbsences(); loadDashboardEvents();
            loadWarRoom(); loadMapVeto(); loadHubMatches();
            loadRosterList(); loadComp(); changeLineupMap();
            loadHeatmap(); loadPartners();

            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) loadApps();

        } else {
            document.getElementById('login-module').style.display = 'none';
            document.getElementById('app-module').style.display = 'block';
            if (document.getElementById('app-ign') && user.displayName) document.getElementById('app-ign').value = user.displayName;
        }
    });
}

// >> DATABASE AUTO-FIXER
async function initializeDatabase() {
    const check = await db.collection("general").doc("captain_message").get();
    if (!check.exists) {
        console.log("⚠️ Initializing Database...");
        const batch = db.batch();
        batch.set(db.collection("general").doc("captain_message"), { text: "Welcome to Syrix." });
        batch.set(db.collection("roster").doc("Operator"), { role: "Captain", rank: "Radiant", uid: currentUser.uid, pfp: "" });

        // Initialize Map Folders
        CONSTANTS.MAPS.forEach(map => {
            batch.set(db.collection("comps").doc(map), { agents: [null, null, null, null, null] });
            batch.set(db.collection("playbooks").doc(map), { attack: "", defense: "" });
        });

        await batch.commit();
        console.log("✅ Database Structure Created.");
        window.location.reload();
    }
}

// >> ASSETS API
async function fetchAgents() {
    try {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        const agents = json.data;
        const sp = document.getElementById('agent-palette');
        const cp = document.getElementById('comp-agent-list');
        if (sp) sp.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.prepAgent('${a.displayIcon}')" title="${a.displayName}">`).join('');
        if (cp) cp.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.setCompSlot('${a.displayIcon}')" title="${a.displayName}">`).join('');
    } catch (e) { console.error(e); }
}

// --- 4. UI HANDLERS ---

window.loginDiscord = () => auth.signInWithPopup(new firebase.auth.OAuthProvider('oidc.discord'));

window.submitApp = () => {
    const d = {
        user: document.getElementById('app-ign').value, uid: currentUser.uid,
        rank: document.getElementById('app-rank').value, role: document.getElementById('app-role').value,
        tracker: document.getElementById('app-tracker').value, why: document.getElementById('app-why').value,
        submitted: new Date().toISOString()
    };
    db.collection("applications").add(d).then(() => {
        fetch(CONSTANTS.WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: `New App: ${d.user}`, color: 16711680 }] }) });
        alert("Application Sent.");
    });
};

window.setTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    if (id === 'stratbook' && canvas) { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
};

// --- MODULES ---

// DASHBOARD
function loadCaptainMsg() { db.collection("general").doc("captain_message").onSnapshot(d => { if (d.exists) document.getElementById('capt-msg').innerText = `"${d.data().text}"`; }); }
window.editMsg = () => document.getElementById('capt-edit').style.display = 'block';
window.saveMsg = () => { db.collection("general").doc("captain_message").set({ text: document.getElementById('capt-input').value }, { merge: true }); document.getElementById('capt-edit').style.display = 'none'; };

function loadAbsences() { db.collection("leaves").orderBy("start").onSnapshot(s => { document.getElementById('abs-list').innerHTML = ""; s.forEach(d => document.getElementById('abs-list').innerHTML += `<div class="list-item" style="font-size:0.8rem;"><b>${d.data().user}</b>: ${d.data().start}</div>`); }); }
window.logAbsence = () => db.collection("leaves").add({ user: currentUser.displayName, start: document.getElementById('abs-start').value, end: document.getElementById('abs-end').value }).then(() => alert("Logged"));

function loadDashboardEvents() {
    db.collection("events").where("date", ">=", new Date().toISOString().split('T')[0]).orderBy("date").limit(3).onSnapshot(s => {
        document.getElementById('dash-events').innerHTML = "";
        if (document.getElementById('ops-badge')) document.getElementById('ops-badge').innerText = `${s.size} ACTIVE`;
        s.forEach(d => document.getElementById('dash-events').innerHTML += `<div class="list-item"><b>VS ${d.data().opponent}</b> <small>${d.data().date}</small></div>`);
    });
}

function loadHeatmap() {
    db.collection("availabilities").onSnapshot(snap => {
        const counts = {};
        snap.forEach(d => (d.data().slots || []).forEach(s => { for (let h = parseInt(s.start); h < parseInt(s.end); h++) counts[`${s.day}-${h}`] = (counts[`${s.day}-${h}`] || 0) + 1; }));
        let html = "";
        CONSTANTS.DAYS.forEach(day => {
            let row = `<div class="heatmap-row"><span style="width:30px;font-size:0.6rem;color:#666;">${day.substring(0, 3)}</span>`;
            for (let h = 0; h < 24; h++) { const a = Math.min((counts[`${day}-${h}`] || 0) * 0.2, 1); row += `<div class="heat-bar" style="background:rgba(255,30,60,${a});" title="${day} ${h}:00"></div>`; }
            html += row + "</div>";
        });
        const hm = document.getElementById('avail-heatmap');
        if (hm) hm.innerHTML = html;
    });
}
window.saveAvail = () => {
    db.collection("availabilities").doc(currentUser.displayName).set({
        slots: firebase.firestore.FieldValue.arrayUnion({ day: document.getElementById('av-day').value, start: document.getElementById('av-start').value, end: document.getElementById('av-end').value })
    }, { merge: true }).then(() => alert("Added"));
};

// STRATBOOK (Nested inside 'strats/[MapName]/drawings')
function initStratbook() {
    canvas = document.getElementById('vpCanvas'); if (!canvas) return; ctx = canvas.getContext('2d');
    canvas.onmousedown = e => { if (currentTool === 'draw') { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); } else if (activeAgent) { const i = new Image(); i.src = activeAgent; i.crossOrigin = "anonymous"; i.onload = () => ctx.drawImage(i, e.offsetX - 15, e.offsetY - 15, 30, 30); } };
    canvas.onmousemove = e => { if (!isDrawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.strokeStyle = document.getElementById('vpColor').value; ctx.lineWidth = 3; ctx.stroke(); };
    window.onmouseup = () => isDrawing = false;
}
window.prepAgent = u => { activeAgent = u; currentTool = 'agent'; };
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.changeMap = () => { document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`; window.clearStrat(); };
window.saveStrat = () => {
    const map = document.getElementById('vpMapSelect').value;
    // Save to NESTED collection: strats -> [Map] -> drawings -> [AutoID]
    db.collection("strats").doc(map).collection("drawings").add({
        author: currentUser.displayName,
        img: canvas.toDataURL(),
        date: new Date().toISOString()
    }).then(() => alert("Strat Saved"));
};

// COMPS (Document ID = Map Name)
window.loadComp = () => {
    db.collection("comps").doc(document.getElementById('comp-map').value).get().then(d => {
        const ag = d.exists ? d.data().agents : [null, null, null, null, null];
        for (let i = 0; i < 5; i++) { document.getElementById(`cs-${i}`).innerHTML = ag[i] ? `<img src="${ag[i]}">` : '?'; document.getElementById(`cs-${i}`).dataset.img = ag[i] || ""; }
        document.getElementById('comp-display').innerHTML = ag.map(a => a ? `<img src="${a}" style="width:45px;border-radius:50%;">` : '').join('');
    });
};
window.editComp = i => { compSlotIndex = i; document.getElementById('comp-picker').style.display = 'block'; };
window.setCompSlot = u => { document.getElementById(`cs-${compSlotIndex}`).dataset.img = u; document.getElementById(`cs-${compSlotIndex}`).innerHTML = `<img src="${u}">`; document.getElementById('comp-picker').style.display = 'none'; };
window.saveComp = () => { const a = []; for (let i = 0; i < 5; i++) a.push(document.getElementById(`cs-${i}`).dataset.img); db.collection("comps").doc(document.getElementById('comp-map').value).set({ agents: a }).then(() => alert("Saved")); };

// LINEUPS (Nested inside 'lineups/[MapName]/items')
window.changeLineupMap = () => {
    const map = document.getElementById('luMapSelect').value;
    document.getElementById('luMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;

    // NESTED READ
    db.collection("lineups").doc(map).collection("items").onSnapshot(s => {
        const c = document.getElementById('lineup-pins'); c.innerHTML = "";
        s.forEach(d => {
            const p = document.createElement('div'); p.className = "pin";
            p.style.left = `${d.data().x}%`; p.style.top = `${d.data().y}%`;
            p.onclick = e => { e.stopPropagation(); window.viewLineup(d.id, d.data()); };
            c.appendChild(p);
        });
    });
};
window.mapClickLineup = e => { const r = document.getElementById('lu-map-wrap').getBoundingClientRect(); tempLineupX = ((e.clientX - r.left) / r.width) * 100; tempLineupY = ((e.clientY - r.top) / r.height) * 100; document.getElementById('lineup-form').style.display = 'block'; document.getElementById('lineup-viewer').style.display = 'none'; };
window.saveLineup = () => {
    const map = document.getElementById('luMapSelect').value;
    // NESTED WRITE
    db.collection("lineups").doc(map).collection("items").add({
        x: tempLineupX, y: tempLineupY,
        title: document.getElementById('lu-title').value,
        url: document.getElementById('lu-url').value,
        desc: document.getElementById('lu-desc').value
    }).then(() => { document.getElementById('lineup-form').style.display = 'none'; alert("Saved"); });
};
window.viewLineup = (id, d) => { currentLineupId = id; document.getElementById('lineup-form').style.display = 'none'; document.getElementById('lineup-viewer').style.display = 'block'; document.getElementById('view-lu-title').innerText = d.title; document.getElementById('view-lu-link').href = d.url; document.getElementById('view-lu-desc').innerText = d.desc; };
window.deleteLineup = () => {
    const map = document.getElementById('luMapSelect').value;
    if (confirm("Delete?")) db.collection("lineups").doc(map).collection("items").doc(currentLineupId).delete().then(() => document.getElementById('lineup-viewer').style.display = 'none');
};

// VETO
function loadMapVeto() { db.collection("general").doc("veto").onSnapshot(d => { const data = d.data() || {}; document.getElementById('veto-grid').innerHTML = CONSTANTS.MAPS.map(m => `<div class="veto-card ${data[m] || 'neutral'}" onclick="window.togVeto('${m}','${data[m] || 'neutral'}')" style="background-image:url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')"><div class="veto-overlay"><div>${m}</div><small>${data[m] || ''}</small></div></div>`).join(''); }); }
window.togVeto = (m, s) => db.collection("general").doc("veto").set({ [m]: s === 'neutral' ? 'ban' : s === 'ban' ? 'pick' : 'neutral' }, { merge: true });
window.resetVeto = () => db.collection("general").doc("veto").set({});

// MATCHES
function loadHubMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(s => {
        document.getElementById('match-list').innerHTML = ""; let w = 0, t = 0;
        s.forEach(d => { const m = d.data(); if (m.result) { t++; if (parseInt(m.result.us) > parseInt(m.result.them)) w++; } document.getElementById('match-list').innerHTML += `<div class="list-item"><div><b>VS ${m.opponent}</b> ${m.result ? `(${m.result.us}-${m.result.them})` : ''}</div><button style="color:red;border:none;background:none;" onclick="window.delMatch('${d.id}')">X</button></div>`; });
        document.getElementById('stat-win').innerText = t > 0 ? Math.round((w / t) * 100) + "%" : "--%";
    });
}
window.addMatch = () => { const res = document.getElementById('m-us').value; db.collection("events").add({ opponent: document.getElementById('m-opp').value, date: document.getElementById('m-date').value, map: document.getElementById('m-map').value, result: res ? { us: res, them: document.getElementById('m-them').value } : null }).then(() => alert("Logged")); };
window.delMatch = id => { if (confirm("Delete?")) db.collection("events").doc(id).delete(); };

// WAR ROOM
function loadEnemies() { db.collection("war_room").onSnapshot(s => { document.getElementById('enemy-list').innerHTML = ""; s.forEach(d => document.getElementById('enemy-list').innerHTML += `<div class="list-item" onclick="window.openEnemy('${d.id}')" style="cursor:pointer"><b>${d.data().name}</b></div>`); }); }
window.newEnemy = () => { const n = prompt("Name:"); if (n) db.collection("war_room").add({ name: n, notes: "" }); };
window.openEnemy = id => { currentEnemyId = id; db.collection("war_room").doc(id).get().then(d => { document.getElementById('wr-title').innerText = d.data().name; document.getElementById('wr-notes').value = d.data().notes; document.getElementById('wr-content').style.display = 'flex'; }); };
window.saveIntel = () => db.collection("war_room").doc(currentEnemyId).update({ notes: document.getElementById('wr-notes').value }).then(() => alert("Saved"));
window.deleteEnemy = () => db.collection("war_room").doc(currentEnemyId).delete().then(() => document.getElementById('wr-content').style.display = 'none');

// ROSTER
function loadRosterList() { db.collection("roster").onSnapshot(s => { document.getElementById('roster-list-mgr').innerHTML = ""; s.forEach(d => document.getElementById('roster-list-mgr').innerHTML += `<div class="list-item" onclick="window.editRoster('${d.id}')" style="cursor:pointer;">${d.id} <span class="badge">${d.data().role}</span></div>`); }); }
window.editRoster = id => { currentRosterId = id; document.getElementById('r-id').value = id; document.getElementById('roster-editor').style.display = 'block'; };
window.saveProfile = () => db.collection("roster").doc(currentRosterId).update({ role: document.getElementById('r-role').value, pfp: document.getElementById('r-pfp').value }).then(() => alert("Updated"));

// ADMIN
function loadApps() { db.collection("applications").onSnapshot(s => { document.getElementById('admin-list').innerHTML = ""; s.forEach(d => document.getElementById('admin-list').innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start;"><div><b>${d.data().user}</b></div><i>"${d.data().why}"</i><div style="width:100%; display:flex; gap:5px;"><button class="btn primary" style="background:green" onclick="window.decideApp('${d.id}','${d.data().user}','${d.data().uid}',true)">ACCEPT</button><button class="btn primary" style="background:red" onclick="window.decideApp('${d.id}',null,null,false)">REJECT</button></div></div>`); }); }
window.decideApp = (id, user, uid, accept) => { if (accept) db.collection("roster").doc(user).set({ uid, role: "Tryout", rank: "Unranked" }).then(() => db.collection("applications").doc(id).delete()); else if (confirm("Reject?")) db.collection("applications").doc(id).delete(); };

// PARTNERS & CONTENT
function loadPartners() { db.collection("partners").onSnapshot(s => { const el = document.getElementById('partner-list'); if (el) { el.innerHTML = ""; s.forEach(d => el.innerHTML += `<div class="list-item"><b>${d.data().name}</b> <small>${d.data().contact}</small></div>`); } }); }
window.addPartner = () => db.collection("partners").add({ name: document.getElementById('pt-name').value, contact: document.getElementById('pt-contact').value });
window.addNews = () => db.collection("news").add({ title: document.getElementById('news-title').value, body: document.getElementById('news-body').value }).then(() => alert("Posted"));
window.addIntel = () => db.collection("intel").add({ title: document.getElementById('intel-title').value, url: document.getElementById('intel-url').value }).then(() => alert("Added"));

// PLAYBOOK (Document ID = Map Name, Fields = Sides)
window.loadPlaybook = () => {
    const map = document.getElementById('pb-map').value;
    const side = document.getElementById('pb-side').value.toLowerCase(); // 'attack' or 'defense'
    db.collection("playbooks").doc(map).get().then(d => {
        // Read specific field (attack/defense) from the Map Doc
        document.getElementById('pb-text').value = d.exists && d.data()[side] ? d.data()[side] : "";
    });
};
window.savePlaybook = () => {
    const map = document.getElementById('pb-map').value;
    const side = document.getElementById('pb-side').value.toLowerCase();
    // Save to specific field using merge
    db.collection("playbooks").doc(map).set({ [side]: document.getElementById('pb-text').value }, { merge: true }).then(() => alert("Saved"));
};

// --- 5. INITIALIZATION SEQUENCE ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase Connected (Deep Structure).");

        const loader = document.getElementById('system-loader');
        if (loader) loader.style.display = 'none';

        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') {
                handleHubAuth(user);
                if (user) initializeDatabase();
            }
        });

        if (document.body.id === 'page-home') loadLandingData();
        if (document.body.id === 'page-hub') { initStratbook(); fetchAgents(); }

    } catch (e) {
        alert("CRITICAL ERROR: " + e.message);
    }
});