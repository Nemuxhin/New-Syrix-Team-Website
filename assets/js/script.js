/**
 * SYRIX ESPORTS - CENTRAL LOGIC KERNEL v6.0
 * DATABASE TARGET: Schedule/fw3Kmjdedt0auIH9O3Kp
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
    // YOUR SPECIFIC DATABASE PATH
    ROOT_COLLECTION: "Schedule",
    ROOT_DOC_ID: "fw3Kmjdedt0auIH9O3Kp",

    ADMIN_UIDS: [
        "M9FzRywhRIdUveh5JKUfQgJtlIB3",
        "SiPLxB20VzVGBZL3rTM42FsgEy52",
        "pmXgTX5dxbVns0nnO54kl1BR07A3"
    ],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

let db, auth, currentUser;
let rootRef; // This will hold the reference to your specific folder
let canvas, ctx, currentTool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null, currentRosterId = null, compSlotIndex = null;
let tempLineupX = 0, tempLineupY = 0, currentLineupId = null;

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();

            // POINT TO YOUR SPECIFIC DOCUMENT
            rootRef = db.collection(CONSTANTS.ROOT_COLLECTION).doc(CONSTANTS.ROOT_DOC_ID);

            console.log(`System: Linked to ${CONSTANTS.ROOT_COLLECTION}/${CONSTANTS.ROOT_DOC_ID}`);
        } catch (e) { console.error("Firebase Error", e); }

        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') handleHubAuth(user);
        });

        if (document.body.id === 'page-home') loadLandingData();
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

        const stratPal = document.getElementById('agent-palette');
        const compPal = document.getElementById('comp-agent-list');

        if (stratPal) stratPal.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.prepAgent('${a.displayIcon}')">`).join('');
        if (compPal) compPal.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.setCompSlot('${a.displayIcon}')">`).join('');
    } catch (e) { console.error("Asset API Error", e); }
}

// --- 4. LANDING PAGE RENDERER ---
function loadLandingData() {
    // Use rootRef.collection() instead of db.collection()
    rootRef.collection("events").orderBy("date").onSnapshot(snap => {
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
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            const rec = document.getElementById('stat-record');
            if (rec) {
                rec.innerText = `${wins}W - ${total - wins}L`;
                document.getElementById('stat-winrate').innerText = `${wr}%`;
            }
        }
    });

    rootRef.collection("roster").onSnapshot(snap => {
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

    // Check Permissions inside your specific folder
    rootRef.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        const isAdmin = CONSTANTS.ADMIN_UIDS.includes(user.uid);
        const isRoster = !snap.empty;

        if (isRoster || isAdmin) {
            screens.locked.style.display = 'none';
            screens.unlocked.style.display = 'flex';
            document.getElementById('user-name').innerText = user.displayName.toUpperCase();

            if (isAdmin) {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
                document.getElementById('user-role').innerText = "ADMINISTRATOR";
                loadApps();
            }

            // Load All Modules
            loadCaptainMsg(); loadAbsences(); loadDashboardEvents(); loadWarRoom(); loadMapVeto(); loadHubMatches(); loadRosterList(); loadComp(); changeLineupMap(); loadHeatmap(); loadPlaybook(); loadPartners();

        } else {
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

    rootRef.collection("applications").add(data).then(() => {
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
    if (id === 'stratbook' && canvas) { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
};

// --- 6. MODULE: DASHBOARD ---
function loadCaptainMsg() {
    rootRef.collection("general").doc("captain_message").onSnapshot(doc => {
        if (doc.exists) document.getElementById('capt-msg').innerText = `"${doc.data().text}"`;
    });
}
window.editMsg = () => document.getElementById('capt-edit').style.display = 'block';
window.saveMsg = () => {
    rootRef.collection("general").doc("captain_message").set({ text: document.getElementById('capt-input').value }, { merge: true });
    document.getElementById('capt-edit').style.display = 'none';
};

function loadAbsences() {
    rootRef.collection("leaves").orderBy("start").onSnapshot(snap => {
        const div = document.getElementById('abs-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            div.innerHTML += `
                <div class="list-item" style="font-size:0.8rem;">
                    <div><b class="text-red">${l.user}</b>: ${l.start}</div>
                    <button onclick="window.delAbsence('${doc.id}')" style="color:red; background:none; border:none;">x</button>
                </div>`;
        });
    });
}
window.logAbsence = () => {
    rootRef.collection("leaves").add({
        user: currentUser.displayName,
        start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value,
        reason: document.getElementById('abs-reason').value
    }).then(() => alert("Logged."));
};
window.delAbsence = (id) => rootRef.collection("leaves").doc(id).delete();

function loadHeatmap() {
    rootRef.collection("availabilities").onSnapshot(snap => {
        const counts = {};
        snap.forEach(doc => {
            const slots = doc.data().slots || [];
            slots.forEach(slot => {
                const startH = parseInt(slot.start.split(':')[0]);
                const endH = parseInt(slot.end.split(':')[0]);
                for (let h = startH; h < endH; h++) {
                    const key = `${slot.day}-${h}`;
                    counts[key] = (counts[key] || 0) + 1;
                }
            });
        });

        let html = "";
        CONSTANTS.DAYS.forEach(day => {
            let row = `<div class="heatmap-row" style="display:flex; gap:2px; margin-bottom:2px;"><span style="width:30px; font-size:0.6rem; color:#666;">${day.substring(0, 3)}</span>`;
            for (let h = 0; h < 24; h++) {
                const count = counts[`${day}-${h}`] || 0;
                const alpha = Math.min(count * 0.2, 1);
                row += `<div style="flex:1; height:15px; background:rgba(255,30,60,${alpha}); border-radius:2px; box-shadow:inset 0 0 0 1px #111;" title="${day} ${h}:00"></div>`;
            }
            row += "</div>";
            html += row;
        });
        document.getElementById('avail-heatmap').innerHTML = html;
    });
}
window.saveAvail = () => {
    const ref = rootRef.collection("availabilities").doc(currentUser.displayName);
    const newSlot = {
        day: document.getElementById('avail-day').value,
        start: document.getElementById('avail-start').value,
        end: document.getElementById('avail-end').value
    };

    ref.get().then(doc => {
        let slots = doc.exists ? doc.data().slots : [];
        slots.push(newSlot);
        ref.set({ slots }, { merge: true }).then(() => alert("Availability Added"));
    });
};

function loadDashboardEvents() {
    const today = new Date().toISOString().split('T')[0];
    rootRef.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
        const div = document.getElementById('dash-events');
        div.innerHTML = "";
        document.getElementById('ops-badge').innerText = `${snap.size} ACTIVE`;
        document.getElementById('stat-ops').innerText = snap.size;

        if (snap.empty) div.innerHTML = "<div class='list-item' style='justify-content:center; color:#555;'>No Operations</div>";

        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `<div class="list-item"><div><b>VS ${m.opponent}</b> <br><small>${m.date} ${m.time || ''}</small></div></div>`;
        });
    });
}

// --- 7. MODULE: STRATBOOK ---
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
window.prepAgent = url => { activeAgent = url; currentTool = 'agent'; };
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.changeMap = () => { document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`; window.clearStrat(); };
window.saveStrat = () => {
    const data = canvas.toDataURL();
    rootRef.collection("strats").add({
        author: currentUser.displayName,
        map: document.getElementById('vpMapSelect').value,
        img: data,
        date: new Date().toISOString()
    }).then(() => alert("Strat Saved to Cloud"));
};

// --- 8. MODULE: COMPS ---
window.loadComp = () => {
    const map = document.getElementById('comp-map').value;
    rootRef.collection("comps").doc(map).get().then(doc => {
        const agents = doc.exists ? doc.data().agents : [null, null, null, null, null];
        for (let i = 0; i < 5; i++) {
            const slot = document.getElementById(`cs-${i}`);
            slot.innerHTML = agents[i] ? `<img src="${agents[i]}">` : '?';
            slot.dataset.img = agents[i] || "";
        }
        document.getElementById('comp-display').innerHTML = agents.map(a => a ? `<img src="${a}" style="width:50px; border-radius:50%;">` : '').join('');
    });
};
window.editComp = idx => { compSlotIndex = idx; document.getElementById('comp-picker').style.display = 'block'; };
window.setCompSlot = url => {
    if (compSlotIndex === null) return;
    const slot = document.getElementById(`cs-${compSlotIndex}`);
    slot.innerHTML = `<img src="${url}">`; slot.dataset.img = url;
    document.getElementById('comp-picker').style.display = 'none';
};
window.saveComp = () => {
    const agents = [];
    for (let i = 0; i < 5; i++) agents.push(document.getElementById(`cs-${i}`).dataset.img || null);
    rootRef.collection("comps").doc(document.getElementById('comp-map').value).set({ agents }).then(() => { alert("Loadout Saved"); window.loadComp(); });
};

// --- 9. MODULE: MATCHES ---
function loadHubMatches() {
    rootRef.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const div = document.getElementById('match-list');
        div.innerHTML = "";
        let wins = 0, total = 0;
        snap.forEach(doc => {
            const m = doc.data();
            if (m.result) { total++; if (parseInt(m.result.us) > parseInt(m.result.them)) wins++; }
            div.innerHTML += `
                <div class="list-item">
                    <div><b>VS ${m.opponent}</b> <small>${m.map}</small> ${m.result ? `<span class="${parseInt(m.result.us) > parseInt(m.result.them) ? 'text-green' : 'text-red'}">(${m.result.us}-${m.result.them})</span>` : ''}</div>
                    ${CONSTANTS.ADMIN_UIDS.includes(currentUser.uid) ? `<button class="btn-xs danger" onclick="window.delMatch('${doc.id}')">X</button>` : ''}
                </div>`;
        });
        document.getElementById('stat-win').innerText = total > 0 ? Math.round((wins / total) * 100) + "%" : "0%";
    });
}
window.addMatch = () => {
    const res = document.getElementById('m-us').value;
    rootRef.collection("events").add({
        opponent: document.getElementById('m-opp').value, date: document.getElementById('m-date').value,
        map: document.getElementById('m-map').value,
        result: res ? { us: res, them: document.getElementById('m-them').value } : null
    }).then(() => alert("Logged"));
};
window.delMatch = id => { if (confirm("Delete?")) rootRef.collection("events").doc(id).delete(); };

// --- 10. MODULE: WAR ROOM ---
function loadEnemies() {
    rootRef.collection("war_room").onSnapshot(snap => {
        const div = document.getElementById('enemy-list');
        div.innerHTML = "";
        snap.forEach(doc => div.innerHTML += `<div class="list-item" onclick="window.openEnemy('${doc.id}')" style="cursor:pointer;"><b>${doc.data().name}</b></div>`);
    });
}
window.newEnemy = () => { const n = prompt("Name:"); if (n) rootRef.collection("war_room").add({ name: n, notes: "" }); };
window.openEnemy = id => {
    currentEnemyId = id;
    rootRef.collection("war_room").doc(id).get().then(doc => {
        document.getElementById('wr-title').innerText = doc.data().name;
        document.getElementById('wr-notes').value = doc.data().notes;
        document.getElementById('wr-content').style.display = 'flex';
    });
};
window.saveIntel = () => rootRef.collection("war_room").doc(currentEnemyId).update({ notes: document.getElementById('wr-notes').value }).then(() => alert("Saved"));
window.deleteEnemy = () => rootRef.collection("war_room").doc(currentEnemyId).delete().then(() => document.getElementById('wr-content').style.display = 'none');

// --- 11. MODULE: ROSTER ---
function loadRosterList() {
    rootRef.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('roster-list-mgr');
        div.innerHTML = "";
        snap.forEach(doc => div.innerHTML += `<div class="list-item" onclick="window.editRoster('${doc.id}')" style="cursor:pointer;">${doc.id} <span class="badge">${doc.data().role}</span></div>`);
    });
}
window.editRoster = id => {
    currentRosterId = id;
    document.getElementById('r-id').value = id;
    document.getElementById('roster-editor').style.display = 'block';
};
window.saveProfile = () => {
    rootRef.collection("roster").doc(currentRosterId).update({
        role: document.getElementById('r-role').value, pfp: document.getElementById('r-pfp').value
    }).then(() => alert("Profile Updated"));
};

// --- 12. MODULE: MAP VETO ---
function loadMapVeto() {
    rootRef.collection("general").doc("veto").onSnapshot(doc => {
        const data = doc.data() || {};
        const grid = document.getElementById('veto-grid');
        grid.innerHTML = "";
        CONSTANTS.MAPS.forEach(map => {
            const status = data[map] || 'neutral';
            grid.innerHTML += `
                <div class="veto-card ${status}" onclick="window.toggleVeto('${map}', '${status}')" style="background-image:url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')">
                    <div class="veto-overlay"><div>${map}</div><div style="font-size:0.7rem;">${status}</div></div>
                </div>`;
        });
    });
}
window.toggleVeto = (map, current) => {
    const next = current === 'neutral' ? 'ban' : (current === 'ban' ? 'pick' : 'neutral');
    rootRef.collection("general").doc("veto").set({ [map]: next }, { merge: true });
};
window.resetVeto = () => {
    if (confirm("Reset Board?")) rootRef.collection("general").doc("veto").set({});
};

// --- 13. MODULE: PLAYBOOK ---
window.loadPlaybook = () => {
    const map = document.getElementById('pb-map').value;
    const side = document.getElementById('pb-side').value;
    rootRef.collection("playbooks").doc(`${map}_${side}`).get().then(doc => {
        document.getElementById('pb-text').value = doc.exists ? doc.data().text : "";
    });
};
window.savePlaybook = () => {
    const map = document.getElementById('pb-map').value;
    const side = document.getElementById('pb-side').value;
    rootRef.collection("playbooks").doc(`${map}_${side}`).set({
        text: document.getElementById('pb-text').value
    }).then(() => alert("Saved"));
};

// --- 14. MODULE: LINEUPS ---
window.changeLineupMap = () => {
    const map = document.getElementById('luMapSelect').value;
    document.getElementById('luMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    rootRef.collection("lineups").where("map", "==", map).onSnapshot(snap => {
        const container = document.getElementById('lineup-pins');
        container.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            const pin = document.createElement('div');
            pin.className = "pin"; pin.style.left = `${l.x}%`; pin.style.top = `${l.y}%`;
            pin.onclick = (e) => { e.stopPropagation(); window.viewLineup(doc.id, l); };
            container.appendChild(pin);
        });
    });
};
window.mapClickLineup = (e) => {
    const rect = document.getElementById('lu-map-wrap').getBoundingClientRect();
    tempLineupX = ((e.clientX - rect.left) / rect.width) * 100;
    tempLineupY = ((e.clientY - rect.top) / rect.height) * 100;
    document.getElementById('lineup-form').style.display = 'block';
    document.getElementById('lineup-viewer').style.display = 'none';
};
window.saveLineup = () => {
    rootRef.collection("lineups").add({
        map: document.getElementById('luMapSelect').value, x: tempLineupX, y: tempLineupY,
        title: document.getElementById('lu-title').value, url: document.getElementById('lu-url').value, desc: document.getElementById('lu-desc').value
    }).then(() => { document.getElementById('lineup-form').style.display = 'none'; alert("Saved"); });
};
window.viewLineup = (id, data) => {
    currentLineupId = id;
    document.getElementById('lineup-form').style.display = 'none';
    document.getElementById('lineup-viewer').style.display = 'block';
    document.getElementById('view-lu-title').innerText = data.title;
    document.getElementById('view-lu-link').href = data.url;
    document.getElementById('view-lu-desc').innerText = data.desc;
};
window.deleteLineup = () => {
    if (confirm("Delete?")) rootRef.collection("lineups").doc(currentLineupId).delete().then(() => document.getElementById('lineup-viewer').style.display = 'none');
};

// --- 15. MODULE: PARTNERS ---
function loadPartners() {
    rootRef.collection("partners").onSnapshot(snap => {
        const div = document.getElementById('partner-list');
        if (div) {
            div.innerHTML = "";
            snap.forEach(doc => div.innerHTML += `<div class="list-item"><b>${doc.data().name}</b> <small>${doc.data().contact}</small></div>`);
        }
    });
}
window.addPartner = () => {
    rootRef.collection("partners").add({ name: document.getElementById('partner-name').value, contact: document.getElementById('partner-contact').value });
};

// --- 16. MODULE: ADMIN APPS ---
function loadApps() {
    rootRef.collection("applications").onSnapshot(snap => {
        const div = document.getElementById('admin-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const a = doc.data();
            div.innerHTML += `
                <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                    <div><b>${a.user}</b> <small>${a.rank}</small></div>
                    <i>"${a.why}"</i>
                    <div style="width:100%; display:flex; gap:5px; margin-top:5px;">
                        <button class="btn-xs primary" style="background:green;" onclick="window.decideApp('${doc.id}','${a.user}','${a.uid}',true)">ACCEPT</button>
                        <button class="btn-xs danger" onclick="window.decideApp('${doc.id}',null,null,false)">REJECT</button>
                    </div>
                </div>`;
        });
    });
}
window.decideApp = (id, user, uid, accept) => {
    if (accept) {
        rootRef.collection("roster").doc(user).set({ uid, role: "Tryout", rank: "Unranked" }).then(() => rootRef.collection("applications").doc(id).delete());
    } else {
        if (confirm("Reject?")) rootRef.collection("applications").doc(id).delete();
    }
};