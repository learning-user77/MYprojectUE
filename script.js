// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCoCEZO_JbwHxHewSYgd319SPkAL-a-Nh0",
  authDomain: "project-ds-manager.firebaseapp.com",
  databaseURL: "https://project-ds-manager-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-ds-manager",
  storageBucket: "project-ds-manager.firebasestorage.app",
  messagingSenderId: "395667109343",
  appId: "1:395667109343:web:14164c3e08ee672acdc06a"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let isAdmin = false;
let currentUser = null;
let currentEditingMatch = null;
let isEditingResults = false;
let lastHypeTime = {};
let transferHistory = {};

function formatCompactNumber(num) {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

window.addEventListener('load', function() {
    setTimeout(() => document.getElementById('loadingSpinner').style.display = 'none', 500);
});

window.addEventListener('DOMContentLoaded', function() {
    isAdmin = false;
    currentUser = { isVisitor: true };
    document.getElementById('userName').textContent = 'Visitor';
    document.getElementById('userRole').textContent = 'Click to Login';
    document.getElementById('userAvatar').textContent = 'V';
    document.getElementById('logoutBtn').classList.add('hidden');
    document.querySelectorAll('.admin-badge').forEach(b => b.style.display = 'none');
    document.getElementById('othersNavItem').style.display = 'none';
    loadGuideContent();
});

function setTheme(theme, button) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-toggle button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
document.querySelectorAll('.theme-toggle button').forEach(btn => {
    if ((savedTheme === 'light' && btn.textContent.includes('Light')) ||
        (savedTheme === 'dark' && btn.textContent.includes('Dark')))
        btn.classList.add('active');
});

function showLoginModal() {
    if (!isAdmin) document.getElementById('loginModal').classList.add('active');
}

auth.onAuthStateChanged((user) => {
    if (user) {
        isAdmin = true;
        currentUser = user;
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('loginHeader').style.cursor = 'default';
        document.getElementById('userName').textContent = user.email.split('@')[0];
        document.getElementById('userRole').textContent = 'Administrator';
        document.getElementById('userAvatar').textContent = user.email.charAt(0).toUpperCase();
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.querySelectorAll('.admin-badge').forEach(b => b.style.display = 'inline');
        document.getElementById('othersNavItem').style.display = 'block';
        const cp = document.getElementById('pageTitle').textContent.toLowerCase();
        if (cp === 'guide') loadGuideContent();
        else if (cp === 'registry') loadRegistryContent();
        else if (cp === 'fixtures') loadFixturesContent();
        else if (cp === 'results') loadResultsContent();
        else if (cp === 'team-lb') loadTeamLBContent();
        else if (cp.includes('most-')) loadPlayerLBContent(cp);
        else if (cp === 'logs') loadLogsContent();
    } else {
        isAdmin = false;
        currentUser = { isVisitor: true };
        document.getElementById('loginHeader').style.cursor = 'pointer';
        document.getElementById('userName').textContent = 'Visitor';
        document.getElementById('userRole').textContent = 'Click to Login';
        document.getElementById('userAvatar').textContent = 'V';
        document.getElementById('logoutBtn').classList.add('hidden');
        document.querySelectorAll('.admin-badge').forEach(b => b.style.display = 'none');
        document.getElementById('othersNavItem').style.display = 'none';
    }
});

function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const err = document.getElementById('errorMessage');
    if (!email || !password) { err.textContent = 'Please enter email and password'; return; }
    auth.signInWithEmailAndPassword(email, password)
        .then(() => logAction('Admin Login', 'Authentication'))
        .catch(e => err.textContent = e.message);
}

function logout() { if (isAdmin) auth.signOut(); }

function logAction(action, section) {
    if (!isAdmin || !currentUser) return;
    database.ref(`logs/${Date.now()}`).set({
        action, user: currentUser.email, timestamp: Date.now(), section: section || 'General'
    }).catch(console.error);
}

function maskEmail(email) {
    if (!email) return 'Unknown';
    const [local, domain] = email.split('@');
    if (local.length <= 5) return '*'.repeat(local.length) + '@' + domain;
    return local.substring(0,5) + '*'.repeat(local.length-5) + '@' + domain;
}

function toggleSubmenu(e) {
    e.preventDefault();
    document.getElementById('playerLBSubmenu').classList.toggle('active');
}

function toggleSidebar() {
    document.querySelector('.app').classList.toggle('sidebar-collapsed');
    const icon = document.querySelector('.sidebar-toggle i');
    if (icon.classList.contains('fa-chevron-left')) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
}

function showContent(section, e) {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const titles = {
        'guide':'Guide','registry':'Registry','fixtures':'Fixtures','results':'Results',
        'team-lb':'Team Leaderboard','most-goals':'Most Goals','most-assists':'Most Assists',
        'most-saves':'Most Saves','most-awards':'Most Awards','most-valued':'Most Valued',
        'logs':'Logs','others':'Others'
    };
    document.getElementById('pageTitle').textContent = titles[section] || section;
    if (section === 'guide') loadGuideContent();
    else if (section === 'registry') loadRegistryContent();
    else if (section === 'fixtures') loadFixturesContent();
    else if (section === 'results') loadResultsContent();
    else if (section === 'team-lb') loadTeamLBContent();
    else if (section === 'logs') loadLogsContent();
    else if (section === 'others') loadOthersContent();
    else if (section.includes('most-')) loadPlayerLBContent(section);
    else loadGenericContent(section);
}

// ==================== REGISTRY FUNCTIONS ====================
function loadRegistryContent() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading registry...</p></div>`;
    Promise.all([
        database.ref('registry/teams').once('value'),
        database.ref('registry/players').once('value'),
        database.ref('settings/values').once('value')
    ]).then(([teamsSnap, playersSnap, settingsSnap]) => {
        const teams = teamsSnap.val() || {};
        const players = playersSnap.val() || {};
        const settingsData = settingsSnap.val() || {};
        const settings = {
            goalValue: settingsData.goalValue || 100000,
            assistValue: settingsData.assistValue || 100000,
            saveValue: settingsData.saveValue || 100000
        };
        let html = `<div class="success-message" id="successMessage"><i class="fas fa-check-circle"></i> Operation completed successfully!</div>`;
        if (isAdmin) {
            html += `
                <div class="registration-section"><h2><i class="fas fa-shield-alt"></i> Team Registration</h2>
                    <div class="registration-grid"><div class="registration-card">
                        <h3>Register New Team</h3>
                        <div class="form-group"><label>Team Name</label><input type="text" id="teamName" placeholder="e.g., Team Isagi"></div>
                        <div class="form-group"><label>Team Color</label><div class="color-input-group"><input type="color" id="teamColor" value="#0a1c3a"><input type="text" id="teamColorHex" value="#0a1c3a" placeholder="#RRGGBB"></div></div>
                        <button class="btn" onclick="registerTeam()"><i class="fas fa-plus"></i> Register Team</button>
                    </div></div></div>
                <div class="registration-section"><h2><i class="fas fa-user"></i> Player Registration</h2>
                    <div class="registration-grid">
                        <div class="registration-card"><h3>Add Single Player</h3>
                            <div class="form-group"><label>Player Name</label><input type="text" id="playerName" placeholder="e.g., Yoichi Isagi"></div>
                            <div class="form-group"><label>Select Team</label><select id="playerTeam"><option value="">Select a team...</option>${Object.entries(teams).map(([id,team])=>`<option value="${id}" style="color:${team.color}">${team.name}</option>`).join('')}</select></div>
                            <button class="btn" onclick="addPlayer()"><i class="fas fa-user-plus"></i> Add Player</button>
                        </div>
                        <div class="registration-card"><h3>Bulk Add Players</h3><p class="warning-text">Enter one player name per line</p>
                            <textarea id="bulkPlayers" rows="5" placeholder="Yoichi Isagi&#10;Meguru Bachira&#10;Rin Itoshi"></textarea>
                            <div class="form-group"><label>Select Team for All</label><select id="bulkTeam"><option value="">Select a team...</option>${Object.entries(teams).map(([id,team])=>`<option value="${id}" style="color:${team.color}">${team.name}</option>`).join('')}</select></div>
                            <button class="btn btn-success" onclick="bulkAddPlayers()"><i class="fas fa-layer-group"></i> Bulk Add Players</button>
                        </div>
                    </div></div>`;
        }
        html += `<div class="registration-section"><h2><i class="fas fa-list"></i> Registered Teams</h2><div class="teams-list">`;
        if (Object.keys(teams).length === 0) html += `<p class="warning-text">No teams registered yet. Register a team above.</p>`;
        else {
            Object.entries(teams).forEach(([teamId, team]) => {
                const teamPlayers = Object.entries(players).filter(([_,p])=>p.teamId===teamId).map(([id,p])=>({id,...p}));
                html += `<div class="team-card" style="border-left-color:${team.color||'#0a1c3a'}" id="team-${teamId}">
                    <div class="team-header"><div class="team-title"><div class="team-color" style="background-color:${team.color||'#0a1c3a'}; box-shadow:0 0 10px ${team.color||'#0a1c3a'};"></div><span class="team-name" style="color:${team.color||'#0a1c3a'}; text-shadow:0 0 10px ${team.color||'#0a1c3a'};">${team.name}</span></div>`;
                if (isAdmin) html += `<div class="team-controls"><button class="btn-edit" onclick="editTeam('${teamId}')"><i class="fas fa-edit"></i> Edit</button><button class="btn-delete" onclick="deleteTeam('${teamId}')"><i class="fas fa-trash"></i> Delete</button></div>`;
                html += `</div><div class="player-row header"><div>Player</div><div>Goals</div><div>Assists</div><div>Saves</div><div>Value</div><div>Legs</div><div></div><div></div></div>`;
                if (teamPlayers.length===0) html += `<p class="warning-text" style="padding:1rem;">No players in this team yet.</p>`;
                else {
                    teamPlayers.forEach(player => {
                        const value = (player.goals||0)*settings.goalValue + (player.assists||0)*settings.assistValue + (player.saves||0)*settings.saveValue;
                        html += `<div class="player-row" id="player-${player.id}" onclick="showPlayerProfile('${player.id}')">
                            <div class="player-name" style="color:${team.color||'#0a1c3a'}">${player.name}</div>
                            <div class="stat-display">${player.goals||0}</div><div class="stat-display">${player.assists||0}</div>
                            <div class="stat-display">${player.saves||0}</div><div class="value-display">$${formatCompactNumber(value)}</div>
                            <div class="stat-display">${player.legs||0}</div>`;
                        if (isAdmin) html += `<div><button class="btn-edit btn-small" onclick="event.stopPropagation(); editPlayer('${player.id}')"><i class="fas fa-edit"></i></button></div><div><button class="btn-delete btn-small" onclick="event.stopPropagation(); deletePlayer('${player.id}')"><i class="fas fa-trash"></i></button></div>`;
                        else html += `<div></div><div></div>`;
                        html += `</div>`;
                    });
                }
                html += `</div>`;
            });
        }
        html += `</div></div>`;
        contentArea.innerHTML = html;
        if (isAdmin) {
            const cInput = document.getElementById('teamColor'), cHex = document.getElementById('teamColorHex');
            if (cInput && cHex) {
                cInput.addEventListener('input', e => cHex.value = e.target.value);
                cHex.addEventListener('input', e => { if (/^#[0-9A-F]{6}$/i.test(e.target.value)) cInput.value = e.target.value; });
            }
        }
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Registry</h2><p>${err.message}</p></div>`);
}

function registerTeam() {
    if (!isAdmin) return;
    const name = document.getElementById('teamName').value;
    const color = document.getElementById('teamColor').value;
    if (!name) { alert('Please enter a team name'); return; }
    const teamId = Date.now().toString();
    database.ref(`registry/teams/${teamId}`).set({
        name, color, createdAt: Date.now(), createdBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Registered new team: ${name}`, 'Registry');
        showSuccessMessage('Team registered successfully!');
        document.getElementById('teamName').value = '';
        loadRegistryContent();
    }).catch(err => alert('Error: ' + err.message));
}

function addPlayer() {
    if (!isAdmin) return;
    const name = document.getElementById('playerName').value;
    const teamId = document.getElementById('playerTeam').value;
    if (!name) { alert('Please enter a player name'); return; }
    if (!teamId) { alert('Please select a team'); return; }
    const playerId = Date.now().toString();
    database.ref(`registry/players/${playerId}`).set({
        name, teamId, goals:0, assists:0, saves:0, legs:0, awards:0, hype:0,
        createdAt: Date.now(), createdBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Added player: ${name}`, 'Registry');
        showSuccessMessage('Player added successfully!');
        document.getElementById('playerName').value = '';
        document.getElementById('playerTeam').value = '';
        loadRegistryContent();
    }).catch(err => alert('Error: ' + err.message));
}

function bulkAddPlayers() {
    if (!isAdmin) return;
    const namesText = document.getElementById('bulkPlayers').value;
    const teamId = document.getElementById('bulkTeam').value;
    if (!namesText) { alert('Please enter player names'); return; }
    if (!teamId) { alert('Please select a team'); return; }
    const names = namesText.split('\n').filter(n=>n.trim()!=='');
    if (names.length===0) { alert('Please enter at least one player name'); return; }
    const updates = {};
    const timestamp = Date.now();
    names.forEach(name => {
        const playerId = timestamp + Math.random().toString(36).substr(2,9);
        updates[`registry/players/${playerId}`] = {
            name: name.trim(), teamId, goals:0, assists:0, saves:0, legs:0, awards:0, hype:0,
            createdAt: timestamp, createdBy: currentUser?.email || 'admin'
        };
    });
    database.ref().update(updates).then(() => {
        logAction(`Bulk added ${names.length} players`, 'Registry');
        showSuccessMessage(`${names.length} players added successfully!`);
        document.getElementById('bulkPlayers').value = '';
        document.getElementById('bulkTeam').value = '';
        loadRegistryContent();
    }).catch(err => alert('Error: ' + err.message));
}

function editTeam(teamId) {
    if (!isAdmin) return;
    const newName = prompt('Enter new team name:');
    if (newName) {
        database.ref(`registry/teams/${teamId}/name`).set(newName)
            .then(() => { logAction(`Renamed team to: ${newName}`, 'Registry'); showSuccessMessage('Team updated successfully!'); loadRegistryContent(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

function deleteTeam(teamId) {
    if (!isAdmin) return;
    if (confirm('Delete this team and all its players?')) {
        database.ref('registry/players').once('value').then(snap => {
            const players = snap.val() || {};
            const updates = {};
            updates[`registry/teams/${teamId}`] = null;
            Object.entries(players).forEach(([id, p]) => { if (p.teamId === teamId) updates[`registry/players/${id}`] = null; });
            return database.ref().update(updates);
        }).then(() => {
            logAction(`Deleted team and its players`, 'Registry');
            showSuccessMessage('Team and all its players deleted!');
            loadRegistryContent();
        }).catch(err => alert('Error: ' + err.message));
    }
}

function editPlayer(playerId) {
    if (!isAdmin) return;
    Promise.all([
        database.ref(`registry/players/${playerId}`).once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([pSnap, tSnap]) => {
        const player = pSnap.val();
        const teams = tSnap.val() || {};
        if (!player) { alert('Player not found'); return; }
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '3000';
        let teamOptions = '<option value="">Select a team...</option>';
        Object.entries(teams).forEach(([id,team]) => {
            const selected = id === player.teamId ? 'selected' : '';
            teamOptions += `<option value="${id}" ${selected} style="color:${team.color}">${team.name}</option>`;
        });
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header"><h2>Edit Player</h2><p>${player.name}</p></div>
                <div class="form-group"><label>Player Name</label><input type="text" id="editPlayerName" value="${player.name}"></div>
                <div class="form-group"><label>Transfer to Team</label><select id="editPlayerTeam">${teamOptions}</select></div>
                <div style="display:flex;gap:1rem;margin-top:2rem;"><button class="btn" onclick="savePlayerChanges('${playerId}')">Save Changes</button><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button></div>
                <p style="margin-top:1rem;color:var(--text-light);font-size:0.8rem;text-align:center;"><i class="fas fa-info-circle"></i> Stats can only be updated through match results</p>
            </div>`;
        document.body.appendChild(modal);
    }).catch(err => alert('Error: ' + err.message));
}

function savePlayerChanges(playerId) {
    if (!isAdmin) return;
    const newName = document.getElementById('editPlayerName').value;
    const newTeamId = document.getElementById('editPlayerTeam').value;
    if (!newName) { alert('Please enter a player name'); return; }
    if (!newTeamId) { alert('Please select a team'); return; }
    database.ref(`registry/players/${playerId}`).once('value').then(snap => {
        const player = snap.val();
        if (!player) return;
        if (player.teamId !== newTeamId) {
            if (!transferHistory[playerId]) transferHistory[playerId] = [];
            transferHistory[playerId].push({ playerId, fromTeam: player.teamId, toTeam: newTeamId, date: Date.now() });
        }
        return database.ref(`registry/players/${playerId}`).update({ name: newName, teamId: newTeamId, updatedAt: Date.now() });
    }).then(() => {
        logAction(`Updated player: ${newName}`, 'Registry');
        document.querySelector('.modal.active').remove();
        showSuccessMessage('Player updated successfully!');
        loadRegistryContent();
    }).catch(err => alert('Error: ' + err.message));
}

function deletePlayer(playerId) {
    if (!isAdmin) return;
    if (confirm('Delete this player?')) {
        database.ref(`registry/players/${playerId}`).remove()
            .then(() => { logAction(`Deleted player`, 'Registry'); showSuccessMessage('Player deleted!'); loadRegistryContent(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

function showPlayerProfile(playerId) {
    Promise.all([
        database.ref(`registry/players/${playerId}`).once('value'),
        database.ref('registry/teams').once('value'),
        database.ref('results').once('value'),
        database.ref('settings/values').once('value')
    ]).then(([pSnap, tSnap, rSnap, sSnap]) => {
        const player = pSnap.val();
        const teams = tSnap.val() || {};
        const results = rSnap.val() || {};
        const settings = sSnap.val() || {};
        if (!player) { alert('Player not found'); return; }
        const currentTeam = teams[player.teamId] || { name: 'Unknown', color: '#0a1c3a' };
        const value = (player.goals||0)*(settings.goalValue||100000) + (player.assists||0)*(settings.assistValue||100000) + (player.saves||0)*(settings.saveValue||100000);
        const matchHistory = [];
        Object.entries(results).forEach(([rid, res]) => {
            if (res.playerStats && res.playerStats[playerId]) {
                const stats = res.playerStats[playerId];
                const homeTeam = teams[res.homeTeam] || { name: res.homeTeam };
                const awayTeam = teams[res.awayTeam] || { name: res.awayTeam };
                const opponent = stats.team === 'home' ? awayTeam.name : homeTeam.name;
                matchHistory.push({
                    date: new Date(res.timestamp).toLocaleDateString(), opponent, team: stats.team === 'home' ? homeTeam.name : awayTeam.name,
                    legs: stats.legs, goals: stats.goals, assists: stats.assists, saves: stats.saves,
                    mvp: res.mvp === playerId, motm: res.motm === playerId
                });
            }
        });
        matchHistory.sort((a,b)=>new Date(b.date)-new Date(a.date));
        const playerTransfers = transferHistory[playerId] || [];
        const modal = document.createElement('div');
        modal.className = 'modal active';
        let matchHistoryHtml = '';
        if (matchHistory.length) {
            matchHistory.slice(0,5).forEach(m => {
                matchHistoryHtml += `<div class="history-card"><div class="history-header"><span class="history-badge ${m.mvp?'mvp':(m.motm?'motm':'')}">${m.mvp?'MVP':(m.motm?'MOTM':'')}</span><span>${m.date}</span></div><div class="history-teams">${m.team} vs ${m.opponent}</div><div class="history-stats"><span>${m.legs==='full'?'Full':(m.legs==='dnp'?'DNP':'1 Leg')}</span><span>${m.goals}G / ${m.assists}A / ${m.saves}S</span></div></div>`;
            });
        } else matchHistoryHtml = '<p class="warning-text">No match history yet.</p>';
        let transferHistoryHtml = '';
        if (playerTransfers.length) {
            playerTransfers.forEach(t => {
                const fromTeam = teams[t.fromTeam] || { name: 'Unknown', color: '#0a1c3a' };
                const toTeam = teams[t.toTeam] || { name: 'Unknown', color: '#0a1c3a' };
                transferHistoryHtml += `<div class="transfer-item"><div class="transfer-teams"><span style="color:${fromTeam.color}">${fromTeam.name}</span><span class="transfer-arrow">→</span><span style="color:${toTeam.color}">${toTeam.name}</span></div><div class="transfer-date">${new Date(t.date).toLocaleDateString()}</div></div>`;
            });
        }
        transferHistoryHtml += `<div class="transfer-item"><div class="transfer-teams"><span style="color:${currentTeam.color}">${currentTeam.name}</span><span class="transfer-arrow">→</span><span>Current Team</span></div><div class="transfer-date">Present</div></div>`;
        const lastHype = lastHypeTime[playerId] || 0;
        const canHype = Date.now() - lastHype > 24*60*60*1000;
        modal.innerHTML = `<div class="modal-content player-profile">
            <div class="profile-header"><div class="profile-title"><h2>${player.name}</h2><div class="team-name" style="color:${currentTeam.color}">${currentTeam.name}</div></div><div class="profile-value"><div class="label">Total Value</div><div class="amount">$${formatCompactNumber(value)}</div></div></div>
            <div class="profile-stats"><div class="profile-stat"><div class="value" style="color:var(--isagi-blue)">${player.goals||0}</div><div class="label">Goals</div></div><div class="profile-stat"><div class="value" style="color:var(--bachira-yellow)">${player.assists||0}</div><div class="label">Assists</div></div><div class="profile-stat"><div class="value" style="color:var(--gagamaru-silver)">${player.saves||0}</div><div class="label">Saves</div></div><div class="profile-stat"><div class="value" style="color:var(--accent-blue)">${player.legs||0}</div><div class="label">Legs</div></div><div class="profile-stat"><div class="value" style="color:var(--mvp-purple)">${player.awards||0}</div><div class="label">Awards</div></div><div class="profile-stat"><div class="value" style="color:var(--hype-pink)">${player.hype||0} <span class="hype-count">🔥</span></div><div class="label">Hype</div></div></div>
            <div class="profile-actions"><button class="btn-hype" onclick="giveHype('${playerId}')" ${!canHype?'disabled':''}><i class="fas fa-fire"></i> HYPE ${!canHype?'(24h cooldown)':''}</button><button class="btn btn-secondary" onclick="comparePlayer('${playerId}')"><i class="fas fa-chart-bar"></i> COMPARE</button></div>
            <div class="leg-analysis"><h3>LEG ANALYSIS</h3><div class="leg-stats"><div class="leg-stat"><div class="value" style="color:var(--gold)">${(player.goals/Math.max(player.legs,1)).toFixed(2)}</div><div class="label">G/Leg</div></div><div class="leg-stat"><div class="value" style="color:var(--gold)">${(player.assists/Math.max(player.legs,1)).toFixed(2)}</div><div class="label">A/Leg</div></div><div class="leg-stat"><div class="value" style="color:var(--gold)">${(player.saves/Math.max(player.legs,1)).toFixed(2)}</div><div class="label">S/Leg</div></div><div class="leg-stat"><div class="value" style="color:var(--success-green)">$${formatCompactNumber(Math.round(value/Math.max(player.legs,1)))}</div><div class="label">Value/Leg</div></div></div></div>
            <div class="match-history"><h3>MATCH HISTORY</h3>${matchHistoryHtml}</div>
            <div class="transfer-record"><h3>TRANSFER RECORD</h3>${transferHistoryHtml}</div>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
        </div>`;
        document.body.appendChild(modal);
    }).catch(err => alert('Error loading player data: ' + err.message));
}

function giveHype(playerId) {
    const lastHype = lastHypeTime[playerId] || 0;
    if (Date.now() - lastHype < 24*60*60*1000) { alert('You can only give hype once every 24 hours!'); return; }
    database.ref(`registry/players/${playerId}/hype`).transaction(cur => (cur||0)+1)
        .then(() => { lastHypeTime[playerId] = Date.now(); logAction(`Gave hype to player`, 'Hype'); document.querySelector('.modal.active').remove(); showPlayerProfile(playerId); })
        .catch(err => alert('Error: ' + err.message));
}

function comparePlayer(playerId) {
    Promise.all([
        database.ref(`registry/players/${playerId}`).once('value'),
        database.ref('registry/players').once('value'),
        database.ref('registry/teams').once('value'),
        database.ref('settings/values').once('value')
    ]).then(([pSnap, allSnap, tSnap, sSnap]) => {
        const player1 = pSnap.val();
        const allPlayers = allSnap.val() || {};
        const teams = tSnap.val() || {};
        const settings = sSnap.val() || {};
        if (!player1) return;
        const modal = document.createElement('div');
        modal.className = 'modal active compare-modal';
        let playerOptions = '<option value="">Select player to compare...</option>';
        Object.entries(allPlayers).forEach(([id,p]) => {
            if (id !== playerId) {
                const team = teams[p.teamId] || { name: 'Unknown' };
                playerOptions += `<option value="${id}">${p.name} (${team.name})</option>`;
            }
        });
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h2>Compare Players</h2><p>${player1.name}</p></div>
            <div class="form-group compare-select"><label>Select Player to Compare</label><select id="comparePlayerSelect">${playerOptions}</select></div>
            <div id="compareResults" style="display:none;"></div>
            <button class="btn" onclick="performComparison('${playerId}')">Compare</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>`;
        document.body.appendChild(modal);
    });
}

function performComparison(player1Id) {
    const player2Id = document.getElementById('comparePlayerSelect').value;
    if (!player2Id) { alert('Please select a player to compare'); return; }
    Promise.all([
        database.ref(`registry/players/${player1Id}`).once('value'),
        database.ref(`registry/players/${player2Id}`).once('value'),
        database.ref('registry/teams').once('value'),
        database.ref('settings/values').once('value')
    ]).then(([p1Snap, p2Snap, tSnap, sSnap]) => {
        const player1 = p1Snap.val(), player2 = p2Snap.val();
        const teams = tSnap.val() || {};
        const settings = sSnap.val() || {};
        if (!player1 || !player2) return;
        const team1 = teams[player1.teamId] || { name: 'Unknown', color: '#0a1c3a' };
        const team2 = teams[player2.teamId] || { name: 'Unknown', color: '#0a1c3a' };
        const value1 = (player1.goals||0)*(settings.goalValue||100000) + (player1.assists||0)*(settings.assistValue||100000) + (player1.saves||0)*(settings.saveValue||100000);
        const value2 = (player2.goals||0)*(settings.goalValue||100000) + (player2.assists||0)*(settings.assistValue||100000) + (player2.saves||0)*(settings.saveValue||100000);
        const compareResults = document.getElementById('compareResults');
        compareResults.style.display = 'block';
        compareResults.innerHTML = `<div class="compare-stats">
            <div class="compare-player"><h4 style="color:${team1.color}">${player1.name}</h4>
                <div class="compare-stat-row ${player1.goals>player2.goals?'win':(player1.goals<player2.goals?'lose':'')}"><span>Goals</span><span>${player1.goals||0}</span></div>
                <div class="compare-stat-row ${player1.assists>player2.assists?'win':(player1.assists<player2.assists?'lose':'')}"><span>Assists</span><span>${player1.assists||0}</span></div>
                <div class="compare-stat-row ${player1.saves>player2.saves?'win':(player1.saves<player2.saves?'lose':'')}"><span>Saves</span><span>${player1.saves||0}</span></div>
                <div class="compare-stat-row ${(player1.awards||0)>(player2.awards||0)?'win':((player1.awards||0)<(player2.awards||0)?'lose':'')}"><span>Awards</span><span>${player1.awards||0}</span></div>
                <div class="compare-stat-row ${(player1.hype||0)>(player2.hype||0)?'win':((player1.hype||0)<(player2.hype||0)?'lose':'')}"><span>Hype</span><span>${player1.hype||0} 🔥</span></div>
                <div class="compare-stat-row ${value1>value2?'win':(value1<value2?'lose':'')}"><span>Value</span><span>$${formatCompactNumber(value1)}</span></div>
            </div>
            <div class="compare-vs">VS</div>
            <div class="compare-player"><h4 style="color:${team2.color}">${player2.name}</h4>
                <div class="compare-stat-row ${player2.goals>player1.goals?'win':(player2.goals<player1.goals?'lose':'')}"><span>Goals</span><span>${player2.goals||0}</span></div>
                <div class="compare-stat-row ${player2.assists>player1.assists?'win':(player2.assists<player1.assists?'lose':'')}"><span>Assists</span><span>${player2.assists||0}</span></div>
                <div class="compare-stat-row ${player2.saves>player1.saves?'win':(player2.saves<player1.saves?'lose':'')}"><span>Saves</span><span>${player2.saves||0}</span></div>
                <div class="compare-stat-row ${(player2.awards||0)>(player1.awards||0)?'win':((player2.awards||0)<(player1.awards||0)?'lose':'')}"><span>Awards</span><span>${player2.awards||0}</span></div>
                <div class="compare-stat-row ${(player2.hype||0)>(player1.hype||0)?'win':((player2.hype||0)<(player1.hype||0)?'lose':'')}"><span>Hype</span><span>${player2.hype||0} 🔥</span></div>
                <div class="compare-stat-row ${value2>value1?'win':(value2<value1?'lose':'')}"><span>Value</span><span>$${formatCompactNumber(value2)}</span></div>
            </div>
        </div>`;
    });
}

// ==================== FIXTURES FUNCTIONS ====================
function loadFixturesContent() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading fixtures...</p></div>`;
    Promise.all([
        database.ref('fixtures/matchdays').once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([mdSnap, tSnap]) => {
        const matchdays = mdSnap.val() || {};
        const teams = tSnap.val() || {};
        let html = `<div class="success-message" id="successMessage"><i class="fas fa-check-circle"></i> Operation completed successfully!</div>`;
        if (isAdmin) {
            html += `<div class="matchday-section"><h2><i class="fas fa-calendar-plus"></i> Create Matchday</h2><div class="registration-grid"><div class="registration-card"><h3>New Matchday</h3><div class="form-group"><label>Matchday Name</label><input type="text" id="matchdayName" placeholder="e.g., Matchday 1"></div><div class="form-group"><label>Date</label><input type="date" id="matchdayDate"></div><button class="btn" onclick="createMatchday()"><i class="fas fa-plus"></i> Create Matchday</button></div></div></div>`;
        }
        if (Object.keys(matchdays).length===0) html += `<p class="warning-text">No matchdays created yet. ${isAdmin?'Create a matchday above.':'Check back later.'}</p>`;
        else {
            Object.entries(matchdays).forEach(([mdId, md]) => {
                const matches = md.matches || {};
                html += `<div class="matchday-section" id="matchday-${mdId}"><div class="matchday-header" onclick="toggleMatchday('${mdId}')"><div class="matchday-title"><i class="fas fa-chevron-right" id="chevron-${mdId}"></i> ${md.name} - ${new Date(md.date).toLocaleDateString()}</div>`;
                if (isAdmin) html += `<div class="matchday-controls"><button class="btn-edit" onclick="event.stopPropagation(); addMatch('${mdId}')"><i class="fas fa-plus"></i> Add Match</button><button class="btn-delete" onclick="event.stopPropagation(); deleteMatchday('${mdId}')"><i class="fas fa-trash"></i> Delete</button></div>`;
                html += `</div><div class="matchday-matches" id="matches-${mdId}" style="display:none;">`;
                if (Object.keys(matches).length===0) html += `<p class="warning-text">No matches in this matchday yet.</p>`;
                else {
                    Object.entries(matches).forEach(([mId, m]) => {
                        const homeTeam = teams[m.homeTeam] || { name: 'Unknown', color: '#0a1c3a' };
                        const awayTeam = teams[m.awayTeam] || { name: 'Unknown', color: '#0a1c3a' };
                        const status = m.status || 'scheduled';
                        const statusClass = status === 'completed' ? 'status-completed' : 'status-scheduled';
                        const statusText = status === 'completed' ? 'MATCH OVER' : 'Scheduled';
                        html += `<div class="match-card" id="match-${mId}"><div class="match-info"><div class="match-teams"><span style="color:${homeTeam.color}">${homeTeam.name}</span><span>vs</span><span style="color:${awayTeam.color}">${awayTeam.name}</span></div><div class="match-status ${statusClass}">${statusText}</div></div>`;
                        if (isAdmin) {
                            html += `<div class="match-actions"><button class="btn-edit btn-small" onclick="editMatch('${mdId}', '${mId}')"><i class="fas fa-edit"></i></button>`;
                            if (status !== 'completed') html += `<button class="btn-success btn-small" onclick="enterResults('${mdId}', '${mId}')"><i class="fas fa-chart-line"></i> Enter Results</button>`;
                            else html += `<button class="btn-edit btn-small" onclick="editResults('${mdId}', '${mId}')"><i class="fas fa-pen"></i> Edit Results</button>`;
                            html += `<button class="btn-delete btn-small" onclick="deleteMatch('${mdId}', '${mId}')"><i class="fas fa-trash"></i></button></div>`;
                        }
                        html += `</div>`;
                    });
                }
                html += `</div></div>`;
            });
        }
        contentArea.innerHTML = html;
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Fixtures</h2><p>${err.message}</p></div>`);
}

function createMatchday() {
    if (!isAdmin) return;
    const name = document.getElementById('matchdayName').value;
    const date = document.getElementById('matchdayDate').value;
    if (!name || !date) { alert('Please enter both matchday name and date'); return; }
    const matchdayId = Date.now().toString();
    database.ref(`fixtures/matchdays/${matchdayId}`).set({
        name, date: new Date(date).getTime(), matches: {}, createdAt: Date.now(), createdBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Created matchday: ${name}`, 'Fixtures');
        showSuccessMessage('Matchday created successfully!');
        document.getElementById('matchdayName').value = '';
        document.getElementById('matchdayDate').value = '';
        loadFixturesContent();
    }).catch(err => alert('Error: ' + err.message));
}

function toggleMatchday(matchdayId) {
    const matchesDiv = document.getElementById(`matches-${matchdayId}`);
    const chevron = document.getElementById(`chevron-${matchdayId}`);
    if (matchesDiv.style.display === 'none') {
        matchesDiv.style.display = 'block';
        chevron.classList.remove('fa-chevron-right');
        chevron.classList.add('fa-chevron-down');
    } else {
        matchesDiv.style.display = 'none';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-right');
    }
}

function addMatch(matchdayId) {
    if (!isAdmin) return;
    database.ref('registry/teams').once('value').then(snap => {
        const teams = snap.val() || {};
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '3000';
        let teamOptions = '<option value="">Select a team...</option>';
        Object.entries(teams).forEach(([id,team]) => teamOptions += `<option value="${id}" style="color:${team.color}">${team.name}</option>`);
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h2>Add New Match</h2></div>
            <div class="form-group"><label>Home Team</label><select id="homeTeam">${teamOptions}</select></div>
            <div class="form-group"><label>Away Team</label><select id="awayTeam">${teamOptions}</select></div>
            <div class="form-group"><label>Venue</label><input type="text" id="venue" placeholder="e.g., Blue Lock Stadium"></div>
            <div class="form-group"><label>Time</label><input type="time" id="matchTime"></div>
            <button class="btn" onclick="saveMatch('${matchdayId}')">Create Match</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>`;
        document.body.appendChild(modal);
    }).catch(err => alert('Error loading teams: ' + err.message));
}

function saveMatch(matchdayId) {
    if (!isAdmin) return;
    const homeTeam = document.getElementById('homeTeam').value;
    const awayTeam = document.getElementById('awayTeam').value;
    const venue = document.getElementById('venue').value;
    const time = document.getElementById('matchTime').value;
    if (!homeTeam || !awayTeam) { alert('Please select both teams'); return; }
    if (homeTeam === awayTeam) { alert('Home team and away team cannot be the same'); return; }
    const matchId = Date.now().toString();
    database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).set({
        homeTeam, awayTeam, venue: venue||'TBD', time: time||'12:00', status: 'scheduled',
        createdAt: Date.now(), createdBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Added match to matchday`, 'Fixtures');
        document.querySelector('.modal.active').remove();
        showSuccessMessage('Match created successfully!');
        loadFixturesContent();
    }).catch(err => alert('Error: ' + err.message));
}

function editMatch(matchdayId, matchId) {
    if (!isAdmin) return;
    Promise.all([
        database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([mSnap, tSnap]) => {
        const match = mSnap.val();
        const teams = tSnap.val() || {};
        if (!match) { alert('Match not found'); return; }
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '3000';
        let homeOptions = '<option value="">Select home team...</option>';
        let awayOptions = '<option value="">Select away team...</option>';
        Object.entries(teams).forEach(([id,team]) => {
            const selectedHome = id === match.homeTeam ? 'selected' : '';
            const selectedAway = id === match.awayTeam ? 'selected' : '';
            homeOptions += `<option value="${id}" ${selectedHome} style="color:${team.color}">${team.name}</option>`;
            awayOptions += `<option value="${id}" ${selectedAway} style="color:${team.color}">${team.name}</option>`;
        });
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h2>Edit Match</h2></div>
            <div class="form-group"><label>Home Team</label><select id="editHomeTeam">${homeOptions}</select></div>
            <div class="form-group"><label>Away Team</label><select id="editAwayTeam">${awayOptions}</select></div>
            <div class="form-group"><label>Venue</label><input type="text" id="editVenue" value="${match.venue||''}"></div>
            <div class="form-group"><label>Time</label><input type="time" id="editMatchTime" value="${match.time||'12:00'}"></div>
            <button class="btn" onclick="updateMatch('${matchdayId}', '${matchId}')">Update Match</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>`;
        document.body.appendChild(modal);
    }).catch(err => alert('Error: ' + err.message));
}

function updateMatch(matchdayId, matchId) {
    if (!isAdmin) return;
    const homeTeam = document.getElementById('editHomeTeam').value;
    const awayTeam = document.getElementById('editAwayTeam').value;
    const venue = document.getElementById('editVenue').value;
    const time = document.getElementById('editMatchTime').value;
    if (!homeTeam || !awayTeam) { alert('Please select both teams'); return; }
    if (homeTeam === awayTeam) { alert('Home team and away team cannot be the same'); return; }
    database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).update({
        homeTeam, awayTeam, venue: venue||'TBD', time: time||'12:00', updatedAt: Date.now()
    }).then(() => {
        logAction(`Updated match`, 'Fixtures');
        document.querySelector('.modal.active').remove();
        showSuccessMessage('Match updated successfully!');
        loadFixturesContent();
    }).catch(err => alert('Error: ' + err.message));
}

function deleteMatch(matchdayId, matchId) {
    if (!isAdmin) return;
    if (confirm('Delete this match?')) {
        database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).remove()
            .then(() => { logAction(`Deleted match`, 'Fixtures'); showSuccessMessage('Match deleted!'); loadFixturesContent(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

function deleteMatchday(matchdayId) {
    if (!isAdmin) return;
    if (confirm('Delete this matchday and all its matches?')) {
        database.ref(`fixtures/matchdays/${matchdayId}`).remove()
            .then(() => { logAction(`Deleted matchday`, 'Fixtures'); showSuccessMessage('Matchday deleted!'); loadFixturesContent(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

// ==================== RESULT ENTRY (with FFT) ====================
function toggleStatsInputs(prefix) {
    const legSelect = document.getElementById(prefix + '-legs');
    const goals = document.getElementById(prefix + '-goals');
    const assists = document.getElementById(prefix + '-assists');
    const saves = document.getElementById(prefix + '-saves');
    if (legSelect.value === 'dnp') {
        goals.disabled = true;
        assists.disabled = true;
        saves.disabled = true;
        goals.value = 0; assists.value = 0; saves.value = 0;
    } else {
        goals.disabled = false;
        assists.disabled = false;
        saves.disabled = false;
    }
}

function saveResultData(matchdayId, matchId, resultData, isEdit) {
    const resultId = `${matchdayId}_${matchId}`;
    return database.ref(`results/${resultId}`).once('value').then(snap => {
        const existing = snap.val();
        let ops = [];
        if (existing) {
            if (!confirm('A result already exists. Overwrite?')) return Promise.reject('cancel');
            // Revert old stats
            Object.entries(existing.playerStats || {}).forEach(([pid, stats]) => {
                const legVal = stats.legs === 'full' ? 2 : (stats.legs === 'dnp' ? 0 : 1);
                const updates = {};
                if (stats.goals) updates.goals = firebase.database.ServerValue.increment(-stats.goals);
                if (stats.assists) updates.assists = firebase.database.ServerValue.increment(-stats.assists);
                if (stats.saves) updates.saves = firebase.database.ServerValue.increment(-stats.saves);
                if (legVal) updates.legs = firebase.database.ServerValue.increment(-legVal);
                if (Object.keys(updates).length) ops.push(database.ref(`registry/players/${pid}`).update(updates));
            });
            if (existing.mvp) ops.push(database.ref(`registry/players/${existing.mvp}`).update({ awards: firebase.database.ServerValue.increment(-1) }));
            if (existing.motm && existing.motm !== existing.mvp) ops.push(database.ref(`registry/players/${existing.motm}`).update({ awards: firebase.database.ServerValue.increment(-1) }));
        }
        // Apply new result
        ops.push(database.ref(`results/${resultId}`).set(resultData));
        ops.push(database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}/status`).set('completed'));
        // Apply new stats (only if not forfeit)
        if (!resultData.forfeit) {
            Object.entries(resultData.playerStats || {}).forEach(([pid, stats]) => {
                const legVal = stats.legs === 'full' ? 2 : (stats.legs === 'dnp' ? 0 : 1);
                const updates = {};
                if (stats.goals) updates.goals = firebase.database.ServerValue.increment(stats.goals);
                if (stats.assists) updates.assists = firebase.database.ServerValue.increment(stats.assists);
                if (stats.saves) updates.saves = firebase.database.ServerValue.increment(stats.saves);
                if (legVal) updates.legs = firebase.database.ServerValue.increment(legVal);
                if (Object.keys(updates).length) ops.push(database.ref(`registry/players/${pid}`).update(updates));
            });
            if (resultData.mvp) ops.push(database.ref(`registry/players/${resultData.mvp}`).update({ awards: firebase.database.ServerValue.increment(1) }));
            if (resultData.motm && resultData.motm !== resultData.mvp) ops.push(database.ref(`registry/players/${resultData.motm}`).update({ awards: firebase.database.ServerValue.increment(1) }));
        }
        return Promise.all(ops);
    });
}

function saveMatchResults(matchdayId, matchId) {
    if (!isAdmin) return;
    const playerStats = {};
    document.querySelectorAll('[id^="home-"],[id^="away-"]').forEach(input => {
        const [team, pid, stat] = input.id.split('-');
        if (!playerStats[pid]) playerStats[pid] = { team, goals:0, assists:0, saves:0, legs:'dnp' };
        if (stat === 'goals') playerStats[pid].goals = parseInt(input.value)||0;
        if (stat === 'assists') playerStats[pid].assists = parseInt(input.value)||0;
        if (stat === 'saves') playerStats[pid].saves = parseInt(input.value)||0;
        if (stat === 'legs') {
            const sel = document.getElementById(`${team}-${pid}-legs`);
            playerStats[pid].legs = sel ? sel.value : 'dnp';
        }
    });
    const homeFouls = parseInt(document.getElementById('homeFouls').value)||0;
    const awayFouls = parseInt(document.getElementById('awayFouls').value)||0;
    const mvp = document.getElementById('mvpPlayer').value;
    const motm = document.getElementById('motmPlayer').value;
    if (!mvp || !motm) { alert('Please select both MVP and MOTM'); return; }
    let homeTotal = 0, awayTotal = 0;
    Object.values(playerStats).forEach(s => { if (s.team === 'home') homeTotal += s.goals; else awayTotal += s.goals; });
    homeTotal = Math.max(0, homeTotal - homeFouls);
    awayTotal = Math.max(0, awayTotal - awayFouls);
    const homeName = document.querySelector('.team-stats h3').textContent.trim();
    const awayName = document.querySelectorAll('.team-stats h3')[1].textContent.trim();
    const result = {
        matchdayId, matchId, homeTeam: homeName, awayTeam: awayName,
        homeScore: homeTotal, awayScore: awayTotal, homeFouls, awayFouls,
        mvp, motm, playerStats, timestamp: Date.now(), recordedBy: currentUser?.email || 'admin', forfeit: false
    };
    saveResultData(matchdayId, matchId, result, true)
        .then(() => { logAction(`Saved match results: ${homeName} ${homeTotal}-${awayTotal} ${awayName}`, 'Results'); showSuccessMessage('Match results saved!'); loadFixturesContent(); })
        .catch(e => { if (e !== 'cancel') alert('Error: ' + e); });
}

function forfeitMatch(matchdayId, matchId) {
    if (!isAdmin) return;
    Promise.all([
        database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([mSnap, tSnap]) => {
        const match = mSnap.val();
        if (!match) { alert('Match not found'); return; }
        const teams = tSnap.val() || {};
        const homeTeam = teams[match.homeTeam] || { name: 'Unknown' };
        const awayTeam = teams[match.awayTeam] || { name: 'Unknown' };
        let winner = null;
        const choice = confirm(`Forfeit match: ${homeTeam.name} vs ${awayTeam.name}\n\nClick OK if ${homeTeam.name} wins (3-0).\nClick Cancel if ${awayTeam.name} wins (3-0).`);
        if (choice) winner = 'home';
        else {
            const second = confirm(`Confirm forfeit: ${awayTeam.name} wins (3-0)?`);
            if (second) winner = 'away';
        }
        if (!winner) return;
        const homeScore = winner === 'home' ? 3 : 0;
        const awayScore = winner === 'away' ? 3 : 0;
        const result = {
            matchdayId, matchId, homeTeam: homeTeam.name, awayTeam: awayTeam.name,
            homeScore, awayScore, homeFouls:0, awayFouls:0,
            mvp: '', motm: '', playerStats: {}, timestamp: Date.now(),
            recordedBy: currentUser?.email || 'admin', forfeit: true
        };
        saveResultData(matchdayId, matchId, result, true)
            .then(() => { logAction(`Forfeit match: ${winner === 'home' ? homeTeam.name : awayTeam.name} wins by FFT`, 'Results'); showSuccessMessage('Forfeit recorded!'); loadFixturesContent(); })
            .catch(e => { if (e !== 'cancel') alert('Error: ' + e); });
    }).catch(err => alert('Error: ' + err.message));
}

function enterResults(matchdayId, matchId) {
    if (!isAdmin) return;
    currentEditingMatch = { matchdayId, matchId };
    isEditingResults = false;
    Promise.all([
        database.ref(`fixtures/matchdays/${matchdayId}/matches/${matchId}`).once('value'),
        database.ref('registry/teams').once('value'),
        database.ref('registry/players').once('value')
    ]).then(([mSnap, tSnap, pSnap]) => {
        const match = mSnap.val();
        const teams = tSnap.val() || {};
        const allPlayers = pSnap.val() || {};
        if (!match) { alert('Match not found'); return; }
        const homeTeam = teams[match.homeTeam] || { name: 'Unknown', color: '#0a1c3a' };
        const awayTeam = teams[match.awayTeam] || { name: 'Unknown', color: '#0a1c3a' };
        const homePlayers = Object.entries(allPlayers).filter(([_,p]) => p.teamId === match.homeTeam).map(([id,p])=>({id,...p}));
        const awayPlayers = Object.entries(allPlayers).filter(([_,p]) => p.teamId === match.awayTeam).map(([id,p])=>({id,...p}));
        const contentArea = document.getElementById('contentArea');
        let html = `<div class="result-entry"><h2 style="margin-bottom:2rem;">Enter Results: <span style="color:${homeTeam.color}">${homeTeam.name}</span> vs <span style="color:${awayTeam.color}">${awayTeam.name}</span></h2>
            <div class="fouls-section"><div><label style="color:${homeTeam.color}">${homeTeam.name} Fouls:</label> <input type="number" id="homeFouls" class="fouls-input" value="0" min="0"></div><div><label style="color:${awayTeam.color}">${awayTeam.name} Fouls:</label> <input type="number" id="awayFouls" class="fouls-input" value="0" min="0"></div></div>
            <div class="teams-container"><div class="team-stats"><h3 style="color:${homeTeam.color}"><div class="team-color" style="background:${homeTeam.color}"></div>${homeTeam.name}</h3><div class="player-stat-row header"><div>Player</div><div>Legs</div><div>Goals</div><div>Assists</div><div>Saves</div></div>`;
        homePlayers.forEach(p => {
            html += `<div class="player-stat-row"><div class="player-name" style="color:${homeTeam.color}" onclick="showPlayerProfile('${p.id}')">${p.name}</div><div><select class="leg-select" id="home-${p.id}-legs" onchange="toggleStatsInputs('home-${p.id}')"><option value="dnp">DNP</option><option value="full">Full</option><option value="first">1st Leg</option><option value="second">2nd Leg</option></select></div><div><input type="number" class="stat-input" id="home-${p.id}-goals" value="0" min="0" disabled></div><div><input type="number" class="stat-input" id="home-${p.id}-assists" value="0" min="0" disabled></div><div><input type="number" class="stat-input" id="home-${p.id}-saves" value="0" min="0" disabled></div></div>`;
        });
        html += `</div><div class="team-stats"><h3 style="color:${awayTeam.color}"><div class="team-color" style="background:${awayTeam.color}"></div>${awayTeam.name}</h3><div class="player-stat-row header"><div>Player</div><div>Legs</div><div>Goals</div><div>Assists</div><div>Saves</div></div>`;
        awayPlayers.forEach(p => {
            html += `<div class="player-stat-row"><div class="player-name" style="color:${awayTeam.color}" onclick="showPlayerProfile('${p.id}')">${p.name}</div><div><select class="leg-select" id="away-${p.id}-legs" onchange="toggleStatsInputs('away-${p.id}')"><option value="dnp">DNP</option><option value="full">Full</option><option value="first">1st Leg</option><option value="second">2nd Leg</option></select></div><div><input type="number" class="stat-input" id="away-${p.id}-goals" value="0" min="0" disabled></div><div><input type="number" class="stat-input" id="away-${p.id}-assists" value="0" min="0" disabled></div><div><input type="number" class="stat-input" id="away-${p.id}-saves" value="0" min="0" disabled></div></div>`;
        });
        html += `</div></div><div class="mvp-motm-section"><div class="selection-group"><label>MVP</label><select id="mvpPlayer"><option value="">Select MVP...</option>`;
        [...homePlayers, ...awayPlayers].forEach(p => {
            const col = p.teamId === match.homeTeam ? homeTeam.color : awayTeam.color;
            html += `<option value="${p.id}" style="color:${col}">${p.name}</option>`;
        });
        html += `</select></div><div class="selection-group"><label>MOTM</label><select id="motmPlayer"><option value="">Select MOTM...</option>`;
        [...homePlayers, ...awayPlayers].forEach(p => {
            const col = p.teamId === match.homeTeam ? homeTeam.color : awayTeam.color;
            html += `<option value="${p.id}" style="color:${col}">${p.name}</option>`;
        });
        html += `</select></div></div><div style="display:flex;gap:1rem;justify-content:center;">
            <button class="btn btn-success" onclick="saveMatchResults('${matchdayId}', '${matchId}')"><i class="fas fa-check"></i> Finalize</button>
            <button class="btn btn-danger" onclick="forfeitMatch('${matchdayId}', '${matchId}')"><i class="fas fa-flag-checkered"></i> FFT</button>
            <button class="btn btn-secondary" onclick="loadFixturesContent()"><i class="fas fa-times"></i> Cancel</button>
        </div></div>`;
        contentArea.innerHTML = html;
    }).catch(err => alert('Error loading match data: ' + err.message));
}

function editResults(matchdayId, matchId) {
    if (!isAdmin) return;
    isEditingResults = true;
    const resultId = `${matchdayId}_${matchId}`;
    database.ref(`results/${resultId}`).once('value').then(snap => {
        const result = snap.val();
        if (!result) { alert('No results found for this match'); return; }
        enterResults(matchdayId, matchId);
        setTimeout(() => {
            document.getElementById('homeFouls').value = result.homeFouls || 0;
            document.getElementById('awayFouls').value = result.awayFouls || 0;
            document.getElementById('mvpPlayer').value = result.mvp || '';
            document.getElementById('motmPlayer').value = result.motm || '';
            Object.entries(result.playerStats || {}).forEach(([pid, stats]) => {
                const team = stats.team;
                const legSelect = document.getElementById(`${team}-${pid}-legs`);
                const goals = document.getElementById(`${team}-${pid}-goals`);
                const assists = document.getElementById(`${team}-${pid}-assists`);
                const saves = document.getElementById(`${team}-${pid}-saves`);
                if (legSelect) {
                    legSelect.value = stats.legs || 'dnp';
                    if (window.toggleStatsInputs) window.toggleStatsInputs(`${team}-${pid}`);
                }
                if (goals) goals.value = stats.goals || 0;
                if (assists) assists.value = stats.assists || 0;
                if (saves) saves.value = stats.saves || 0;
            });
        }, 500);
    }).catch(err => alert('Error loading results: ' + err.message));
}

// ==================== RESULTS DISPLAY (with FFT handling) ====================
function deleteResult(resultId) {
    if (!isAdmin) return;
    if (!confirm('Delete this result? All stats will be reverted.')) return;
    database.ref(`results/${resultId}`).once('value').then(snap => {
        const res = snap.val();
        if (!res) { alert('Result not found'); return; }
        const ops = [];
        Object.entries(res.playerStats || {}).forEach(([pid, stats]) => {
            const legVal = stats.legs === 'full' ? 2 : (stats.legs === 'dnp' ? 0 : 1);
            const updates = {};
            if (stats.goals) updates.goals = firebase.database.ServerValue.increment(-stats.goals);
            if (stats.assists) updates.assists = firebase.database.ServerValue.increment(-stats.assists);
            if (stats.saves) updates.saves = firebase.database.ServerValue.increment(-stats.saves);
            if (legVal) updates.legs = firebase.database.ServerValue.increment(-legVal);
            if (Object.keys(updates).length) ops.push(database.ref(`registry/players/${pid}`).update(updates));
        });
        if (res.mvp) ops.push(database.ref(`registry/players/${res.mvp}`).update({ awards: firebase.database.ServerValue.increment(-1) }));
        if (res.motm && res.motm !== res.mvp) ops.push(database.ref(`registry/players/${res.motm}`).update({ awards: firebase.database.ServerValue.increment(-1) }));
        ops.push(database.ref(`fixtures/matchdays/${res.matchdayId}/matches/${res.matchId}/status`).set('scheduled'));
        ops.push(database.ref(`results/${resultId}`).remove());
        return Promise.all(ops);
    }).then(() => {
        logAction(`Deleted result: ${resultId}`, 'Results');
        showSuccessMessage('Result deleted!');
        loadResultsContent();
    }).catch(err => alert('Error: ' + err.message));
}

function loadResultsContent() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading results...</p></div>`;
    Promise.all([
        database.ref('results').once('value'),
        database.ref('registry/players').once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([resSnap, pSnap, tSnap]) => {
        const results = resSnap.val() || {};
        const players = pSnap.val() || {};
        const teams = tSnap.val() || {};
        let html = '<h2 style="margin-bottom:2rem;">Match Results</h2>';
        if (Object.keys(results).length===0) html += '<p class="warning-text">No results recorded yet.</p>';
        else {
            const sorted = Object.entries(results).sort(([,a],[,b]) => b.timestamp - a.timestamp);
            sorted.forEach(([rid, r]) => {
                const homeTeam = Object.values(teams).find(t => t.name === r.homeTeam) || { name: r.homeTeam, color: '#0a1c3a' };
                const awayTeam = Object.values(teams).find(t => t.name === r.awayTeam) || { name: r.awayTeam, color: '#0a1c3a' };
                const mvpPlayer = players[r.mvp] || { name: 'Unknown' };
                const motmPlayer = players[r.motm] || { name: 'Unknown' };
                html += `<div class="result-card" id="result-${rid}"><div class="result-header"><div><div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.5rem;"><span style="color:${homeTeam.color}">${r.homeTeam}</span><span class="result-score">${r.homeScore} - ${r.awayScore}</span><span style="color:${awayTeam.color}">${r.awayTeam}</span></div><div style="display:flex;gap:1rem;font-size:0.9rem;color:var(--text-light);"><span>Fouls: ${r.homeFouls||0} - ${r.awayFouls||0}</span><span>${new Date(r.timestamp).toLocaleString()}</span></div></div><div class="result-badges">`;
                if (!r.forfeit) {
                    html += `<span class="badge-mvp"><i class="fas fa-star"></i> MVP: ${mvpPlayer.name}</span><span class="badge-motm"><i class="fas fa-crown"></i> MOTM: ${motmPlayer.name}</span>`;
                } else {
                    html += `<span class="badge-motm" style="background:#ff8c00;"><i class="fas fa-flag-checkered"></i> WON BY FFT</span>`;
                }
                html += `<button class="expand-btn" onclick="toggleResultDetails('${rid}')"><i class="fas fa-chevron-down"></i> View Details</button>${isAdmin?`<button class="btn-delete btn-small" onclick="deleteResult('${rid}')"><i class="fas fa-trash"></i></button>`:''}</div></div><div class="result-details" id="details-${rid}">`;
                if (r.forfeit) {
                    html += `<div style="text-align:center;padding:1rem;"><i class="fas fa-info-circle"></i> Match decided by forfeit – no individual stats recorded.</div>`;
                } else {
                    html += `<div class="player-stats-grid"><div class="team-result-stats"><h4 style="color:${homeTeam.color}">${r.homeTeam} Players</h4>`;
                    Object.entries(r.playerStats || {}).filter(([_,s]) => s.team === 'home' && s.legs !== 'dnp').forEach(([pid,s]) => {
                        const p = players[pid] || { name: 'Unknown' };
                        const leg = s.legs === 'full' ? '2 Legs' : '1 Leg';
                        html += `<div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border-color);"><span class="result-player-name" style="color:${homeTeam.color}" onclick="showPlayerProfile('${pid}')">${p.name}</span><span>G:${s.goals} A:${s.assists} S:${s.saves} (${leg})</span></div>`;
                    });
                    html += `</div><div class="team-result-stats"><h4 style="color:${awayTeam.color}">${r.awayTeam} Players</h4>`;
                    Object.entries(r.playerStats || {}).filter(([_,s]) => s.team === 'away' && s.legs !== 'dnp').forEach(([pid,s]) => {
                        const p = players[pid] || { name: 'Unknown' };
                        const leg = s.legs === 'full' ? '2 Legs' : '1 Leg';
                        html += `<div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border-color);"><span class="result-player-name" style="color:${awayTeam.color}" onclick="showPlayerProfile('${pid}')">${p.name}</span><span>G:${s.goals} A:${s.assists} S:${s.saves} (${leg})</span></div>`;
                    });
                    html += `</div></div>`;
                }
                html += `</div></div>`;
            });
        }
        contentArea.innerHTML = html;
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Results</h2><p>${err.message}</p></div>`);
}

function toggleResultDetails(resultId) {
    const details = document.getElementById(`details-${resultId}`);
    const btn = event.currentTarget;
    if (details.classList.contains('active')) {
        details.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> View Details';
    } else {
        details.classList.add('active');
        btn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Details';
    }
}

function showSuccessMessage(message) {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        successMsg.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        successMsg.classList.add('active');
        setTimeout(() => successMsg.classList.remove('active'), 3000);
    }
}

// ==================== TEAM LB ====================
function loadTeamLBContent() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Calculating team standings...</p></div>`;
    Promise.all([
        database.ref('registry/teams').once('value'),
        database.ref('results').once('value')
    ]).then(([tSnap, rSnap]) => {
        const teams = tSnap.val() || {};
        const results = rSnap.val() || {};
        const teamStats = {};
        Object.keys(teams).forEach(tid => {
            teamStats[tid] = {
                name: teams[tid].name, color: teams[tid].color || '#0a1c3a',
                played:0, won:0, drawn:0, lost:0, goalsFor:0, goalsAgainst:0, points:0, streak:[]
            };
        });
        Object.values(results).forEach(res => {
            const homeId = Object.keys(teams).find(id => teams[id].name === res.homeTeam);
            const awayId = Object.keys(teams).find(id => teams[id].name === res.awayTeam);
            if (homeId && awayId) {
                teamStats[homeId].played++;
                teamStats[awayId].played++;
                teamStats[homeId].goalsFor += res.homeScore;
                teamStats[homeId].goalsAgainst += res.awayScore;
                teamStats[awayId].goalsFor += res.awayScore;
                teamStats[awayId].goalsAgainst += res.homeScore;
                if (res.homeScore > res.awayScore) {
                    teamStats[homeId].won++; teamStats[homeId].points+=3; teamStats[awayId].lost++;
                    teamStats[homeId].streak.push('W'); teamStats[awayId].streak.push('L');
                } else if (res.homeScore < res.awayScore) {
                    teamStats[awayId].won++; teamStats[awayId].points+=3; teamStats[homeId].lost++;
                    teamStats[awayId].streak.push('W'); teamStats[homeId].streak.push('L');
                } else {
                    teamStats[homeId].drawn++; teamStats[awayId].drawn++;
                    teamStats[homeId].points+=1; teamStats[awayId].points+=1;
                    teamStats[homeId].streak.push('D'); teamStats[awayId].streak.push('D');
                }
            }
        });
        Object.keys(teamStats).forEach(tid => teamStats[tid].streak = teamStats[tid].streak.slice(-5).join(''));
        const sorted = Object.entries(teamStats).map(([id, s]) => ({id, ...s})).sort((a,b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;
            return b.goalsFor - a.goalsFor;
        });
        let bestOffensive = { team: '', goals: 0 }, bestDefensive = { team: '', goalsAgainst: Infinity };
        sorted.forEach(t => {
            if (t.goalsFor > bestOffensive.goals) bestOffensive = { team: t.name, goals: t.goalsFor, color: t.color };
            if (t.goalsAgainst < bestDefensive.goalsAgainst) bestDefensive = { team: t.name, goalsAgainst: t.goalsAgainst, color: t.color };
        });
        const topTeam = sorted[0] || { name: 'N/A', points: 0, color: '#0a1c3a' };
        let html = `<div class="stats-cards"><div class="stat-card rulers"><h3><i class="fas fa-crown"></i> THE RULERS</h3><div class="value" style="color:${topTeam.color}">${topTeam.name}</div><div class="team">${topTeam.points} pts</div></div>
            <div class="stat-card offensive"><h3><i class="fas fa-fire"></i> BEST OFFENSIVE</h3><div class="value" style="color:${bestOffensive.color}">${bestOffensive.team}</div><div class="team">${bestOffensive.goals} GF</div></div>
            <div class="stat-card defensive"><h3><i class="fas fa-shield-alt"></i> BEST DEFENSIVE</h3><div class="value" style="color:${bestDefensive.color}">${bestDefensive.team}</div><div class="team">${bestDefensive.goalsAgainst} GA</div></div></div>
            <div class="leaderboard-container"><table class="leaderboard-table"><thead><tr><th>Rank</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Streak</th></tr></thead><tbody>`;
        sorted.forEach((team, idx) => {
            const rankClass = idx===0?'rank-1':(idx===1?'rank-2':(idx===2?'rank-3':''));
            const gd = team.goalsFor - team.goalsAgainst;
            html += `<tr class="${rankClass}"><td><strong>#${idx+1}</strong></td><td style="color:${team.color}">${team.name}</td><td>${team.played}</td><td class="${team.won?'stat-green':'stat-grey'}">${team.won}</td><td class="${team.drawn?'stat-green':'stat-grey'}">${team.drawn}</td><td class="${team.lost?'stat-red':'stat-grey'}">${team.lost}</td><td class="${team.goalsFor?'stat-green':'stat-grey'}">${team.goalsFor}</td><td class="${team.goalsAgainst?'stat-red':'stat-grey'}">${team.goalsAgainst}</td><td class="${gd>0?'stat-green':(gd<0?'stat-red':'stat-grey')}">${gd>0?'+'+gd:gd}</td><td class="stat-purple"><strong>${team.points}</strong></td><td>${team.streak||''}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        contentArea.innerHTML = html;
        if (typeof anime !== 'undefined') anime({ targets: '.stat-card', translateY: [20,0], opacity: [0,1], easing: 'easeOutQuad', duration: 800, delay: anime.stagger(200) });
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Team Leaderboard</h2><p>${err.message}</p></div>`);
}

// ==================== PLAYER LB ====================
function loadPlayerLBContent(category) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading player statistics...</p></div>`;
    Promise.all([
        database.ref('registry/players').once('value'),
        database.ref('registry/teams').once('value')
    ]).then(([pSnap, tSnap]) => {
        const players = pSnap.val() || {};
        const teams = tSnap.val() || {};
        let playerList = Object.entries(players).map(([id,p]) => ({
            id, ...p, teamName: teams[p.teamId]?.name || 'Unknown', teamColor: teams[p.teamId]?.color || '#0a1c3a'
        }));
        if (category === 'most-valued') {
            return database.ref('settings/values').once('value').then(sSnap => {
                const settingsData = sSnap.val() || {};
                const settings = {
                    goalValue: settingsData.goalValue || 100000,
                    assistValue: settingsData.assistValue || 100000,
                    saveValue: settingsData.saveValue || 100000
                };
                playerList = playerList.map(p => ({
                    ...p, value: (p.goals||0)*settings.goalValue + (p.assists||0)*settings.assistValue + (p.saves||0)*settings.saveValue
                }));
                return { playerList, category };
            });
        }
        return Promise.resolve({ playerList, category });
    }).then(({ playerList, category }) => {
        let sorted = [], title = '', statField = '';
        switch(category) {
            case 'most-goals': sorted = playerList.sort((a,b)=>(b.goals||0)-(a.goals||0)); title = '⚽ Most Goals'; statField = 'goals'; break;
            case 'most-assists': sorted = playerList.sort((a,b)=>(b.assists||0)-(a.assists||0)); title = '🎯 Most Assists'; statField = 'assists'; break;
            case 'most-saves': sorted = playerList.sort((a,b)=>(b.saves||0)-(a.saves||0)); title = '🧤 Most Saves'; statField = 'saves'; break;
            case 'most-awards': sorted = playerList.sort((a,b)=>(b.awards||0)-(a.awards||0)); title = '🏆 Most Awards (MVP+MOTM)'; statField = 'awards'; break;
            case 'most-valued': sorted = playerList.sort((a,b)=>(b.value||0)-(a.value||0)); title = '💰 Most Valued Players'; statField = 'value'; break;
            default: sorted = [];
        }
        sorted = sorted.slice(0,20);
        let html = `<h2 style="margin-bottom:2rem;">${title}</h2><div class="leaderboard-container"><table class="leaderboard-table"><thead><tr><th>Rank</th><th>Player</th><th>Team</th><th>${statField==='value'?'Value':statField.charAt(0).toUpperCase()+statField.slice(1)}</th>${category==='most-valued'?'<th>G</th><th>A</th><th>S</th><th>Awards</th>':''}</tr></thead><tbody>`;
        sorted.forEach((player, idx) => {
            let rankClass = '';
            if (idx===0) rankClass = 'player-rank-1';
            else if (idx===1) rankClass = 'player-rank-2';
            else if (idx===2) rankClass = 'player-rank-3';
            if (category === 'most-awards') {
                if (idx===0) rankClass = 'award-gold';
                else if (idx===1) rankClass = 'award-silver';
                else if (idx===2) rankClass = 'award-bronze';
            }
            html += `<tr class="${rankClass}" onclick="showPlayerProfile('${player.id}')" style="cursor:pointer;"><td><strong>#${idx+1}</strong></td><td>${player.name}</td><td style="color:${player.teamColor}">${player.teamName}</td>`;
            if (category === 'most-valued') {
                html += `<td class="stat-purple"><strong>$${formatCompactNumber(player.value)}</strong></td><td>${player.goals||0}</td><td>${player.assists||0}</td><td>${player.saves||0}</td><td>${player.awards||0}</td>`;
            } else {
                const val = player[statField] || 0;
                html += `<td><strong>${statField==='value'?'$'+formatCompactNumber(val):val}</strong></td>`;
            }
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        contentArea.innerHTML = html;
        if (typeof anime !== 'undefined') anime({ targets: 'tr', translateX: [-20,0], opacity: [0,1], easing: 'easeOutQuad', duration: 600, delay: anime.stagger(50) });
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Player Leaderboard</h2><p>${err.message}</p></div>`);
}

// ==================== LOGS ====================
function loadLogsContent() {
    const contentArea = document.getElementById('contentArea');
    if (!isAdmin) {
        contentArea.innerHTML = `<div class="visitor-message"><i class="fas fa-lock"></i><h3>Admin Area</h3><p>This section requires admin privileges. Please login to view logs.</p></div>`;
        return;
    }
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading logs...</p></div>`;
    database.ref('logs').orderByChild('timestamp').limitToLast(100).once('value').then(snap => {
        const logs = snap.val() || {};
        let html = `<h2 style="margin-bottom:2rem;">Admin Action Logs</h2><div class="logs-container">`;
        const sorted = Object.entries(logs).sort(([,a],[,b]) => b.timestamp - a.timestamp);
        if (sorted.length===0) html += `<p class="warning-text">No logs recorded yet.</p>`;
        else sorted.forEach(([id, log]) => {
            const date = new Date(log.timestamp).toLocaleString();
            const masked = maskEmail(log.user);
            html += `<div class="log-entry"><div><span class="log-admin">${masked}</span><span class="log-action"> - ${log.action}</span>${log.section?`<span class="log-section"> [${log.section}]</span>`:''}</div><div class="log-time">${date}</div></div>`;
        });
        html += `</div>`;
        contentArea.innerHTML = html;
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Logs</h2><p>${err.message}</p></div>`);
}

// ==================== OTHERS & SETTINGS ====================
function loadOthersContent() {
    const contentArea = document.getElementById('contentArea');
    if (!isAdmin) {
        contentArea.innerHTML = `<div class="visitor-message"><i class="fas fa-lock"></i><h3>Admin Only</h3><p>This section is only visible to administrators.</p></div>`;
        return;
    }
    database.ref('settings/values').once('value').then(snap => {
        const values = snap.val() || { goalValue: 100000, assistValue: 100000, saveValue: 100000 };
        const html = `<div class="success-message" id="successMessage"><i class="fas fa-check-circle"></i> Settings updated successfully!</div>
            <div class="settings-section"><h2><i class="fas fa-coins"></i> Player Value Settings</h2><p class="warning-text">Set the base value for each stat (Min: $100,000, Max: $10,000,000)</p>
                <div class="settings-grid">
                    <div class="setting-card"><h3>⚽ Goal Value</h3><div class="value-input-group"><label>Amount per goal <span class="current-value" id="currentGoal">$${formatCompactNumber(values.goalValue)}</span></label><input type="number" id="goalValue" min="100000" max="10000000" step="100000" value="${values.goalValue}"><div class="value-range"><span>Min: $100,000</span><span>Max: $10,000,000</span></div></div></div>
                    <div class="setting-card"><h3>🎯 Assist Value</h3><div class="value-input-group"><label>Amount per assist <span class="current-value" id="currentAssist">$${formatCompactNumber(values.assistValue)}</span></label><input type="number" id="assistValue" min="100000" max="10000000" step="100000" value="${values.assistValue}"><div class="value-range"><span>Min: $100,000</span><span>Max: $10,000,000</span></div></div></div>
                    <div class="setting-card"><h3>🧤 Save Value</h3><div class="value-input-group"><label>Amount per save <span class="current-value" id="currentSave">$${formatCompactNumber(values.saveValue)}</span></label><input type="number" id="saveValue" min="100000" max="10000000" step="100000" value="${values.saveValue}"><div class="value-range"><span>Min: $100,000</span><span>Max: $10,000,000</span></div></div></div>
                </div>
                <button class="btn btn-success" onclick="saveValueSettings()"><i class="fas fa-save"></i> Save Value Settings</button>
            </div>
            <div class="settings-section danger-zone"><h2><i class="fas fa-exclamation-triangle"></i> Danger Zone</h2><p class="warning-text">These actions cannot be undone. Proceed with caution.</p>
                <button class="btn btn-danger" onclick="showResetConfirmation()"><i class="fas fa-trash"></i> Reset League Data</button>
                <div class="reset-confirmation" id="resetConfirmation"><p>⚠️ WARNING: This will delete ALL league data except the Guide section!</p><p>Type <strong>DELETE</strong> to confirm:</p><input type="text" id="confirmDelete" placeholder="DELETE"><div style="display:flex;gap:1rem;margin-top:1rem;"><button class="btn btn-danger" onclick="resetLeague()">Confirm Reset</button><button class="btn btn-secondary" onclick="hideResetConfirmation()">Cancel</button></div></div>
            </div>`;
        contentArea.innerHTML = html;
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Settings</h2><p>${err.message}</p></div>`);
}

function saveValueSettings() {
    if (!isAdmin) return;
    const goalValue = parseInt(document.getElementById('goalValue').value);
    const assistValue = parseInt(document.getElementById('assistValue').value);
    const saveValue = parseInt(document.getElementById('saveValue').value);
    if (goalValue < 100000 || goalValue > 10000000 || assistValue < 100000 || assistValue > 10000000 || saveValue < 100000 || saveValue > 10000000) {
        alert('Please ensure all values are between $100,000 and $10,000,000'); return;
    }
    database.ref('settings/values').update({
        goalValue, assistValue, saveValue, updatedAt: Date.now(), updatedBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Updated value settings: G:$${goalValue}, A:$${assistValue}, S:$${saveValue}`, 'Settings');
        const successMsg = document.getElementById('successMessage');
        successMsg.classList.add('active');
        document.getElementById('currentGoal').textContent = '$' + formatCompactNumber(goalValue);
        document.getElementById('currentAssist').textContent = '$' + formatCompactNumber(assistValue);
        document.getElementById('currentSave').textContent = '$' + formatCompactNumber(saveValue);
        setTimeout(() => successMsg.classList.remove('active'), 3000);
    }).catch(err => alert('Error: ' + err.message));
}

function showResetConfirmation() { if (isAdmin) document.getElementById('resetConfirmation').classList.add('active'); }
function hideResetConfirmation() { document.getElementById('resetConfirmation').classList.remove('active'); document.getElementById('confirmDelete').value = ''; }
function resetLeague() {
    if (!isAdmin) return;
    if (document.getElementById('confirmDelete').value !== 'DELETE') { alert('Please type DELETE to confirm'); return; }
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Resetting league data...</p></div>`;
    if (!currentUser || !isAdmin) { alert('You must be logged in as admin to reset league data'); loadOthersContent(); return; }
    const updates = { '/registry': null, '/fixtures': null, '/results': null };
    database.ref().update(updates).then(() => {
        logAction('Reset all league data', 'Settings');
        alert('League data has been reset successfully!');
        loadOthersContent();
    }).catch(err => { console.error(err); alert('Error resetting league: ' + err.message); loadOthersContent(); });
}

// ==================== GUIDE ====================
function loadGuideContent() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<div class="content-placeholder"><div class="spinner" style="width:30px;height:30px;margin:0 auto 1rem;"></div><p>Loading guide...</p></div>`;
    database.ref('guide/sections').once('value').then(snap => {
        const sections = snap.val() || {};
        let html = '';
        if (isAdmin) {
            html += `<div class="add-section-form active" id="addSectionForm"><h3>Add New Guide Section</h3><div class="form-row"><label>Section Title</label><input type="text" id="newSectionTitle" placeholder="e.g., Getting Started"></div><div class="form-row"><label>Content</label><textarea id="newSectionContent" rows="5" placeholder="Write your guide content here..."></textarea></div><button class="btn" onclick="addGuideSection()">Add Section</button></div>`;
        } else {
            html += `<div class="visitor-message"><i class="fas fa-info-circle"></i><h3>Welcome, Visitor!</h3><p>You are currently viewing the guide. Login as admin to edit content.</p></div>`;
        }
        html += '<div class="guide-sections">';
        const sectionsArray = Object.entries(sections).map(([id,data]) => ({ id, ...data })).sort((a,b)=>(a.order||0)-(b.order||0));
        if (sectionsArray.length===0) html += `<div class="content-placeholder"><h3>No Guide Sections Yet</h3><p>${isAdmin?'Use the form above to create your first guide section.':'Check back later for guide content.'}</p></div>`;
        else {
            sectionsArray.forEach(section => {
                html += `<div class="guide-section" id="section-${section.id}"><div class="guide-section-header"><div class="guide-section-title">${section.title||'Untitled'}</div>${isAdmin?`<div><button class="btn-edit" onclick="editGuideSection('${section.id}')"><i class="fas fa-edit"></i> Edit</button><button class="btn-delete" onclick="deleteGuideSection('${section.id}')"><i class="fas fa-trash"></i> Delete</button></div>`:''}</div><div class="guide-section-content">${section.content||'No content'}</div><div class="guide-section-meta">Last updated: ${new Date(section.updatedAt||Date.now()).toLocaleString()}</div></div>`;
            });
        }
        html += '</div>';
        contentArea.innerHTML = html;
    }).catch(err => contentArea.innerHTML = `<div class="content-placeholder"><h2>Error Loading Guide</h2><p>${err.message}</p></div>`);
}

function addGuideSection() {
    if (!isAdmin) return;
    const title = document.getElementById('newSectionTitle').value;
    const content = document.getElementById('newSectionContent').value;
    if (!title || !content) { alert('Please fill in both title and content'); return; }
    const sectionId = Date.now().toString();
    database.ref(`guide/sections/${sectionId}`).set({
        title, content, order: Date.now(), updatedAt: Date.now(), createdBy: currentUser?.email || 'admin'
    }).then(() => {
        logAction(`Added guide section: ${title}`, 'Guide');
        document.getElementById('newSectionTitle').value = '';
        document.getElementById('newSectionContent').value = '';
        loadGuideContent();
    }).catch(err => alert('Error: ' + err.message));
}

function editGuideSection(sectionId) {
    if (!isAdmin) return;
    const section = document.getElementById(`section-${sectionId}`);
    const title = section.querySelector('.guide-section-title').textContent;
    const content = section.querySelector('.guide-section-content').textContent;
    const newTitle = prompt('Edit section title:', title);
    if (newTitle === null) return;
    const newContent = prompt('Edit section content:', content);
    if (newContent === null) return;
    database.ref(`guide/sections/${sectionId}`).update({ title: newTitle, content: newContent, updatedAt: Date.now() })
        .then(() => { logAction(`Edited guide section: ${newTitle}`, 'Guide'); loadGuideContent(); })
        .catch(err => alert('Error: ' + err.message));
}

function deleteGuideSection(sectionId) {
    if (!isAdmin) return;
    if (confirm('Delete this section?')) {
        database.ref(`guide/sections/${sectionId}`).remove()
            .then(() => { logAction(`Deleted guide section`, 'Guide'); loadGuideContent(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

function loadGenericContent(section) {
    const contentArea = document.getElementById('contentArea');
    if (!isAdmin) contentArea.innerHTML = `<div class="visitor-message"><i class="fas fa-lock"></i><h3>Admin Area</h3><p>This section requires admin privileges. Please login to view and edit content.</p></div>`;
    else contentArea.innerHTML = `<div class="content-placeholder"><h2>${section} Section</h2><p>This section is under development. Admin controls will be added here.</p><p style="margin-top:1rem;color:var(--text-light);">Section: ${section}</p></div>`;
}

window.onclick = function(e) { if (e.target === document.getElementById('loginModal')) document.getElementById('loginModal').classList.remove('active'); };