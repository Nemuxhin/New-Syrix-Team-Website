// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const ADMIN_UIDS = ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"];
let db, auth, currentUser;

// Canvas State
let canvas, ctx, isDrawing = false;
let currentTool = 'draw';
let activeAgent = null;

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        // Auth Listener
        auth.onAuthStateChanged(user => {
            currentUser = user;
            const pageId = document.body.id;
            if (pageId === 'page-hub') handleHubAuth(user);
        });

        // Page Logic
        if (document.body.id === 'page-home') initLandingPage();
        if (document.body.id === 'page-hub') initStratbook(); // Init canvas logic immediately
    }
});

// --- 3. LANDING PAGE LOGIC ---
function initLandingPage() {
    // Scroll Reveal
    const runReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', runReveal);
    runReveal();

    // Load Roster
    db.collection("roster").onSnapshot(snap => {
        const grid = document.getElementById('landing-roster-grid');
        grid.innerHTML = "";
        let count = 0;

        snap.forEach(doc => {
            const p = doc.data();
            count++;
            // Sort priority: Head Coach > Captain > Main > Sub
            grid.innerHTML += `
                <div class="roster-card">
                    <img src="${p.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}" alt="${doc.id}">
                    <div class="roster-info">
                        <h3>${doc.id}</h3>
                        <span>${p.role || 'Member'}</span>
                        <div style="font-size: 0.8rem; color: #ccc;">${p.rank || 'Unranked'}</div>
                    </div>
                </div>
            `;
        });

        document.getElementById('stat-roster').innerText = count;
    });

    // Load Matches (Future only)
    db.collection("events").orderBy("date").onSnapshot(snap => {
        const grid = document.getElementById('landing-matches-grid');
        const now = new Date().toISOString().split('T')[0];
        let wins = 0, total = 0;
        grid.innerHTML = "";

        snap.forEach(doc => {
            const m = doc.data();
            // Calc stats
            if (m.result) {
                total++;
                if (parseInt(m.result.myScore) > parseInt(m.result.enemyScore)) wins++;
            }

            // Display future matches
            if (m.date >= now && !m.result) {
                grid.innerHTML += `
                    <div class="newsCard" style="border-left: 3px solid #ff1e3c;">
                        <small style="color:#ff1e3c; font-weight:800;">${m.date} @ ${m.time || 'TBD'}</small>
                        <h3 style="margin: 10px 0;">VS ${m.opponent}</h3>
                        <p style="font-size:0.85rem; color:#888;">${m.type} // ${m.map || 'Map TBD'}</p>
                    </div>`;
            }
        });

        // Update Stats Bar
        document.getElementById('stat-record').innerText = `${wins}W - ${total - wins}L`;
        document.getElementById('stat-winrate').innerText = total > 0 ? Math.round((wins / total) * 100) + "%" : "--%";
    });
}

// --- 4. HUB LOGIC & AUTH ---
function handleHubAuth(user) {
    const lock = document.getElementById('hubLocked');
    const unlock = document.getElementById('hubUnlocked');
    const appForm = document.getElementById('app-form');
    const status = document.getElementById('auth-status-text');
    const btns = document.getElementById('login-buttons');

    if (!user) {
        lock.style.display = 'flex';
        unlock.style.display = 'none';
        appForm.style.display = 'none';
        btns.style.display = 'block';
        return;
    }

    // User Logged In - Check Roster Status
    status.innerText = "VERIFYING CREDENTIALS...";
    btns.style.display = 'none';

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        if (!snap.empty || ADMIN_UIDS.includes(user.uid)) {
            // Is Member
            lock.style.display = 'none';
            unlock.style.display = 'block';
            document.getElementById('userProfile').innerText = user.displayName;

            // Show Admin Tab if applicable
            if (ADMIN_UIDS.includes(user.uid)) {
                document.querySelector('.admin-only').style.display = 'block';
                loadAdminApps();
            }

            loadHubMatches();
            loadEnemies();
        } else {
            // Not Member - Show Application
            status.innerText = `WELCOME, ${user.displayName.toUpperCase()}. ACCESS DENIED.`;
            appForm.style.display = 'block';
        }
    });
}

window.loginWithDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => alert("Auth Error: " + e.message));
};

window.submitApplication = () => {
    const ign = document.getElementById('app-ign').value;
    const rank = document.getElementById('app-rank').value;
    const role = document.getElementById('app-role').value;
    const tracker = document.getElementById('app-tracker').value;
    const why = document.getElementById('app-why').value;

    if (!ign || !why) return alert("Please fill in Riot ID and Reason.");

    db.collection("applications").add({
        user: ign, // Use Riot ID as the name
        uid: currentUser.uid,
        rank, role, tracker, why,
        submittedAt: new Date().toISOString()
    }).then(() => {
        alert("Application Submitted. Await officer review.");
        document.getElementById('app-form').innerHTML = "<h3>DOSSIER SUBMITTED. STAND BY.</h3>";
    });
};

window.showTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

// --- 5. MATCH SCHEDULER ---
function loadHubMatches() {
    db.collection("events").where("result", "==", null).onSnapshot(snap => {
        const list = document.getElementById('hub-match-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            list.innerHTML += `
                <div class="match-item">
                    <div>
                        <div style="font-weight:bold; color:white;">VS ${m.opponent}</div>
                        <div style="font-size:0.8rem; color:#888;">${m.date} @ ${m.time}</div>
                    </div>
                    <button style="color:red; background:none; border:none; cursor:pointer;" onclick="deleteMatch('${doc.id}')">✕</button>
                </div>`;
        });
    });
}

window.scheduleMatch = () => {
    const opp = document.getElementById('sched-opp').value;
    const date = document.getElementById('sched-date').value;
    const time = document.getElementById('sched-time').value;
    const type = document.getElementById('sched-type').value;

    if (!opp || !date) return alert("Missing Info");

    db.collection("events").add({
        opponent: opp, date, time, type,
        result: null // Null result means it's upcoming
    }).then(() => {
        alert("Operation Scheduled");
        document.getElementById('sched-opp').value = "";
    });
};

window.deleteMatch = (id) => {
    if (confirm("Cancel this operation?")) db.collection("events").doc(id).delete();
};

// --- 6. WAR ROOM (Enemy Intel) ---
function loadEnemies() {
    db.collection("war_room").onSnapshot(snap => {
        const list = document.getElementById('enemy-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const e = doc.data();
            list.innerHTML += `
                <div class="app-item" onclick="viewEnemy('${doc.id}')" style="cursor:pointer; border-left-color: ${getThreatColor(e.threat)};">
                    <div style="font-weight:bold; color:white;">${e.name}</div>
                    <div style="font-size:0.7rem; color:#888;">${e.threat} THREAT</div>
                </div>`;
        });
    });
}

let currentEnemyId = null;

window.createEnemyProfile = () => {
    const name = prompt("Target Team Name:");
    if (name) {
        db.collection("war_room").add({
            name, threat: "Medium", notes: "", mapIntel: {}
        });
    }
};

window.viewEnemy = (id) => {
    currentEnemyId = id;
    db.collection("war_room").doc(id).get().then(doc => {
        const e = doc.data();
        document.getElementById('warroom-title').innerText = e.name;
        document.getElementById('wr-threat').innerText = e.threat;
        document.getElementById('wr-notes').value = e.notes || "";
        document.getElementById('warroom-content').style.display = 'block';
    });
};

window.saveEnemyIntel = () => {
    if (!currentEnemyId) return;
    const notes = document.getElementById('wr-notes').value;
    db.collection("war_room").doc(currentEnemyId).update({ notes }).then(() => alert("Intel Updated"));
};

window.deleteEnemy = () => {
    if (confirm("Burn Dossier?")) {
        db.collection("war_room").doc(currentEnemyId).delete();
        document.getElementById('warroom-content').style.display = 'none';
        document.getElementById('warroom-title').innerText = "SELECT A TARGET";
    }
};

function getThreatColor(t) {
    if (t === 'Extreme') return '#ff0000';
    if (t === 'High') return '#ff8800';
    return '#00ff00';
}

// --- 7. ADMIN PANEL ---
function loadAdminApps() {
    db.collection("applications").onSnapshot(snap => {
        const list = document.getElementById('admin-apps-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const a = doc.data();
            list.innerHTML += `
                <div class="app-item">
                    <div style="font-weight:900; color:white; font-size:1.1rem;">${a.user}</div>
                    <div style="font-size:0.8rem; color:#ccc;">${a.rank} // ${a.role}</div>
                    <div style="margin-top:5px; font-style:italic; font-size:0.8rem;">"${a.why}"</div>
                    <div class="app-actions">
                        <button class="btn primary" style="padding:5px 15px; font-size:0.7rem; background:green;" onclick="acceptApp('${doc.id}', '${a.user}', '${a.uid}')">ACCEPT</button>
                        <button class="btn ghost" style="padding:5px 15px; font-size:0.7rem;" onclick="rejectApp('${doc.id}')">REJECT</button>
                    </div>
                </div>`;
        });
    });
}

window.acceptApp = (id, name, uid) => {
    // Add to Roster
    db.collection("roster").doc(name).set({
        role: "Tryout",
        rank: "Unranked",
        uid: uid,
        joinedAt: new Date().toISOString()
    }).then(() => {
        // Delete Application
        db.collection("applications").doc(id).delete();
        alert(`${name} enlisted.`);
    });
};

window.rejectApp = (id) => {
    if (confirm("Reject applicant?")) db.collection("applications").doc(id).delete();
};

// --- 8. STRATBOOK (CANVAS) ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Fit canvas to parent
    const resize = () => {
        const p = canvas.parentElement;
        canvas.width = p.clientWidth;
        canvas.height = p.clientHeight;
    };
    window.addEventListener('resize', resize);
    setTimeout(resize, 100);

    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    window.onmouseup = () => isDrawing = false;

    // Load Agents for Palette
    fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true')
        .then(res => res.json())
        .then(json => {
            const p = document.getElementById('agent-list');
            p.innerHTML = json.data.map(a => `
                <div class="agent-icon" onclick="window.prepAgent('${a.displayIcon}')" style="cursor:pointer; display:inline-block; width:40px; margin:2px;">
                    <img src="${a.displayIcon}" style="width:100%;">
                </div>
            `).join('');
        });
}

function startDraw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'draw') {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (currentTool === 'agent' && activeAgent) {
        const img = new Image();
        img.src = activeAgent;
        img.crossOrigin = "anonymous"; // Important for saving
        img.onload = () => {
            ctx.drawImage(img, x - 20, y - 20, 40, 40);
            ctx.strokeStyle = '#ff1e3c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.stroke();
        };
    }
}

function draw(e) {
    if (!isDrawing || currentTool !== 'draw') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = document.getElementById('vpColor').value;
    ctx.lineWidth = 3;
    ctx.stroke();
}

window.setTool = (t) => {
    currentTool = t;
    document.querySelectorAll('.tool').forEach(e => e.classList.remove('active'));
    document.getElementById('tool-' + t).classList.add('active');
};

window.prepAgent = (url) => {
    activeAgent = url;
    window.setTool('agent');
};

window.clearPlanner = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

window.saveStratToDB = () => {
    // Create combined image
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d');

    // Draw map then drawings
    const mapImg = document.getElementById('vpMapImg');
    tCtx.drawImage(mapImg, 0, 0, temp.width, temp.height);
    tCtx.drawImage(canvas, 0, 0);

    const dataUrl = temp.toDataURL();
    const mapName = document.getElementById('vpMapSelect').value;

    db.collection("strats").add({
        map: mapName,
        image: dataUrl, // Base64 string
        author: auth.currentUser.displayName,
        date: new Date().toISOString()
    }).then(() => alert("Strategy Saved to Cloud"));
};

window.changeMap = () => {
    const val = document.getElementById('vpMapSelect').value;
    const maps = {
        ascent: "7eaecc1b-4337-bbf6-6130-03a4d7090581",
        bind: "2c9d57bc-4f8a-4e22-8e6b-b784297d04a5",
        haven: "2bee0ca3-4471-9193-c139-3a1154054a16",
        lotus: "2fe4ed3d-450f-aa44-0b05-a2e116a401f1",
        abyss: "224b0a95-48b9-f703-1a86-809f2c5fb221"
    };
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/${maps[val] || maps.ascent}/stylizedicon.png`;
    window.clearPlanner();
};