const firebaseConfig = { /* ... keep your config ... */ };
let db, auth;
let currentTool = 'draw';
let shapes = []; // For persistent Stratbook objects
let isDrawing = false;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        auth.onAuthStateChanged(user => {
            if (user && document.getElementById('hubUnlocked')) {
                document.getElementById('hubLocked').style.display = 'none';
                document.getElementById('hubUnlocked').style.display = 'grid';
                document.getElementById('userProfile').innerText = `OPERATOR: ${user.displayName.toUpperCase()}`;
                initHubData();
                initPlanner();
            }
        });
    }
});

// --- HUB NAVIGATION ---
window.showTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

// --- STRATBOOK LOGIC ---
let canvas, ctx;
function initPlanner() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // High performance drawing
    canvas.onmousedown = (e) => {
        if (currentTool === 'draw') {
            isDrawing = true;
            ctx.beginPath();
            const r = canvas.getBoundingClientRect();
            ctx.moveTo((e.clientX - r.left) * (1200 / r.width), (e.clientY - r.top) * (800 / r.height));
        } else if (currentTool === 'agent') {
            placeAgentIcon(e);
        }
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing || currentTool !== 'draw') return;
        const r = canvas.getBoundingClientRect();
        ctx.lineTo((e.clientX - r.left) * (1200 / r.width), (e.clientY - r.top) * (800 / r.height));
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
    };

    window.onmouseup = () => isDrawing = false;
    loadAgents();
}

window.setTool = (tool) => {
    currentTool = tool;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    document.getElementById(`tool-${tool}`)?.classList.add('active');
};

async function loadAgents() {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const data = await res.json();
    const palette = document.getElementById('agent-list');
    if (!palette) return;

    palette.innerHTML = data.data.slice(0, 12).map(agent => `
        <div class="agent-icon" onclick="window.selectAgent('${agent.displayIcon}', '${agent.displayName}')">
            <img src="${agent.displayIcon}" alt="${agent.displayName}">
        </div>
    `).join('');
}

window.selectAgent = (icon, name) => {
    window.activeAgent = { icon, name };
    window.setTool('agent');
};

function placeAgentIcon(e) {
    if (!window.activeAgent) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (1200 / r.width);
    const y = (e.clientY - r.top) * (800 / r.height);

    const img = new Image();
    img.src = window.activeAgent.icon;
    img.onload = () => {
        // Draw Agent Border
        ctx.strokeStyle = var(--red);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.stroke();
        // Draw Icon
        ctx.drawImage(img, x - 20, y - 20, 40, 40);
    };
}

function resizeCanvas() {
    canvas.width = 1200;
    canvas.height = 800;
}

window.clearPlanner = () => ctx.clearRect(0, 0, 1200, 800);
window.changeMap = () => {
    const map = document.getElementById('vpMapSelect').value;
    const maps = {
        ascent: "7eaecc1b-4337-bbf6-6130-03a4d7090581",
        bind: "2c9d57bc-4f8a-4e22-8e6b-b784297d04a5",
        haven: "2bee0ca3-4471-9193-c139-3a1154054a16",
        lotus: "2fe4ed3d-450f-aa44-0b05-a2e116a401f1",
        abyss: "22050f2d-4d43-2646-63c3-6385b0d4530d"
    };
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/${maps[map]}/stylizedicon.png`;
    window.clearPlanner();
};