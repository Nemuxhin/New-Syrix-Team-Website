// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const ADMIN_UIDS = ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"];
const MAPS = ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"];

let db, auth, currentUser;
let canvas, ctx, tool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null, currentRosterId = null;
let currentCompSlot = null; // For editing comps
let tempLineupX = 0, tempLineupY = 0, currentLineupId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') handleHubAuth(user);
        });

        if (document.body.id === 'page-home') loadLandingData();
        if (document.body.id === 'page-hub') {
            initStratbook();
            initAgentPickers(); // For Comps tab
        }
    }
});

// --- HELPER: FETCH AGENTS ---
async function getAgents() {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const json = await res.json();
    return json.data;
}

function initAgentPickers() {
    getAgents().then(agents => {
        // Stratbook Palette
        document.getElementById('agent-palette').innerHTML = agents.map(a =>
            `<img src="${a.displayIcon}" onclick="activeAgent='${a.displayIcon}'; tool='agent'" style="width:100%; cursor:pointer; border:1px solid #333;">`
        ).join('');

        // Comp Picker Palette
        document.getElementById('comp-agent-list').innerHTML = agents.map(a =>
            `<img src="${a.displayIcon}" onclick="window.selectCompAgent('${a.displayIcon}')" style="width:100%; cursor:pointer; border:1px solid #333;">`
        ).join('');
    });
}

// --- LANDING PAGE ---
function loadLandingData() {
    db.collection("events").orderBy("date").onSnapshot(snap => {
        const div = document.getElementById('landing-matches');
        if (div) {
            div.innerHTML = "";
            let wins = 0, total = 0;
            snap.forEach(doc => {
                const m = doc.data();
                if (m.result) {
                    total++;
                    if (parseInt(m.result.us) > parseInt(m.result.them)) wins++;
                } else if (m.date >= new Date().toISOString().split('T')[0]) {
                    div.innerHTML += `
                        <div class="newsCard">
                            <small style="color:var(--red); font-weight:900;">${m.date}</small>
                            <h3 style="margin: 10px 0;">VS ${m.opponent}</h3>
                            <p style="font-size:0.8rem; color:#888;">${m.map || 'TBD'}</p>
                        </div>`;
                }
            });
            // Update Stats Bar
            if (document.getElementById('stat-record')) document.getElementById('stat-record').innerText = `${wins}W - ${total - wins}L`;
            if (document.getElementById('stat-winrate')) document.getElementById('stat-winrate').innerText = total > 0 ? Math.round((wins / total) * 100) + "%" : "--%";
        }
    });

    db.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('landing-roster');
        if (div) {
            div.innerHTML = "";
            document.getElementById('stat-roster').innerText = snap.size;
            snap.forEach(doc => {
                const p = doc.data();
                div.innerHTML += `
                    <div class="roster-card">
                        <img src="${p.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}">
                        <div class="roster-info">
                            <h3>${doc.id}</h3>
                            <span>${p.role}</span>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- HUB AUTH & NAV ---
function handleHubAuth(user) {
    const lock = document.getElementById('hubLocked');
    const unlock = document.getElementById('hubUnlocked');
    const form = document.getElementById('app-form');
    const msg = document.getElementById('auth-status-text');
    const btns = document.getElementById('login-btns');

    if (!user) {
        lock.style.display = 'flex';
        unlock.style.display = 'none';
        return;
    }

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        if (!snap.empty || ADMIN_UIDS.includes(user.uid)) {
            lock.style.display = 'none';
            unlock.style.display = 'flex';
            document.getElementById('userProfile').innerText = user.displayName;
            if (ADMIN_UIDS.includes(user.uid)) document.querySelector('.admin-only').style.display = 'inline-block';

            // Load ALL Modules
            loadCaptainMsg();
            loadAbsences();
            loadDashboardEvents();
            loadMapVeto();
            loadEnemies();
            loadHubMatches();
            loadRosterList();
            loadComp(); // Initial Load
            changeLineupMap(); // Initial Load
            if (ADMIN_UIDS.includes(user.uid)) loadApps();
        } else {
            msg.innerText = `WELCOME ${user.displayName.toUpperCase()}. NOT ENLISTED.`;
            if (btns) btns.style.display = 'none';
            form.style.display = 'block';
        }
    });
}

window.loginWithDiscord = () => auth.signInWithPopup(new firebase.auth.OAuthProvider('oidc.discord'));

window.submitApplication = () => {
    const ign = document.getElementById('app-ign').value;
    const why = document.getElementById('app-why').value;
    if (!ign || !why) return alert("Fill all fields");

    db.collection("applications").add({
        user: ign, uid: currentUser.uid,
        rank: document.getElementById('app-rank').value,
        role: document.getElementById('app-role').value,
        tracker: document.getElementById('app-tracker').value,
        why: why, submittedAt: new Date().toISOString()
    }).then(() => {
        // Discord Webhook Logic
        const webhookURL = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";
        fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: `New App: ${ign}`, color: 16776960,
                    fields: [{ name: 'Rank', value: document.getElementById('app-rank').value }, { name: 'Role', value: document.getElementById('app-role').value }]
                }]
            })
        });
        alert("Application Submitted");
    });
};

window.setTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    if (id === 'stratbook' && canvas) { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
};

window.showTab = window.setTab; // Alias

// --- MODULE: COMPS ---
window.loadComp = () => {
    const map = document.getElementById('comp-map').value;
    db.collection("comps").doc(map).get().then(doc => {
        const agents = doc.exists ? doc.data().agents : [null, null, null, null, null];
        // Update Edit Slots
        for (let i = 0; i < 5; i++) {
            const slot = document.getElementById(`comp-slot-${i}`);
            slot.innerHTML = agents[i] ? `<img src="${agents[i]}" style="width:100%; height:100%; object-fit:cover;">` : '?';
            slot.dataset.img = agents[i] || "";
        }
        // Update Display Area
        const disp = document.getElementById('comp-display');
        disp.innerHTML = agents.map(a => a ? `<img src="${a}" style="width:50px; height:50px; border-radius:50%; border:2px solid #333;">` : '').join('');
    });
};

window.editCompSlot = (idx) => {
    currentCompSlot = idx;
    document.getElementById('comp-picker').style.display = 'block';
};

window.selectCompAgent = (url) => {
    if (currentCompSlot === null) return;
    const slot = document.getElementById(`comp-slot-${currentCompSlot}`);
    slot.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`;
    slot.dataset.img = url;
    document.getElementById('comp-picker').style.display = 'none';
};

window.saveComp = () => {
    const map = document.getElementById('comp-map').value;
    const agents = [];
    for (let i = 0; i < 5; i++) {
        agents.push(document.getElementById(`comp-slot-${i}`).dataset.img || null);
    }
    db.collection("comps").doc(map).set({ agents }).then(() => {
        alert("Comp Saved");
        window.loadComp(); // Refresh display
    });
};

// --- MODULE: LINEUPS ---
window.changeLineupMap = () => {
    const map = document.getElementById('luMapSelect').value;
    const img = document.getElementById('luMapImg');
    // Simple URL logic - ensure you have these maps hosted or use API
    img.src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`; // Fallback image for demo
    // Ideally use real map IDs

    // Load Pins
    db.collection("lineups").where("map", "==", map).onSnapshot(snap => {
        const container = document.getElementById('lineup-pins');
        container.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            const pin = document.createElement('div');
            pin.style = `position:absolute; left:${l.x}%; top:${l.y}%; width:15px; height:15px; background:red; border-radius:50%; border:2px solid white; cursor:pointer; transform:translate(-50%,-50%);`;
            pin.onclick = (e) => { e.stopPropagation(); window.viewLineup(doc.id, l); };
            container.appendChild(pin);
        });
    });
};

window.mapClickLineup = (e) => {
    const rect = document.getElementById('lineup-map-container').getBoundingClientRect();
    tempLineupX = ((e.clientX - rect.left) / rect.width) * 100;
    tempLineupY = ((e.clientY - rect.top) / rect.height) * 100;

    // Reset form
    document.getElementById('lu-title').value = "";
    document.getElementById('lu-url').value = "";
    document.getElementById('lu-desc').value = "";

    document.getElementById('lineup-form').style.display = 'block';
    document.getElementById('lineup-viewer').style.display = 'none';
};

window.saveLineup = () => {
    const title = document.getElementById('lu-title').value;
    if (!title) return alert("Title required");

    db.collection("lineups").add({
        map: document.getElementById('luMapSelect').value,
        x: tempLineupX, y: tempLineupY,
        title: title,
        url: document.getElementById('lu-url').value,
        desc: document.getElementById('lu-desc').value
    }).then(() => {
        document.getElementById('lineup-form').style.display = 'none';
        alert("Pin Added");
    });
};

window.viewLineup = (id, data) => {
    currentLineupId = id;
    document.getElementById('lineup-form').style.display = 'none';
    const viewer = document.getElementById('lineup-viewer');
    viewer.style.display = 'block';
    document.getElementById('view-lu-title').innerText = data.title;
    document.getElementById('view-lu-link').href = data.url || '#';
    document.getElementById('view-lu-desc').innerText = data.desc;
};

window.deleteLineup = () => {
    if (confirm("Delete pin?")) {
        db.collection("lineups").doc(currentLineupId).delete();
        document.getElementById('lineup-viewer').style.display = 'none';
    }
};

// --- MODULE: MAP VETO ---
function loadMapVeto() {
    db.collection("general").doc("map_veto").onSnapshot(doc => {
        const d = doc.data() || {};
        const g = document.getElementById('veto-grid');
        g.innerHTML = "";
        MAPS.forEach(m => {
            const s = d[m] || 'neutral'; // neutral, ban, pick
            g.innerHTML += `
                <div class="veto-card ${s}" onclick="window.toggleVeto('${m}', '${s}')" style="background-image: url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')">
                    <div class="veto-overlay">
                        <div><div>${m}</div><div style="font-size:0.6rem;">${s.toUpperCase()}</div></div>
                    </div>
                </div>`;
        });
    });
}
window.toggleVeto = (m, s) => {
    const n = s === 'neutral' ? 'ban' : (s === 'ban' ? 'pick' : 'neutral');
    db.collection("general").doc("map_veto").set({ [m]: n }, { merge: true });
};
window.resetVeto = () => db.collection("general").doc("map_veto").set({});

// --- MODULE: CAPTAIN MSG & ABSENCE (Basic) ---
function loadCaptainMsg() {
    db.collection("general").doc("captain_message").onSnapshot(d => { if (d.exists) document.getElementById('captain-msg-text').innerText = `"${d.data().text}"`; });
}
window.editCaptainMessage = () => document.getElementById('captain-msg-edit').style.display = 'block';
window.saveCaptainMessage = () => {
    db.collection("general").doc("captain_message").set({ text: document.getElementById('captain-msg-input').value }, { merge: true });
    document.getElementById('captain-msg-edit').style.display = 'none';
};

function loadAbsences() {
    db.collection("leaves").orderBy("start").onSnapshot(s => {
        const l = document.getElementById('absence-list');
        l.innerHTML = "";
        s.forEach(d => l.innerHTML += `<div><b style="color:#ff1e3c">${d.data().user}</b>: ${d.data().start}</div>`);
    });
}
window.logAbsence = () => {
    db.collection("leaves").add({
        user: currentUser.displayName, start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value, reason: document.getElementById('abs-reason').value
    }).then(() => alert("Logged"));
};

// --- MODULE: MATCHES & DASHBOARD EVENTS ---
function loadDashboardEvents() {
    const today = new Date().toISOString().split('T')[0];
    db.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
        const list = document.getElementById('dash-event-list');
        list.innerHTML = "";
        document.getElementById('active-ops-badge').innerText = `${snap.size} ACTIVE`;
        document.getElementById('stat-ops').innerText = snap.size;

        if (snap.empty) list.innerHTML = `<div class="empty-state">No upcoming operations.</div>`;
        snap.forEach(doc => {
            const m = doc.data();
            list.innerHTML += `<div class="list-item"><b>VS ${m.opponent}</b> <small>${m.date} ${m.time || ''}</small></div>`;
        });
    });
}

function loadHubMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const list = document.getElementById('match-list');
        list.innerHTML = "";
        let wins = 0, total = 0;
        snap.forEach(doc => {
            const m = doc.data();
            if (m.result) { total++; if (parseInt(m.result.us) > parseInt(m.result.them)) wins++; }
            list.innerHTML += `
                <div class="list-item">
                    <div><b>VS ${m.opponent}</b> <small>${m.map}</small> ${m.result ? `(${m.result.us}-${m.result.them})` : ''}</div>
                    <button style="color:red; background:none; border:none; cursor:pointer;" onclick="window.delMatch('${doc.id}')">✕</button>
                </div>`;
        });
        document.getElementById('dash-winrate').innerText = total > 0 ? Math.round((wins / total) * 100) + "%" : "0%";
    });
}
window.addMatch = () => {
    const res = document.getElementById('m-us').value;
    db.collection("events").add({
        opponent: document.getElementById('m-opp').value, date: document.getElementById('m-date').value,
        map: document.getElementById('m-map').value, result: res ? { us: res, them: document.getElementById('m-them').value } : null
    }).then(() => alert("Added"));
};
window.delMatch = id => { if (confirm("Delete?")) db.collection("events").doc(id).delete(); };

// --- MODULE: WAR ROOM ---
function loadEnemies() {
    db.collection("war_room").onSnapshot(s => {
        const l = document.getElementById('enemy-list');
        l.innerHTML = "";
        s.forEach(d => l.innerHTML += `<div class="list-item" onclick="openEnemy('${d.id}')" style="cursor:pointer"><b>${d.data().name}</b></div>`);
    });
}
window.newEnemy = () => { const n = prompt("Team Name:"); if (n) db.collection("war_room").add({ name: n, notes: "" }); };
window.openEnemy = id => {
    currentEnemyId = id;
    db.collection("war_room").doc(id).get().then(d => {
        document.getElementById('wr-title').innerText = d.data().name;
        document.getElementById('wr-notes').value = d.data().notes;
        document.getElementById('wr-content').style.display = 'block';
    });
};
window.saveIntel = () => db.collection("war_room").doc(currentEnemyId).update({ notes: document.getElementById('wr-notes').value }).then(() => alert("Intel Saved"));
window.deleteEnemy = () => db.collection("war_room").doc(currentEnemyId).delete().then(() => document.getElementById('wr-content').style.display = 'none');

// --- MODULE: STRATBOOK ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.onmousedown = e => {
        if (tool === 'draw') { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); }
        else if (tool === 'agent' && activeAgent) { const i = new Image(); i.src = activeAgent; i.crossOrigin = "anonymous"; i.onload = () => ctx.drawImage(i, e.offsetX - 15, e.offsetY - 15, 30, 30); }
    };
    canvas.onmousemove = e => { if (!isDrawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.strokeStyle = document.getElementById('vpColor').value; ctx.lineWidth = 3; ctx.stroke(); };
    window.onmouseup = () => isDrawing = false;
}
window.changeMap = () => {
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};
window.clearPlanner = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.saveStratToDB = () => alert("Saved to Cloud");

// --- MODULE: ROSTER & ADMIN ---
function loadRosterList() {
    db.collection("roster").onSnapshot(s => {
        const l = document.getElementById('roster-list-edit');
        l.innerHTML = "";
        s.forEach(d => l.innerHTML += `<div class="list-item" onclick="window.editRoster('${doc.id}')" style="cursor:pointer;">${doc.id} <span style="font-size:0.7rem;">${doc.data().role}</span></div>`);
    });
}
window.editRoster = id => {
    currentRosterId = id;
    document.getElementById('r-id').value = id;
    document.getElementById('roster-edit-form').style.display = 'block';
};
window.saveRosterProfile = () => {
    db.collection("roster").doc(currentRosterId).update({
        role: document.getElementById('r-role').value,
        pfp: document.getElementById('r-pfp').value
    }).then(() => alert("Updated"));
};

function loadApps() {
    db.collection("applications").onSnapshot(s => {
        const l = document.getElementById('admin-list');
        l.innerHTML = "";
        s.forEach(d => l.innerHTML += `
            <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                <div><b>${d.data().user}</b> <small>${d.data().rank}</small></div>
                <i>"${d.data().why}"</i>
                <div style="margin-top:5px;"><button class="btn-xs" style="background:green" onclick="acceptApp('${d.id}','${d.data().user}','${d.data().uid}')">ACCEPT</button> <button class="btn-xs" style="background:red" onclick="rejectApp('${d.id}')">REJECT</button></div>
            </div>`);
    });
}
window.acceptApp = (id, user, uid) => {
    db.collection("roster").doc(user).set({ uid: uid, role: "Tryout", rank: "Unranked", joined: new Date().toISOString() }).then(() => db.collection("applications").doc(id).delete());
};
window.rejectApp = id => db.collection("applications").doc(id).delete();