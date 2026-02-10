/**
 * SYRIX ESPORTS - CENTRAL LOGIC KERNEL
 * Version 3.0 (Heavy Duty)
 */

// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const CONSTANTS = {
    ADMIN_UIDS: ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

// Global State
let db, auth, currentUser;
let canvas, ctx, currentTool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null, currentRosterId = null, compSlotIndex = null;

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            console.log("System: Firebase Linked.");
        } catch (e) { console.error("Firebase Error", e); }

        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') handleHubAuth(user);
        });

        if (document.body.id === 'page-home') initLandingPage();
        if (document.body.id === 'page-hub') {
            initStratbook();
            fetchAgents();
        }
    }
});

// --- 3. HELPER: FETCH ASSETS ---
async function fetchAgents() {
    try {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        const agents = json.data;

        // Populate Stratbook Palette
        const stratPal = document.getElementById('agent-palette');
        if (stratPal) {
            stratPal.innerHTML = agents.map(a =>
                `<img src="${a.displayIcon}" onclick="window.prepAgent('${a.displayIcon}')">`
            ).join('');
        }

        // Populate Comp Picker
        const compPal = document.getElementById('comp-agent-list');
        if (compPal) {
            compPal.innerHTML = agents.map(a =>
                `<img src="${a.displayIcon}" onclick="window.setCompSlot('${a.displayIcon}')">`
            ).join('');
        }
    } catch (e) { console.error("Asset API Error", e); }
}

// --- 4. LANDING PAGE RENDERER ---
function initLandingPage() {
    // Matches
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
                        <div class="match-card-landing">
                            <span class="match-date">${m.date} // ${m.time || 'TBD'}</span>
                            <div class="match-versus">VS ${m.opponent}</div>
                            <div class="match-meta">${m.map || 'TBD'} • ${m.type || 'Match'}</div>
                        </div>`;
                }
            });
            // Stats
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            const rec = document.getElementById('stat-record');
            if (rec) {
                rec.innerText = `${wins}W - ${total - wins}L`;
                document.getElementById('stat-winrate').innerText = `${wr}%`;
            }
        }
    });

    // Roster
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

// --- 5. HUB AUTHENTICATION ---
function handleHubAuth(user) {
    const screens = {
        locked: document.getElementById('hubLocked'),
        unlocked: document.getElementById('hubUnlocked'),
        appForm: document.getElementById('app-module'),
        login: document.getElementById('login-module'),
        status: document.getElementById('auth-status')
    };

    if (!user) {
        screens.locked.style.display = 'flex';
        screens.unlocked.style.display = 'none';
        return;
    }

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        if (!snap.empty || CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
            // Authorized
            screens.locked.style.display = 'none';
            screens.unlocked.style.display = 'flex';
            document.getElementById('user-name').innerText = user.displayName.toUpperCase();

            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
                document.querySelector('.admin-only').style.display = 'inline-block';
                document.getElementById('user-role').innerText = "ADMINISTRATOR";
            }

            // Load Data
            loadCaptainMsg();
            loadAbsences();
            loadDashboardEvents();
            loadWarRoom();
            loadMapVeto();
            loadHubMatches();
            loadRosterList();
            loadComp(); // Initial Load
            if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) loadApps();

        } else {
            // Unauth
            screens.status.innerText = `ID: ${user.displayName.toUpperCase()} // NOT ENLISTED`;
            screens.login.style.display = 'none';
            screens.appForm.style.display = 'block';
        }
    });
}

window.loginDiscord = () => auth.signInWithPopup(new firebase.auth.OAuthProvider('oidc.discord'));

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

    if (!data.user || !data.why) return alert("Required fields missing.");

    db.collection("applications").add(data).then(() => {
        // Webhook
        fetch(CONSTANTS.WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: `New App: ${data.user}`,
                    color: 16711680,
                    fields: [{ name: 'Rank', value: data.rank }, { name: 'Role', value: data.role }]
                }]
            })
        });
        alert("Application Transmitted.");
    });
};

window.setTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    if (id === 'stratbook' && canvas) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
};

// --- 6. MODULE: DASHBOARD ---
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

function loadAbsences() {
    db.collection("leaves").orderBy("start").onSnapshot(snap => {
        const div = document.getElementById('abs-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            div.innerHTML += `<div class="list-item" style="font-size:0.8rem;"><div><b class="text-red">${l.user}</b></div><div>${l.start}</div></div>`;
        });
    });
}
window.logAbsence = () => {
    db.collection("leaves").add({
        user: currentUser.displayName,
        start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value,
        reason: document.getElementById('abs-reason').value
    }).then(() => alert("Logged."));
};

function loadDashboardEvents() {
    const today = new Date().toISOString().split('T')[0];
    db.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
        const div = document.getElementById('dash-events');
        div.innerHTML = "";
        document.getElementById('ops-badge').innerText = `${snap.size} ACTIVE`;
        document.getElementById('stat-ops').innerText = snap.size;

        if (snap.empty) div.innerHTML = "<div class='list-item' style='justify-content:center; color:#555;'>No Operations</div>";

        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `
                <div class="list-item">
                    <div style="font-weight:bold;">VS ${m.opponent}</div>
                    <div style="font-size:0.8rem; color:#888;">${m.date} ${m.time || ''}</div>
                </div>`;
        });
    });
}

// --- 7. MODULE: STRATBOOK ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Listeners
    canvas.onmousedown = e => {
        if (currentTool === 'draw') {
            isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        } else if (currentTool === 'agent' && activeAgent) {
            const img = new Image();
            img.src = activeAgent;
            img.crossOrigin = "anonymous";
            img.onload = () => ctx.drawImage(img, e.offsetX - 20, e.offsetY - 20, 40, 40);
        }
    };
    canvas.onmousemove = e => {
        if (!isDrawing) return;
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 3;
        ctx.stroke();
    };
    window.onmouseup = () => isDrawing = false;
}
window.prepAgent = url => { activeAgent = url; currentTool = 'agent'; };
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.changeMap = () => {
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    window.clearStrat();
};
window.saveStrat = () => alert("Strategy Snapshot Saved to Cloud (Simulation)");

// --- 8. MODULE: COMPS ---
window.loadComp = () => {
    const map = document.getElementById('comp-map').value;
    db.collection("comps").doc(map).get().then(doc => {
        const agents = doc.exists ? doc.data().agents : [null, null, null, null, null];

        // Update Slots
        for (let i = 0; i < 5; i++) {
            const slot = document.getElementById(`cs-${i}`);
            slot.innerHTML = agents[i] ? `<img src="${agents[i]}">` : '?';
            slot.dataset.img = agents[i] || "";
        }

        // Update Display
        document.getElementById('comp-display').innerHTML = agents.map(a => a ? `<img src="${a}" style="width:50px; border-radius:50%;">` : '').join('');
    });
};
window.editComp = idx => {
    compSlotIndex = idx;
    document.getElementById('comp-picker').style.display = 'block';
};
window.setCompSlot = url => {
    if (compSlotIndex === null) return;
    const slot = document.getElementById(`cs-${compSlotIndex}`);
    slot.innerHTML = `<img src="${url}">`;
    slot.dataset.img = url;
    document.getElementById('comp-picker').style.display = 'none';
};
window.saveComp = () => {
    const agents = [];
    for (let i = 0; i < 5; i++) agents.push(document.getElementById(`cs-${i}`).dataset.img || null);
    db.collection("comps").doc(document.getElementById('comp-map').value).set({ agents }).then(() => {
        alert("Loadout Saved");
        window.loadComp();
    });
};

// --- 9. MODULE: MATCHES ---
function loadHubMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const div = document.getElementById('match-list');
        div.innerHTML = "";
        let wins = 0, total = 0;
        snap.forEach(doc => {
            const m = doc.data();
            if (m.result) { total++; if (parseInt(m.result.us) > parseInt(m.result.them)) wins++; }
            div.innerHTML += `
                <div class="list-item">
                    <div><b>VS ${m.opponent}</b> <small>${m.map}</small> ${m.result ? `<span class="${parseInt(m.result.us) > parseInt(m.result.them) ? 'text-green' : 'text-red'}">(${m.result.us}-${m.result.them})</span>` : ''}</div>
                    <button class="btn-xs danger" onclick="window.delMatch('${doc.id}')">X</button>
                </div>`;
        });
        document.getElementById('stat-win').innerText = total > 0 ? Math.round((wins / total) * 100) + "%" : "0%";
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

// --- 10. MODULE: WAR ROOM ---
function loadWarRoom() {
    db.collection("war_room").onSnapshot(snap => {
        const div = document.getElementById('enemy-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            div.innerHTML += `<div class="list-item" onclick="window.openEnemy('${doc.id}')" style="cursor:pointer;"><b>${doc.data().name}</b></div>`;
        });
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

// --- 11. MODULE: ROSTER ---
function loadRosterList() {
    db.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('roster-list-mgr');
        div.innerHTML = "";
        snap.forEach(doc => {
            div.innerHTML += `<div class="list-item" onclick="window.editRoster('${doc.id}')" style="cursor:pointer;">${doc.id} <span class="badge">${doc.data().role}</span></div>`;
        });
    });
}
window.editRoster = id => {
    currentRosterId = id;
    document.getElementById('r-id').value = id;
    document.getElementById('roster-editor').style.display = 'block';
};
window.saveProfile = () => {
    db.collection("roster").doc(currentRosterId).update({
        role: document.getElementById('r-role').value, pfp: document.getElementById('r-pfp').value
    }).then(() => alert("Profile Updated"));
};

// --- 12. MODULE: MAP VETO ---
function loadMapVeto() {
    db.collection("general").doc("veto").onSnapshot(doc => {
        const data = doc.data() || {};
        const div = document.getElementById('veto-grid');
        div.innerHTML = "";
        CONSTANTS.MAPS.forEach(m => {
            const s = data[m] || 'neutral';
            div.innerHTML += `
                <div class="veto-card ${s}" onclick="window.toggleVeto('${m}', '${s}')" style="background-image:url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png'); background-size:cover;">
                    <div class="veto-overlay">
                        <div>${m}</div><div style="font-size:0.7rem;">${s}</div>
                    </div>
                </div>`;
        });
    });
}
window.toggleVeto = (m, s) => {
    const next = s === 'neutral' ? 'ban' : (s === 'ban' ? 'pick' : 'neutral');
    db.collection("general").doc("veto").set({ [m]: next }, { merge: true });
};
window.resetVeto = () => db.collection("general").doc("veto").set({});

// --- 13. MODULE: ADMIN ---
function loadApps() {
    db.collection("applications").onSnapshot(snap => {
        const div = document.getElementById('admin-list');
        div.innerHTML = "";
        if (snap.empty) div.innerHTML = "<div style='color:#555; text-align:center; padding:20px;'>No Pending Applications</div>";
        snap.forEach(doc => {
            const a = doc.data();
            div.innerHTML += `
                <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                    <div><b>${a.user}</b> <small>${a.rank}</small></div>
                    <div style="font-style:italic; margin:5px 0;">"${a.why}"</div>
                    <div style="width:100%; display:flex; gap:5px;">
                        <button class="btn-xs" style="flex:1; background:green;" onclick="window.decideApp('${doc.id}','${a.user}','${a.uid}',true)">ACCEPT</button>
                        <button class="btn-xs" style="flex:1; background:red;" onclick="window.decideApp('${doc.id}',null,null,false)">REJECT</button>
                    </div>
                </div>`;
        });
    });
}
window.decideApp = (id, user, uid, accept) => {
    if (accept) {
        db.collection("roster").doc(user).set({ uid, role: "Tryout", rank: "Unranked" }).then(() => db.collection("applications").doc(id).delete());
    } else {
        if (confirm("Reject?")) db.collection("applications").doc(id).delete();
    }
};