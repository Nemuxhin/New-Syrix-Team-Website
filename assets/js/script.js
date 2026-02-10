/**
 * SYRIX ESPORTS - CORE LOGIC v8.0 (Corrected Config)
 * CONNECTED TO: database-for-new-website
 */

// --- 1. CONFIGURATION (UPDATED) ---
const firebaseConfig = {
    apiKey: "AIzaSyDcV7KFuLn3I99M5JpW5amR-HSSHFEVVUY",
    authDomain: "database-for-new-website.firebaseapp.com",
    projectId: "database-for-new-website",
    storageBucket: "database-for-new-website.firebasestorage.app",
    messagingSenderId: "844714745171",
    appId: "1:844714745171:web:3ce89bf2b81e3697ff95a6",
    measurementId: "G-PYTWP3TH31"
};

const CONSTANTS = {
    // Replace with your Discord ID after login to get Admin access
    ADMIN_UIDS: ["REPLACE_WITH_YOUR_DISCORD_ID"],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    DAYS: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

// Global State
let db, auth, currentUser;
let canvas, ctx, currentTool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null, currentRosterId = null, compSlotIndex = null;
let tempLineupX = 0, tempLineupY = 0, currentLineupId = null;

// --- 2. SYSTEM STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof firebase === 'undefined') throw new Error("Firebase SDK not loaded");

        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("System: Firebase Connected to " + firebaseConfig.projectId);

        // Remove loading screen if it exists
        const loader = document.getElementById('system-loader');
        if (loader) loader.style.display = 'none';

        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') {
                handleHubAuth(user);
                // AUTO-FIX: Create database structure if new
                if (user) initializeDatabase();
            }
        });

        if (document.body.id === 'page-home') loadLandingData();
        if (document.body.id === 'page-hub') {
            initStratbook();
            fetchAgents();
        }

    } catch (e) {
        alert("CRITICAL ERROR: " + e.message);
    }
});

// --- 3. AUTO-DB FIXER (Runs once to set up new project) ---
async function initializeDatabase() {
    const check = await db.collection("general").doc("captain_message").get();
    if (!check.exists) {
        console.log("⚠️ New Project Detected. Creating database structure...");

        const batch = db.batch();

        // Create Captain Message
        batch.set(db.collection("general").doc("captain_message"), { text: "Welcome to the new Hub." });

        // Create Veto Board
        batch.set(db.collection("general").doc("veto"), {});

        // Create Initial Roster Entry (You)
        batch.set(db.collection("roster").doc("Operator"), {
            role: "Captain",
            rank: "Radiant",
            uid: currentUser.uid,
            pfp: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"
        });

        // Create Sample Match
        batch.set(db.collection("events").doc(), {
            opponent: "Team Liquid",
            date: new Date().toISOString().split('T')[0],
            time: "20:00",
            map: "Ascent",
            result: null
        });

        await batch.commit();
        console.log("✅ Database Structure Created.");
        alert("System Initialized. Refreshing to load data...");
        window.location.reload();
    }
}

// --- 4. AUTHENTICATION ---
window.loginDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider)
        .then((result) => console.log("Logged in:", result.user))
        .catch((error) => {
            console.error("Login Error:", error);
            if (error.code === 'auth/operation-not-allowed') {
                alert("ERROR: Discord Login is disabled.\n\nGo to Firebase Console > Authentication > Sign-in method and enable 'Discord'.");
            } else if (error.code === 'auth/unauthorized-domain') {
                alert("ERROR: Domain not authorized.\n\nGo to Firebase Console > Authentication > Settings > Authorized domains and add 'localhost' and '127.0.0.1'.");
            } else {
                alert("Login Failed: " + error.message);
            }
        });
};

function handleHubAuth(user) {
    if (!user) {
        document.getElementById('hubLocked').style.display = 'flex';
        document.getElementById('hubUnlocked').style.display = 'none';
        return;
    }

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        // Allow access if Roster OR Admin list
        if (!snap.empty || CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
            document.getElementById('hubLocked').style.display = 'none';
            document.getElementById('hubUnlocked').style.display = 'flex';
            document.getElementById('user-name').innerText = user.displayName ? user.displayName.toUpperCase() : "AGENT";

            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
                document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'inline-block');
            }

            // Load Data
            loadCaptainMsg(); loadAbsences(); loadDashboardEvents(); loadWarRoom(); loadHubMatches(); loadRosterList(); loadComp(); changeLineupMap(); loadHeatmap(); loadPartners(); loadMapVeto();
            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) loadApps();

        } else {
            // Not in roster -> Show Application
            document.getElementById('login-module').style.display = 'none';
            document.getElementById('app-module').style.display = 'block';

            // Pre-fill IGN
            const ign = document.getElementById('app-ign');
            if (ign && user.displayName) ign.value = user.displayName;
        }
    });
}

window.submitApp = () => {
    const data = {
        user: document.getElementById('app-ign').value,
        uid: currentUser.uid,
        rank: document.getElementById('app-rank').value,
        role: document.getElementById('app-role').value,
        tracker: document.getElementById('app-tracker').value,
        why: document.getElementById('app-why').value,
        submitted: new Date().toISOString()
    };

    if (!data.user || !data.why) return alert("Missing fields");

    db.collection("applications").add(data).then(() => {
        fetch(CONSTANTS.WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: `New Application: ${data.user}`, color: 16776960 }] }) });
        alert("Application Sent.");
    });
};

// --- 5. NAVIGATION & HELPERS ---
window.setTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    if (id === 'stratbook' && canvas) { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
};

// --- 6. DASHBOARD LOGIC ---
function loadCaptainMsg() {
    db.collection("general").doc("captain_message").onSnapshot(doc => {
        if (doc.exists) document.getElementById('capt-msg').innerText = `"${doc.data().text}"`;
    });
}
window.editMsg = () => document.getElementById('capt-edit').style.display = 'block';
window.saveMsg = () => {
    db.collection("general").doc("captain_message").set({ text: document.getElementById('capt-input').value }, { merge: true });
    document.getElementById('capt-edit').style.display = 'none';
};

function loadDashboardEvents() {
    const today = new Date().toISOString().split('T')[0];
    db.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
        const div = document.getElementById('dash-events');
        div.innerHTML = "";
        document.getElementById('ops-badge').innerText = `${snap.size} ACTIVE`;
        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `<div class="list-item"><b>VS ${m.opponent}</b> <small>${m.date}</small></div>`;
        });
    });
}

function loadAbsences() {
    db.collection("leaves").orderBy("start").onSnapshot(snap => {
        const div = document.getElementById('abs-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            div.innerHTML += `<div class="list-item" style="font-size:0.8rem;"><b>${l.user}</b>: ${l.start}</div>`;
        });
    });
}
window.logAbsence = () => {
    db.collection("leaves").add({
        user: currentUser.displayName,
        start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value,
        reason: document.getElementById('abs-reason').value
    }).then(() => alert("Logged"));
};

// --- 7. STRATBOOK ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.onmousedown = e => {
        if (currentTool === 'draw') { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); }
        else if (currentTool === 'agent' && activeAgent) { const i = new Image(); i.src = activeAgent; i.crossOrigin = "anonymous"; i.onload = () => ctx.drawImage(i, e.offsetX - 15, e.offsetY - 15, 30, 30); }
    };
    canvas.onmousemove = e => { if (!isDrawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.strokeStyle = document.getElementById('vpColor').value; ctx.lineWidth = 3; ctx.stroke(); };
    window.onmouseup = () => isDrawing = false;
}
window.prepAgent = u => { activeAgent = u; currentTool = 'agent'; };
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.changeMap = () => { document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`; window.clearStrat(); };
window.saveStrat = () => {
    const data = canvas.toDataURL();
    db.collection("strats").add({ author: currentUser.displayName, map: document.getElementById('vpMapSelect').value, img: data, date: new Date().toISOString() }).then(() => alert("Saved"));
};

// --- 8. MATCHES ---
function loadHubMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const div = document.getElementById('match-list');
        div.innerHTML = "";
        let w = 0, t = 0;
        snap.forEach(doc => {
            const m = doc.data();
            if (m.result) { t++; if (parseInt(m.result.us) > parseInt(m.result.them)) w++; }
            div.innerHTML += `<div class="list-item"><div><b>VS ${m.opponent}</b> ${m.result ? `(${m.result.us}-${m.result.them})` : ''}</div><button style="color:red;border:none;background:none;" onclick="window.delMatch('${doc.id}')">X</button></div>`;
        });
        document.getElementById('stat-win').innerText = t > 0 ? Math.round((w / t) * 100) + "%" : "--%";
    });
}
window.addMatch = () => {
    const res = document.getElementById('m-us').value;
    db.collection("events").add({
        opponent: document.getElementById('m-opp').value, date: document.getElementById('m-date').value,
        map: document.getElementById('m-map').value,
        result: res ? { us: res, them: document.getElementById('m-them').value } : null
    }).then(() => alert("Logged"));
};
window.delMatch = id => { if (confirm("Delete?")) db.collection("events").doc(id).delete(); };

// --- 9. WAR ROOM ---
function loadWarRoom() {
    db.collection("war_room").onSnapshot(snap => {
        const div = document.getElementById('enemy-list');
        div.innerHTML = "";
        snap.forEach(doc => div.innerHTML += `<div class="list-item" onclick="window.openEnemy('${doc.id}')" style="cursor:pointer;"><b>${doc.data().name}</b></div>`);
    });
}
window.newEnemy = () => { const n = prompt("Name:"); if (n) db.collection("war_room").add({ name: n, notes: "" }); };
window.openEnemy = id => {
    currentEnemyId = id;
    db.collection("war_room").doc(id).get().then(doc => {
        document.getElementById('wr-title').innerText = doc.data().name;
        document.getElementById('wr-notes').value = doc.data().notes;
        document.getElementById('wr-content').style.display = 'flex';
    });
};
window.saveIntel = () => db.collection("war_room").doc(currentEnemyId).update({ notes: document.getElementById('wr-notes').value }).then(() => alert("Saved"));
window.deleteEnemy = () => db.collection("war_room").doc(currentEnemyId).delete().then(() => document.getElementById('wr-content').style.display = 'none');

// --- 10. ROSTER ---
function loadRosterList() {
    db.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('roster-list-mgr');
        div.innerHTML = "";
        snap.forEach(doc => div.innerHTML += `<div class="list-item" onclick="window.editRoster('${doc.id}')" style="cursor:pointer;">${doc.id} <span class="badge">${doc.data().role}</span></div>`);
    });
}
window.editRoster = id => { currentRosterId = id; document.getElementById('r-id').value = id; document.getElementById('roster-editor').style.display = 'block'; };
window.saveProfile = () => db.collection("roster").doc(currentRosterId).update({ role: document.getElementById('r-role').value, pfp: document.getElementById('r-pfp').value }).then(() => alert("Updated"));

// --- 11. MAP VETO ---
function loadMapVeto() {
    db.collection("general").doc("veto").onSnapshot(doc => {
        const d = doc.data() || {};
        document.getElementById('veto-grid').innerHTML = CONSTANTS.MAPS.map(m =>
            `<div class="veto-card ${d[m] || 'neutral'}" onclick="window.togVeto('${m}','${d[m] || 'neutral'}')" style="background-image:url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')"><div class="veto-overlay"><div>${m}</div><small>${d[m] || ''}</small></div></div>`
        ).join('');
    });
}
window.togVeto = (m, s) => db.collection("general").doc("veto").set({ [m]: s === 'neutral' ? 'ban' : s === 'ban' ? 'pick' : 'neutral' }, { merge: true });
window.resetVeto = () => { if (confirm("Reset?")) db.collection("general").doc("veto").set({}); };

// --- 12. LINEUPS ---
window.changeLineupMap = () => {
    const m = document.getElementById('luMapSelect').value;
    document.getElementById('luMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    db.collection("lineups").where("map", "==", m).onSnapshot(s => {
        const c = document.getElementById('lineup-pins'); c.innerHTML = "";
        s.forEach(d => { const p = document.createElement('div'); p.className = "pin"; p.style.left = `${d.data().x}%`; p.style.top = `${d.data().y}%`; p.onclick = e => { e.stopPropagation(); window.viewLineup(d.id, d.data()); }; c.appendChild(p); });
    });
};
window.mapClickLineup = e => {
    const r = document.getElementById('lu-map-wrap').getBoundingClientRect();
    tempLineupX = ((e.clientX - r.left) / r.width) * 100;
    tempLineupY = ((e.clientY - r.top) / r.height) * 100;
    document.getElementById('lineup-form').style.display = 'block';
    document.getElementById('lineup-viewer').style.display = 'none';
};
window.saveLineup = () => db.collection("lineups").add({ map: document.getElementById('luMapSelect').value, x: tempLineupX, y: tempLineupY, title: document.getElementById('lu-title').value, url: document.getElementById('lu-url').value, desc: document.getElementById('lu-desc').value }).then(() => { document.getElementById('lineup-form').style.display = 'none'; alert("Saved"); });
window.viewLineup = (id, d) => { currentLineupId = id; document.getElementById('lineup-form').style.display = 'none'; document.getElementById('lineup-viewer').style.display = 'block'; document.getElementById('view-lu-title').innerText = d.title; document.getElementById('view-lu-link').href = d.url; document.getElementById('view-lu-desc').innerText = d.desc; };
window.deleteLineup = () => { if (confirm("Delete?")) db.collection("lineups").doc(currentLineupId).delete().then(() => document.getElementById('lineup-viewer').style.display = 'none'); };

// --- 13. ADMIN ---
function loadApps() {
    db.collection("applications").onSnapshot(snap => {
        const div = document.getElementById('admin-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const a = doc.data();
            div.innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start;"><div><b>${a.user}</b></div><i>"${a.why}"</i><div style="width:100%; display:flex; gap:5px;"><button class="btn primary" style="background:green" onclick="window.decideApp('${doc.id}','${a.user}','${a.uid}',true)">ACCEPT</button><button class="btn primary" style="background:red" onclick="window.decideApp('${doc.id}',null,null,false)">REJECT</button></div></div>`;
        });
    });
}
window.decideApp = (id, user, uid, accept) => {
    if (accept) db.collection("roster").doc(user).set({ uid, role: "Tryout", rank: "Unranked" }).then(() => db.collection("applications").doc(id).delete());
    else if (confirm("Reject?")) db.collection("applications").doc(id).delete();
};

// --- 14. PARTNERS & CONTENT ---
function loadPartners() { db.collection("partners").onSnapshot(s => { document.getElementById('partner-list').innerHTML = ""; s.forEach(d => document.getElementById('partner-list').innerHTML += `<div class="list-item"><b>${d.data().name}</b> <small>${d.data().contact}</small></div>`); }); }
window.addPartner = () => db.collection("partners").add({ name: document.getElementById('pt-name').value, contact: document.getElementById('pt-contact').value });
window.addNews = () => db.collection("news").add({ title: document.getElementById('news-title').value, body: document.getElementById('news-body').value }).then(() => alert("Posted"));
window.addIntel = () => db.collection("intel").add({ title: document.getElementById('intel-title').value, url: document.getElementById('intel-url').value }).then(() => alert("Added"));

// --- 15. PLAYBOOK ---
window.loadPlaybook = () => {
    const id = `${document.getElementById('pb-map').value}_${document.getElementById('pb-side').value}`;
    db.collection("playbooks").doc(id).get().then(d => document.getElementById('pb-text').value = d.exists ? d.data().text : "");
};
window.savePlaybook = () => {
    const id = `${document.getElementById('pb-map').value}_${document.getElementById('pb-side').value}`;
    db.collection("playbooks").doc(id).set({ text: document.getElementById('pb-text').value }).then(() => alert("Saved"));
};

// --- 16. COMPS ---
window.loadComp = () => {
    db.collection("comps").doc(document.getElementById('comp-map').value).get().then(d => {
        const ag = d.exists ? d.data().agents : [null, null, null, null, null];
        for (let i = 0; i < 5; i++) { document.getElementById(`cs-${i}`).innerHTML = ag[i] ? `<img src="${ag[i]}">` : '?'; document.getElementById(`cs-${i}`).dataset.img = ag[i] || ""; }
        document.getElementById('comp-display').innerHTML = ag.map(a => a ? `<img src="${a}" style="width:40px;border-radius:50%;">` : '').join('');
    });
};
window.editComp = i => { compSlotIndex = i; document.getElementById('comp-picker').style.display = 'block'; };
window.setCompSlot = u => { document.getElementById(`cs-${compSlotIndex}`).dataset.img = u; document.getElementById(`cs-${compSlotIndex}`).innerHTML = `<img src="${u}">`; document.getElementById('comp-picker').style.display = 'none'; };
window.saveComp = () => { const a = []; for (let i = 0; i < 5; i++) a.push(document.getElementById(`cs-${i}`).dataset.img); db.collection("comps").doc(document.getElementById('comp-map').value).set({ agents: a }).then(() => alert("Saved")); };

// --- 17. HEATMAP ---
function loadHeatmap() {
    db.collection("availabilities").onSnapshot(snap => {
        const counts = {};
        snap.forEach(doc => { (doc.data().slots || []).forEach(s => { for (let h = parseInt(s.start); h < parseInt(s.end); h++) counts[`${s.day}-${h}`] = (counts[`${s.day}-${h}`] || 0) + 1; }); });
        let html = "";
        CONSTANTS.DAYS.forEach(day => {
            let row = `<div class="heatmap-row"><span style="width:30px; font-size:0.6rem; color:#666;">${day.substring(0, 3)}</span>`;
            for (let h = 0; h < 24; h++) { const a = Math.min((counts[`${day}-${h}`] || 0) * 0.2, 1); row += `<div class="heat-bar" style="background:rgba(255,30,60,${a});"></div>`; }
            html += row + "</div>";
        });
        document.getElementById('avail-heatmap').innerHTML = html;
    });
}
window.saveAvail = () => {
    const ref = db.collection("availabilities").doc(currentUser.displayName);
    ref.get().then(doc => {
        let slots = doc.exists ? doc.data().slots : [];
        slots.push({ day: document.getElementById('av-day').value, start: document.getElementById('av-start').value, end: document.getElementById('av-end').value });
        ref.set({ slots }, { merge: true }).then(() => alert("Added"));
    });
};