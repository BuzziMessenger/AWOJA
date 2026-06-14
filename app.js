/* ========================================
   AWOJA v3.1 - Complete Platform
   Auth + Maintenance + Vehicle History + PDF + QR + Stats
   ======================================== */

// ═══════════════════════════════════════════
// AWOJA BACKEND - ALTIJD naar Render!
// ═══════════════════════════════════════════
// De app.js kan via Vercel of lokaal geserveerd worden.
// In BEIDE gevallen moet de API naar Render.
// Alleen bij lokale ontwikkeling naar localhost.
// ═══════════════════════════════════════════

const CONFIG = {
    api: { base: 'https://opendata.rdw.nl', voertuigkenmerken: '/resource/m9d7-ebf2.json', brandstof: '/resource/8h6h-sast.json' },
    // Dynamische backend URL - werkt zowel lokaal als op Render
    backend: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : 'https://awoja.onrender.com',
    timeout: 10000,
};

console.log('🚗 AWOJA v3.1 | Backend:', CONFIG.backend, '| Host:', window.location.hostname);

let currentUser = null;
let authToken = localStorage.getItem('awoja-token');
let currentVehicleData = null;
let history = [];
let myVehicles = [];

const LOOKUP = {
    voertuigsoort: { '1': 'Personenauto', '2': 'Motorfiets', '3': 'Bus', '4': 'Vrachtauto', '5': 'Aanhangwagen', '7': 'Bijzonder voertuig', '8': 'Bromfiets' },
    carrosserievorm: { 'AB': 'Sedan', 'AC': 'Stationwagen', 'AD': 'Hatchback', 'AF': 'Coupe', 'AG': 'Cabriolet', 'AJ': 'MPV', 'AK': 'SUV', 'AL': 'Pick-up', 'AM': 'Kleinbus' },
    transmissie: { 'H': 'Handgeschakeld', 'A': 'Automaat', 'C': 'CVT', 'D': 'DCT' },
};

// ========================================
// UTILITIES
// ========================================
function formatKentekenDisplay(k) { if (!k) return ''; const c = k.toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length === 6 ? `${c.slice(0,2)}-${c.slice(2,4)}-${c.slice(4,6)}` : c; }
function cleanKenteken(k) { return k.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function validateKenteken(k) { const c = cleanKenteken(k); if (!c.length) return { valid: false, message: 'Voer een kenteken in.' }; if (c.length < 4) return { valid: false, message: 'Te kort.' }; return { valid: true, cleaned: c }; }
function cleanValue(v) { if (!v) return null; const t = v.trim(); return (t === '' || t === '0' || t === '00000000') ? null : t; }
function lookupValue(code, dict) { return code ? (dict[code.trim()] || code.trim()) : null; }
function formatDate(s) { if (!s || s === '00000000' || s.length !== 8) return null; const d = new Date(parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8))); if (isNaN(d)) return null; const m = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']; return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`; }
function calculateAge(s) { if (!s || s.length !== 8) return null; const f = new Date(parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8))); let y = new Date().getFullYear()-f.getFullYear(), m = new Date().getMonth()-f.getMonth(); if (m<0){y--;m+=12;} return y>=0?(y>0?`${y} jaar`:'< 1 jaar'):null; }
function formatPower(kw) { return kw && kw!=='0'?`${kw} kW (${Math.round(parseInt(kw)*1.362)} PK)`:null; }
function formatGewicht(kg) { return kg && kg!=='0'?`${parseInt(kg).toLocaleString('nl-NL')} kg`:null; }
function formatLengte(mm) { return mm && mm!=='0'?`${(parseInt(mm)/1000).toFixed(2)} m`:null; }

const ICONS = {
    identification: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
    vehicle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 11L6.5 6.5C6.8 5.6 7.6 5 8.5 5H15.5C16.4 5 17.2 5.6 17.5 6.5L19 11M5 11H19M5 11L4 17C3.8 18.1 4.7 19 5.8 19H18.2C19.3 19 20.2 18.1 20 17L19 11"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>`,
    engine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2"/></svg>`,
    dimensions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3H3v18h18V3z"/></svg>`,
    dates: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    environment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M2 12h20"/></svg>`,
    fuel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><rect x="6" y="8" width="6" height="4" rx="1"/></svg>`,
    wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    qr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M17 17h4v4h-4z"/><path d="M17 14h4v3h-4z"/><path d="M14 17h3v4h-3z"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
};

function createInfoCard(icon, title, rows) {
    if (!rows || !rows.length) return '';
    const rowsHTML = rows.map(([l,v,h])=>`<div class="info-row"><span class="info-label">${l}</span><span class="info-value${h?' highlight':''}">${v}</span></div>`).join('');
    return `<div class="info-card"><div class="info-card-header"><div class="info-card-icon">${icon}</div><h3 class="info-card-title">${title}</h3></div><div class="info-card-body">${rowsHTML}</div></div>`;
}

// ========================================
// API
// ========================================
async function fetchRDW(endpoint, params = {}) {
    const url = new URL(CONFIG.api.base + endpoint);
    Object.entries(params).forEach(([k,v]) => url.searchParams.append(k, v));
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), CONFIG.timeout);
    try { const r = await fetch(url.toString(), { signal: ctrl.signal, headers: { 'Accept': 'application/json' } }); clearTimeout(tid); if (!r.ok) throw new Error(`RDW ${r.status}`); return await r.json(); }
    catch (e) { clearTimeout(tid); throw e.name === 'AbortError' ? new Error('Verbinding verlopen.') : e; }
}

async function api(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }

    // Show loading indicator
showLoading(true);

    try {
        const r = await fetch(`${CONFIG.backend}${endpoint}`, opts);
        
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            console.log('Backend error response:', err);
            
            // Jouw nieuwe verbeterde regel
            const errorMessage = err.error || err.message || `Fout ${r.status}: ${r.statusText}`;
            
            showToast(errorMessage, 'error');
            return err;
        }
        return await r.json();
    } catch (e) {
        console.error('API Error:', e);
        showToast(`Kan geen verbinding maken met de server`, 'error');
        return null;
    } finally {
        // Zorg dat deze er altijd staat om je loading-icoon te stoppen
        showLoading(false);
    }

async function lookupKenteken(k) { const r = await fetchRDW(CONFIG.api.voertuigkenmerken, { kenteken: cleanKenteken(k), '$limit': 1 }); return r?.[0] || null; }
async function lookupFuelData(k) { try { const r = await fetchRDW(CONFIG.api.brandstof, { kenteken: cleanKenteken(k), '$limit': 5 }); return r?.length ? r : null; } catch { return null; } }

// ========================================
// TOAST & THEME
// ========================================
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = `toast ${type}`;
    document.getElementById('toast-message').textContent = msg;
    t.style.display = 'flex';
    clearTimeout(t._t);
    t._t = setTimeout(() => t.style.display = 'none', 3000);
}

function showLoading(show = true) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function toggleTheme() { const h = document.documentElement, c = h.getAttribute('data-theme'), n = c === 'dark' ? 'light' : 'dark'; h.setAttribute('data-theme', n); localStorage.setItem('awoja-theme', n); }
function loadTheme() { const s = localStorage.getItem('awoja-theme'); if (s) document.documentElement.setAttribute('data-theme', s); }

// ========================================
// AUTH
// ========================================
function openAuthModal(form = 'login') { document.getElementById('auth-modal').style.display = 'flex'; showAuthForm(form); }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function showAuthForm(form) { document.getElementById('auth-login').style.display = form === 'login' ? 'block' : 'none'; document.getElementById('auth-register').style.display = form === 'register' ? 'block' : 'none'; }

function updateAuthUI() {
    const btns = document.getElementById('auth-buttons'), menu = document.getElementById('user-menu'), dashNav = document.getElementById('nav-dashboard');
    if (currentUser) { btns.style.display = 'none'; menu.style.display = 'block'; if(dashNav) dashNav.style.display = 'block'; document.getElementById('user-initial').textContent = (currentUser.username || 'U')[0].toUpperCase(); document.getElementById('dropdown-name').textContent = currentUser.fullName || currentUser.username; document.getElementById('dropdown-email').textContent = currentUser.email; }
    else { btns.style.display = 'flex'; menu.style.display = 'none'; if(dashNav) dashNav.style.display = 'none'; }
}

function toggleUserDropdown() { const d = document.getElementById('user-dropdown'); d.style.display = d.style.display === 'none' ? 'block' : 'none'; }

async function handleLogin() {
    const login = document.getElementById('login-email').value.trim(), password = document.getElementById('login-password').value;
    if (!login || !password) { showToast('Vul alle velden in', 'error'); return; }

    // Show loading indicator
    showLoading(true);

    try {
        const r = await api('/api/auth/login', 'POST', { login, password });
        if (r?.error) { showToast(r.error, 'error'); return; }
        if (r?.token) { authToken = r.token; currentUser = r.user; localStorage.setItem('awoja-token', r.token); updateAuthUI(); closeAuthModal(); showToast(`Welkom terug, ${r.user.username}!`); loadDashboard(); }
    } finally {
        // Hide loading indicator
        showLoading(false);
    }
}

async function handleRegister() {
    const username = document.getElementById('reg-username').value.trim(), email = document.getElementById('reg-email').value.trim(), password = document.getElementById('reg-password').value, fullName = document.getElementById('reg-fullname').value.trim(), userType = document.getElementById('reg-usertype').value;
    const garageName = document.getElementById('reg-garagename')?.value.trim() || '';
    if (!username || !email || !password) { showToast('Vul alle verplichte velden in', 'error'); return; }

    // Show loading indicator
    showLoading(true);

    try {
        const r = await api('/api/auth/register', 'POST', { username, email, password, fullName, userType, garageName });
        if (r?.error) { showToast(r.error, 'error'); return; }
        if (r?.token) { authToken = r.token; currentUser = r.user; localStorage.setItem('awoja-token', r.token); updateAuthUI(); closeAuthModal(); showToast(`Welkom bij AWOJA, ${r.user.username}!`); }
    } finally {
        // Hide loading indicator
        showLoading(false);
    }
}

function handleLogout() { authToken = null; currentUser = null; localStorage.removeItem('awoja-token'); updateAuthUI(); showToast('Uitgelogd'); showSection('home'); document.getElementById('user-dropdown').style.display = 'none'; }

async function checkAuth() {
    if (!authToken) return;
    const r = await api('/api/auth/me');
    if (r?._id) { currentUser = { id: r._id, username: r.username, email: r.email, fullName: r.fullName, userType: r.userType, garageName: r.garageName }; updateAuthUI(); loadDashboard(); }
    else { authToken = null; localStorage.removeItem('awoja-token'); }
}

// ========================================
// UI
// ========================================
const UI = {};
function initUI() {
    ['input','search-btn','loading','error','error-title','error-message','results','action-bar','vehicle-header','vehicle-stats','info-grid','fuel-section','recent-section','recent-grid'].forEach(id => {
        UI[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    });
}
function showLoading() { hideAll(); UI.loading.style.display = 'block'; UI.searchBtn.disabled = true; }
function showError(t, m) { hideAll(); UI.errorTitle.textContent = t; UI.errorMessage.textContent = m; UI.error.style.display = 'block'; UI.searchBtn.disabled = false; }
function showResults() { hideAll(); UI.results.style.display = 'block'; UI.actionBar.style.display = 'flex'; UI.searchBtn.disabled = false; setTimeout(() => UI.results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }
function hideAll() { ['loading','error','results'].forEach(id => { document.getElementById(id).style.display = 'none'; }); UI.actionBar.style.display = 'none'; }
function setLoadingState(l) { UI.searchBtn.disabled = l; UI.searchBtn.querySelector('.btn-text').textContent = l ? 'Zoeken...' : 'Zoek'; }

function showSection(s) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
    const t = document.getElementById(`section-${s}`); if (t) t.style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(l => { l.classList.remove('active'); });
    document.querySelectorAll('.nav-link').forEach(l => { const txt = l.textContent.toLowerCase(); if ((s==='home' && txt==='zoeken') || (s==='compare' && txt==='vergelijken') || (s==='dashboard' && txt.includes('auto')) || (s==='about' && txt.includes('over'))) l.classList.add('active'); });
    if (s === 'dashboard') loadDashboard();
    if (s === 'home') loadHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return false;
}

// ========================================
// DISPLAY RESULTS
// ========================================
function displayResults(data) {
    currentVehicleData = data;
    const k = cleanValue(data.kenteken), m = cleanValue(data.merk), h = cleanValue(data.handelsbenaming);
    let hdr = `<div class="vehicle-header-left"><div class="vehicle-kenteken">${formatKentekenDisplay(k)}</div>`;
    if (m||h) hdr += `<div class="vehicle-merk-model">${[m,h].filter(Boolean).join(' ')}</div>`;
    hdr += '</div><div class="vehicle-header-right">';
    const vs = lookupValue(data.voertuigsoort, LOOKUP.voertuigsoort);
    if (vs) hdr += `<span class="vehicle-badge">${vs}</span>`;
    const kl = cleanValue(data.kleur) || cleanValue(data.eerste_kleur);
    if (kl) hdr += `<span class="vehicle-badge">${kl}</span>`;
    hdr += '</div>';
    UI.vehicleHeader.innerHTML = hdr;

    const fr = cleanValue(data.datum_eerste_toelating), age = fr ? calculateAge(fr) : null;
    const bs = cleanValue(data.brandstof), vm = cleanValue(data.vermogen_motor) || cleanValue(data.max_vermogen);
    const co2 = cleanValue(data.co2_uitstoot) || cleanValue(data.co2_emissie_g_km_combi);
    const apk = cleanValue(data.apk_vervaldatum);
    let stats = '';
    if (age) stats += `<div class="stat-card"><div class="stat-value">${age}</div><div class="stat-label">Leeftijd</div></div>`;
    if (fr) stats += `<div class="stat-card"><div class="stat-value">${formatDate(fr)}</div><div class="stat-label">Eerste toelating</div></div>`;
    if (bs) stats += `<div class="stat-card"><div class="stat-value">${bs}</div><div class="stat-label">Brandstof</div></div>`;
    if (vm) stats += `<div class="stat-card"><div class="stat-value">${vm} kW</div><div class="stat-label">Vermogen</div></div>`;
    if (co2) stats += `<div class="stat-card"><div class="stat-value">${co2} g</div><div class="stat-label">CO2/km</div></div>`;
    if (apk) stats += `<div class="stat-card"><div class="stat-value">${formatDate(apk)}</div><div class="stat-label">APK</div></div>`;
    if (stats) { UI.vehicleStats.innerHTML = stats; UI.vehicleStats.style.display = 'grid'; } else UI.vehicleStats.style.display = 'none';

    const R = (label, val) => val ? [label, val] : null;
    let cards = '';
    cards += createInfoCard(ICONS.identification, 'Identificatie', [R('Kenteken', formatKentekenDisplay(k)), R('Merk', cleanValue(data.merk)), R('Handelsbenaming', cleanValue(data.handelsbenaming)), R('Soort', vs), R('Type', cleanValue(data.type)), R('Variant', cleanValue(data.variant)), R('Uitvoering', cleanValue(data.uitvoering)), R('Kleur 1', cleanValue(data.kleur) || cleanValue(data.eerste_kleur)), R('Kleur 2', cleanValue(data.tweede_kleur))].filter(Boolean));
    cards += createInfoCard(ICONS.vehicle, 'Voertuigkenmerken', [R('Carrosserie', lookupValue(data.carrosserievorm, LOOKUP.carrosserievorm)), R('Deuren', cleanValue(data.aantal_deuren)), R('Zitplaatsen', cleanValue(data.aantal_zitplaatsen)), R('Wielen', cleanValue(data.aantal_wielen)), R('Assen', cleanValue(data.aantal_assen)), R('Transmissie', lookupValue(data.transmissietype, LOOKUP.transmissie)), R('Versnellingen', cleanValue(data.aantal_versnellingen)), R('Wielbasis', cleanValue(data.wielbasis)?`${data.wielbasis} mm`:null), R('Draaicirkel', cleanValue(data.draaicirkel)?`${data.draaicirkel} m`:null)].filter(Boolean));
    cards += createInfoCard(ICONS.engine, 'Motor & Prestaties', [R('Brandstof', bs), R('Vermogen', formatPower(data.vermogen_motor)), R('Max. vermogen', formatPower(data.max_vermogen)), R('Cilinderinhoud', cleanValue(data.cilinderinhoud)?`${data.cilinderinhoud} cc`:null), R('Cilinders', cleanValue(data.aantal_cilinders)), R('Koppel', cleanValue(data.koppel)?`${data.koppel} Nm`:null), R('Aandrijving', cleanValue(data.aandrijving)), R('Max snelheid', cleanValue(data.toegestane_maximum_snelheid)?`${data.toegestane_maximum_snelheid} km/h`:null)].filter(Boolean));
    cards += createInfoCard(ICONS.dimensions, 'Afmetingen & Gewicht', [R('Lengte', formatLengte(data.voertuiglengte)), R('Breedte', cleanValue(data.voertuigbreedte)?`${data.voertuigbreedte} mm`:null), R('Hoogte', cleanValue(data.voertuighoogte)?`${data.voertuighoogte} mm`:null), R('Massa', formatGewicht(data.massavehikel)), R('Ledig', formatGewicht(data.massa_ledig_voertuig)), R('Max massa', formatGewicht(data.massa_max_toeg_totaal)), R('Aanh. geremd', formatGewicht(data.max_massa_geremd)), R('Aanh. ongeremd', formatGewicht(data.max_massa_ongeremd))].filter(Boolean));
    cards += createInfoCard(ICONS.dates, 'Data & Registratie', [R('Eerste toelating', formatDate(data.datum_eerste_toelating)), R('Tenaamstelling NL', formatDate(data.datum_eerste_tenaamstelling_nl)), R('APK vervaldatum', formatDate(data.apk_vervaldatum)), R('Tenaamstelling', formatDate(data.datum_tenaamstelling)), R('Export', cleanValue(data.exportindicator)), R('Tellerstand', cleanValue(data.tellerstand_ossographie)?`${parseInt(data.tellerstand_ossographie).toLocaleString('nl-NL')} km`:null)].filter(Boolean));
    cards += createInfoCard(ICONS.environment, 'Milieu', [R('CO2', cleanValue(data.co2_uitstoot)?`${data.co2_uitstoot} g/km`:null), R('CO2 combi', cleanValue(data.co2_emissie_g_km_combi)?`${data.co2_emissie_g_km_combi} g/km`:null), R('Energielabel', cleanValue(data.energielabel)), R('Roet', cleanValue(data.roetuitstoot)?`${data.roetuitstoot} mg/km`:null), R('NOx', cleanValue(data.nox_uitstoot)?`${data.nox_uitstoot} mg/km`:null)].filter(Boolean));

    const fuelRows = [R('Stad', cleanValue(data.verbruik_stad)?`${data.verbruik_stad} l/100km`:null), R('Buiten', cleanValue(data.verbruik_buiten)?`${data.verbruik_buiten} l/100km`:null), R('Combi', cleanValue(data.verbruik_gecombineerd)?`${data.verbruik_gecombineerd} l/100km`:null)].filter(Boolean);
    if (fuelRows.length) cards += createInfoCard(ICONS.fuel, 'Brandstof & Verbruik', fuelRows);

    const otherRows = [R('Bandenmaat voor', cleanValue(data.bandenmaat_voor)), R('Bandenmaat achter', cleanValue(data.bandenmaat_achter)), R('Bodemvrijheid', cleanValue(data.bodemvrijheid)?`${data.bodemvrijheid} mm`:null)].filter(Boolean);
    if (otherRows.length) cards += createInfoCard(ICONS.other, 'Overig', otherRows);

    UI.infoGrid.innerHTML = cards;
    showResults();
    loadMaintenanceSummary(k);
    generateQRCode(k);
}

function displayFuelData(fuels) {
    if (!fuels?.length) { UI.fuelSection.style.display = 'none'; return; }
    let h = '';
    fuels.forEach(f => { const b = cleanValue(f.brandstof)||cleanValue(f.type_brandstof); const r = [['Stad', cleanValue(f.verbruik_stad)?`${f.verbruik_stad} l/100km`:null],['Buiten', cleanValue(f.verbruik_buiten)?`${f.verbruik_buiten} l/100km`:null],['Combi', cleanValue(f.verbruik_combi)?`${f.verbruik_combi} l/100km`:null]].filter(([,v])=>v); if (r.length) h += createInfoCard(ICONS.fuel, `Verbruik${b?' - '+b:''}`, r); });
    UI.fuelSection.innerHTML = h ? `<div class="info-grid">${h}</div>` : ''; UI.fuelSection.style.display = h ? 'block' : 'none';
}

// ========================================
// QR CODE GENERATOR
// ========================================
function generateQRCode(kenteken) {
    const qrSection = document.getElementById('qr-section');
    if (!qrSection || !kenteken) return;
    const url = `${window.location.origin}${window.location.pathname}?kenteken=${kenteken}`;
    const size = 150;
    // Simple QR code using API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=svg&color=1e3a8a&bgcolor=ffffff`;
    qrSection.innerHTML = `
        <div class="qr-card">
            <h3>📱 QR Code voor verkoop</h3>
            <p>Laat kopers deze QR-code scannen voor alle voertuiggegevens</p>
            <img src="${qrUrl}" alt="QR Code ${kenteken}" class="qr-image" />
            <p class="qr-url">${url}</p>
            <button class="btn-outline" onclick="downloadQR('${qrUrl}', '${kenteken}')">Download QR Code</button>
        </div>`;
    qrSection.style.display = 'block';
}

function downloadQR(url, kenteken) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `AWOJA-${kenteken}-QR.png`;
    a.click();
    showToast('QR Code gedownload!');
}

// ========================================
// PDF RAPPORT GENERATOR
// ========================================
function generatePDFReport() {
    if (!currentVehicleData) return;
    const d = currentVehicleData;
    const k = cleanValue(d.kenteken);
    const lines = [
        '╔══════════════════════════════════════════╗',
        '║     AWOJA - ALLES WETEN OVER JE AUTO     ║',
        '╚══════════════════════════════════════════╝',
        '',
        `  RAPPORT gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`,
        `  Kenteken: ${formatKentekenDisplay(k)}`,
        '',
        '════════════════════════════════════════════',
        '  IDENTIFICATIE',
        '════════════════════════════════════════════',
        `  Kenteken:         ${formatKentekenDisplay(k)}`,
        `  Merk:             ${d.merk || '-'}`,
        `  Model:            ${d.handelsbenaming || '-'}`,
        `  Voertuigsoort:    ${lookupValue(d.voertuigsoort, LOOKUP.voertuigsoort) || '-'}`,
        `  Kleur:            ${d.kleur || d.eerste_kleur || '-'}`,
        `  Type:             ${d.type || '-'}`,
        '',
        '════════════════════════════════════════════',
        '  MOTOR & PRESTATIES',
        '════════════════════════════════════════════',
        `  Brandstof:        ${d.brandstof || '-'}`,
        `  Vermogen:         ${d.vermogen_motor || d.max_vermogen || '-'} kW`,
        `  Cilinderinhoud:   ${d.cilinderinhoud || '-'} cc`,
        `  Cilinders:        ${d.aantal_cilinders || '-'}`,
        `  Transmissie:      ${lookupValue(d.transmissietype, LOOKUP.transmissie) || '-'}`,
        `  Aandrijving:      ${d.aandrijving || '-'}`,
        '',
        '════════════════════════════════════════════',
        '  AFMETINGEN & GEWICHT',
        '════════════════════════════════════════════',
        `  Lengte:           ${d.voertuiglengte ? (d.voertuiglengte/1000).toFixed(2)+' m' : '-'}`,
        `  Breedte:          ${d.voertuigbreedte ? d.voertuigbreedte+' mm' : '-'}`,
        `  Hoogte:           ${d.voertuighoogte ? d.voertuighoogte+' mm' : '-'}`,
        `  Massa:            ${d.massavehikel ? parseInt(d.massavehikel).toLocaleString('nl-NL')+' kg' : '-'}`,
        `  Max. massa:       ${d.massa_max_toeg_totaal ? parseInt(d.massa_max_toeg_totaal).toLocaleString('nl-NL')+' kg' : '-'}`,
        '',
        '════════════════════════════════════════════',
        '  DATA & REGISTRATIE',
        '════════════════════════════════════════════',
        `  Eerste toelating: ${formatDate(d.datum_eerste_toelating) || '-'}`,
        `  Tenaamstelling:   ${formatDate(d.datum_eerste_tenaamstelling_nl) || '-'}`,
        `  APK vervaldatum:  ${formatDate(d.apk_vervaldatum) || '-'}`,
        '',
        '════════════════════════════════════════════',
        '  MILIEU & UITSTOOT',
        '════════════════════════════════════════════',
        `  CO2 uitstoot:     ${d.co2_uitstoot || '-'} g/km`,
        `  Energielabel:     ${d.energielabel || '-'}`,
        '',
        '════════════════════════════════════════════',
        '  Bron: RDW Open Data via AWOJA',
        '  Website: awoja.netlify.app',
        '════════════════════════════════════════════',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AWOJA-${k}-rapport.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rapport gedownload!');
}

// ========================================
// COST OVERVIEW (from maintenance records)
// ========================================
let currentRecords = [];

async function loadMaintenanceSummary(kenteken) {
    const section = document.getElementById('maintenance-section');
    const summary = document.getElementById('maintenance-summary');
    const records = await api(`/api/records/${kenteken}`);
    currentRecords = records || [];
    if (!currentRecords.length) { section.style.display = 'none'; summary.style.display = 'none'; return; }

    const totalCost = currentRecords.reduce((s, r) => s + (r.cost || 0), 0);
    const typeCounts = {};
    currentRecords.forEach(r => { typeCounts[r.type] = (typeCounts[r.type]||0) + 1; });

    // Calculate cost by type
    const costByType = {};
    currentRecords.forEach(r => { if (!costByType[r.type]) costByType[r.type] = 0; costByType[r.type] += (r.cost || 0); });

    summary.style.display = 'block';
    summary.innerHTML = `
        <div class="maintenance-summary-card">
            <div class="ms-header"><span class="ms-icon">${ICONS.wrench}</span><h3>Onderhoudshistorie</h3></div>
            <div class="ms-stats">
                <div class="ms-stat"><span class="ms-stat-value">${currentRecords.length}</span><span class="ms-stat-label">Records</span></div>
                <div class="ms-stat"><span class="ms-stat-value">€${totalCost.toLocaleString('nl-NL',{minimumFractionDigits:0})}</span><span class="ms-stat-label">Totaal kosten</span></div>
                ${Object.entries(typeCounts).map(([t,c])=>`<div class="ms-stat"><span class="ms-stat-value">${c}</span><span class="ms-stat-label">${t}</span></div>`).join('')}
            </div>
            <div class="cost-breakdown" style="margin-top:16px;">
                <h4 style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">Kosten per categorie</h4>
                ${Object.entries(costByType).filter(([,cost])=>cost>0).map(([type,cost])=>{
                    const pct = totalCost > 0 ? Math.round((cost/totalCost)*100) : 0;
                    return `<div class="cost-bar"><div class="cost-bar-label">${type} <span>€${cost.toLocaleString('nl-NL')} (${pct}%)</span></div><div class="cost-bar-track"><div class="cost-bar-fill" style="width:${pct}%"></div></div></div>`;
                }).join('')}
            </div>
        </div>`;

    let timeline = '<div class="timeline">';
    currentRecords.forEach(r => {
        const typeColors = { reparatie:'#ef4444', onderhoud:'#3b82f6', apk:'#10b981', banden:'#f59e0b', beurt:'#8b5cf6', schade:'#ec4899', anders:'#6b7280' };
        const color = typeColors[r.type] || '#6b7280';
        timeline += `<div class="timeline-item"><div class="timeline-dot" style="background:${color}"></div><div class="timeline-content"><div class="timeline-header"><span class="timeline-type" style="color:${color}">${r.type}</span><span class="timeline-date">${r.date||''}</span></div><h4>${r.title}</h4>${r.description?`<p>${r.description}</p>`:''}<div class="timeline-meta">${r.cost?`<span>€${r.cost.toFixed(2)}</span>`:''}${r.mileage?`<span>${r.mileage.toLocaleString('nl-NL')} km</span>`:''}${r.garage?`<span>📍 ${r.garage}</span>`:''}${r.createdBy?`<span>✍️ ${r.createdBy}</span>`:''}</div>${r.parts?.length?`<div class="timeline-parts">${r.parts.map(p=>`<span class="part-tag">${p}</span>`).join('')}</div>`:''}</div></div>`;
    });
    timeline += '</div>';
    section.style.display = 'block';
    section.innerHTML = `<div class="container"><div class="section-header-row"><h2 class="section-title">${ICONS.wrench} Onderhoudschronologie</h2></div>${timeline}</div>`;
}

// ========================================
// RECORD MODAL
// ========================================
function openRecordModal() {
    if (!currentUser) { openAuthModal('login'); showToast('Log in om records toe te voegen', 'error'); return; }
    if (!currentVehicleData) return;
    document.getElementById('record-modal').style.display = 'flex';
    document.getElementById('record-kenteken').value = cleanValue(currentVehicleData.kenteken);
    document.getElementById('record-kenteken-display').textContent = formatKentekenDisplay(cleanValue(currentVehicleData.kenteken));
    document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
}

function closeRecordModal() { document.getElementById('record-modal').style.display = 'none'; }

async function saveRecord() {
    const kenteken = document.getElementById('record-kenteken').value;
    const type = document.getElementById('record-type').value;
    const title = document.getElementById('record-title').value.trim();
    if (!title) { showToast('Vul een titel in', 'error'); return; }

    // Handle file uploads
    const fileInput = document.getElementById('record-files');
    const files = fileInput.files;
    let mediaUrls = [];

    if (files.length > 0) {
        showLoading(true);
        try {
            // Upload files to backend
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            const uploadResponse = await fetch(`${CONFIG.backend}/api/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                showToast(error.error || 'Fout bij uploaden van bestanden', 'error');
                showLoading(false);
                return;
            }

            const uploadResult = await uploadResponse.json();
            mediaUrls = uploadResult.urls || [];
        } catch (error) {
            console.error('Upload error:', error);
            showToast('Fout bij uploaden van bestanden', 'error');
            showLoading(false);
            return;
        } finally {
            showLoading(false);
        }
    }

    const data = {
        kenteken,
        type,
        title,
        description: document.getElementById('record-description').value.trim(),
        cost: document.getElementById('record-cost').value,
        date: document.getElementById('record-date').value,
        mileage: document.getElementById('record-mileage').value,
        garage: document.getElementById('record-garage').value.trim(),
        nextServiceDate: document.getElementById('record-next-date').value,
        nextServiceMileage: document.getElementById('record-next-mileage').value,
        parts: document.getElementById('record-parts').value.split(',').map(p=>p.trim()).filter(Boolean),
        media: mediaUrls
    };

    const r = await api('/api/records', 'POST', data);
    if (r?.error) { showToast(r.error, 'error'); return; }
    closeRecordModal();
    showToast('Record toegevoegd!');
    loadMaintenanceSummary(kenteken);
}

// ========================================
// MAIN SEARCH
// ========================================
async function searchKenteken() {
    const input = document.getElementById('kenteken-input').value.trim();
    const v = validateKenteken(input);
    if (!v.valid) { showError('Ongeldig kenteken', v.message); return; }
    showLoading(); setLoadingState(true);
    try {
        const data = await lookupKenteken(v.cleaned);
        if (!data) { showError('Niet gevonden', `Geen voertuig gevonden met ${formatKentekenDisplay(v.cleaned)}.`); return; }
        displayAllVehicleInformation(data);
        const fuel = await lookupFuelData(v.cleaned);
        displayFuelData(fuel);
        api('/api/history', 'POST', { kenteken: v.cleaned, merk: data.merk, handelsbenaming: data.handelsbenaming, kleur: data.kleur });
        const url = new URL(window.location); url.searchParams.set('kenteken', v.cleaned); window.history.replaceState({}, '', url);
    } catch (e) { showError('Fout', e.message || 'Kon geen verbinding maken met de RDW.'); }
    finally { setLoadingState(false); }
}

// ========================================
// HISTORY
// ========================================
async function loadHistory() { let d = await api('/api/history'); if (!d?.length) d = JSON.parse(localStorage.getItem('awoja-history')||'[]'); history = d; renderHistory(); }
function renderHistory() { const s = document.getElementById('recent-section'), g = document.getElementById('recent-grid'); if (!history?.length) { s.style.display = 'none'; return; } s.style.display = 'block'; g.innerHTML = history.slice(0,8).map(i=>`<div class="recent-card" onclick="quickSearch('${i.kenteken}')"><div class="recent-card-kenteken">${formatKentekenDisplay(i.kenteken)}</div><div class="recent-card-info">${i.merk||''} ${i.handelsbenaming||''}</div></div>`).join(''); }
async function clearHistory() { await api('/api/history','DELETE'); localStorage.removeItem('awoja-history'); history=[]; renderHistory(); showToast('Geschiedenis gewist'); }
function quickSearch(k) { document.getElementById('kenteken-input').value = k; searchKenteken(); }

// ========================================
// DASHBOARD
// ========================================
async function loadDashboard() {
    if (!currentUser) return;
    myVehicles = await api('/api/my-vehicles') || [];
    const list = document.getElementById('my-vehicles-list');
    if (!myVehicles.length) { list.innerHTML = '<p class="text-muted">Nog geen voertuigen toegevoegd.</p>'; return; }
    list.innerHTML = myVehicles.map(v=>`<div class="vehicle-card" onclick="quickSearch('${v.kenteken}')"><div class="vc-kenteken">${formatKentekenDisplay(v.kenteken)}</div><div class="vc-alias">${v.alias||''}</div><button class="btn-icon" onclick="event.stopPropagation();removeMyVehicle('${v.kenteken}')">🗑️</button></div>`).join('');
    if (currentUser.userType==='garage'||currentUser.userType==='both') { const records = await api('/api/garage/records')||[]; const gl = document.getElementById('garage-records-list'); if (records.length) gl.innerHTML = records.slice(0,20).map(r=>`<div class="garage-record"><strong>${formatKentekenDisplay(r.kenteken)}</strong> - ${r.title} <small>${r.date||''}</small>${r.cost?` €${r.cost.toFixed(2)}`:''}</div>`).join(''); }
}

async function addMyVehicle() { if (!currentUser) { openAuthModal('login'); return; } const k = document.getElementById('add-vehicle-kenteken').value.trim(); const v = validateKenteken(k); if (!v.valid) { showToast('Ongeldig kenteken', 'error'); return; } await api('/api/my-vehicles','POST',{kenteken:v.cleaned}); document.getElementById('add-vehicle-kenteken').value=''; showToast('Voertuig toegevoegd!'); loadDashboard(); }
async function removeMyVehicle(k) { await api(`/api/my-vehicles/${k}`,'DELETE'); showToast('Verwijderd'); loadDashboard(); }

// ========================================
// COMPARE
// ========================================
async function compareVehicles() {
    const i1 = document.getElementById('compare-input-1').value.trim(), i2 = document.getElementById('compare-input-2').value.trim();
    const v1 = validateKenteken(i1), v2 = validateKenteken(i2);
    if (!v1.valid) { showCompareError('Fout', v1.message); return; }
    if (!v2.valid) { showCompareError('Fout', v2.message); return; }
    document.getElementById('compare-loading').style.display='block';
    document.getElementById('compare-results').style.display='none';
    document.getElementById('compare-error').style.display='none';
    try { const [d1,d2] = await Promise.all([lookupKenteken(v1.cleaned),lookupKenteken(v2.cleaned)]); if(!d1){showCompareError('Niet gevonden',`${formatKentekenDisplay(v1.cleaned)} niet gevonden.`);return;} if(!d2){showCompareError('Niet gevonden',`${formatKentekenDisplay(v2.cleaned)} niet gevonden.`);return;} renderComparison(d1,d2); }
    catch(e){showCompareError('Fout',e.message);}
    finally{document.getElementById('compare-loading').style.display='none';}
}

function showCompareError(t,m){document.getElementById('compare-loading').style.display='none';document.getElementById('compare-error-title').textContent=t;document.getElementById('compare-error-message').textContent=m;document.getElementById('compare-error').style.display='block';}

function renderComparison(d1,d2){
    const fields=[{l:'Merk',k:'merk'},{l:'Model',k:'handelsbenaming'},{l:'Kleur',k:'kleur',a:'eerste_kleur'},{l:'Brandstof',k:'brandstof'},{l:'Vermogen (kW)',k:'vermogen_motor',n:1},{l:'Gewicht (kg)',k:'massavehikel',n:1},{l:'Eerste toelating',k:'datum_eerste_toelating',d:1},{l:'CO2 (g/km)',k:'co2_uitstoot',n:1},{l:'APK',k:'apk_vervaldatum',d:1}];
    const k1=formatKentekenDisplay(cleanValue(d1.kenteken)),k2=formatKentekenDisplay(cleanValue(d2.kenteken));
    let t=`<table class="compare-table"><thead><tr><th>Specificatie</th><th class="compare-header-cell"><div class="compare-kenteken">${k1}</div><div class="compare-merk">${d1.merk||''} ${d1.handelsbenaming||''}</div></th><th class="compare-header-cell"><div class="compare-kenteken">${k2}</div><div class="compare-merk">${d2.merk||''} ${d2.handelsbenaming||''}</div></th></tr></thead><tbody>`;
    fields.forEach(f=>{
        let a=f.a?(d1[f.k]||d1[f.a]):d1[f.k],b=f.a?(d2[f.k]||d2[f.a]):d2[f.k];
        if(f.d){a=formatDate(a);b=formatDate(b);}if(f.n){a=a?parseInt(a):null;b=b?parseInt(b):null;}
        const da=a!=null&&a!==''?String(a):'-',db=b!=null&&b!==''?String(b):'-';
        let ca='',cb='';if(f.n&&a&&b&&a!==b){if(f.k==='co2_uitstoot'){if(a<b)ca='winner';else if(b<a)cb='winner';}else{if(a>b)ca='winner';else if(b>a)cb='winner';}}
        t+=`<tr><td>${f.l}</td><td class="${ca}">${da}</td><td class="${cb}">${db}</td></tr>`;
    });
    document.getElementById('compare-results').innerHTML=t+'</tbody></table>';
    document.getElementById('compare-results').style.display='block';
}

// ========================================
// SHARE / COPY / PRINT
// ========================================
function shareKenteken(){if(!currentVehicleData)return;const k=cleanValue(currentVehicleData.kenteken);const url=`${window.location.origin}${window.location.pathname}?kenteken=${k}`;if(navigator.share){navigator.share({title:`AWOJA - ${formatKentekenDisplay(k)}`,url});}else if(navigator.clipboard){navigator.clipboard.writeText(url);showToast('Link gekopieerd!');}}
function copyInfo(){if(!currentVehicleData)return;const d=currentVehicleData;const lines=[`AWOJA - Voertuiggegevens`,`Kenteken: ${formatKentekenDisplay(cleanValue(d.kenteken))}`,`Merk: ${d.merk||'-'}`,`Model: ${d.handelsbenaming||'-'}`,`Brandstof: ${d.brandstof||'-'}`,`Vermogen: ${d.vermogen_motor||d.max_vermogen||'-'} kW`,`Bron: RDW Open Data via AWOJA`];if(navigator.clipboard){navigator.clipboard.writeText(lines.join('\n'));showToast('Gekopieerd!');}}
function printVehicle(){window.print();}

// ========================================
// NEW FEATURES - COMPREHENSIVE CAR INFORMATION
// ========================================

function closeVideoModal() {
    document.getElementById('video-modal').style.display = 'none';
}

function openVideoModal(title, url) {
    const modal = document.getElementById('video-modal');
    document.getElementById('video-title').textContent = title;
    document.getElementById('video-iframe').src = url;
    modal.style.display = 'flex';
}

function displayOwnerHistory(vehicleData) {
    const section = document.getElementById('owner-history-section');
    const content = document.getElementById('owner-history-content');

    if (!vehicleData || !vehicleData.aantal_eigenaren) {
        section.style.display = 'none';
        return;
    }

    let html = `
        <div class="info-card">
            <p><strong>Aantal eigenaren:</strong> ${vehicleData.aantal_eigenaren || 'Onbekend'}</p>
            <p><strong>Eerste toelating:</strong> ${formatDate(vehicleData.datum_eerste_toelating) || 'Onbekend'}</p>
            <p><strong>Eerste toelating NL:</strong> ${formatDate(vehicleData.datum_eerste_toelating_nl) || 'Onbekend'}</p>
        </div>
    `;

    content.innerHTML = html;
    section.style.display = 'block';
}

function displayTechnicalSpecs(vehicleData) {
    const section = document.getElementById('technical-specs-section');
    const content = document.getElementById('technical-specs-content');

    if (!vehicleData) {
        section.style.display = 'none';
        return;
    }

    let html = `
        <div class="info-grid">
            <div class="info-card">
                <h4>Afmetingen & Gewichten</h4>
                <p><strong>Lengte:</strong> ${formatLengte(vehicleData.lengte) || 'Onbekend'}</p>
                <p><strong>Breedte:</strong> ${formatLengte(vehicleData.breedte) || 'Onbekend'}</p>
                <p><strong>Massa ledig voertuig:</strong> ${formatGewicht(vehicleData.massa_ledig_voertuig) || 'Onbekend'}</p>
                <p><strong>Massa rijklaar:</strong> ${formatGewicht(vehicleData.massa_rijklaar) || 'Onbekend'}</p>
                <p><strong>Maximaal toegestane massa:</strong> ${formatGewicht(vehicleData.maximale_massa) || 'Onbekend'}</p>
            </div>
            <div class="info-card">
                <h4>Motor & Prestaties</h4>
                <p><strong>Vermogen:</strong> ${formatPower(vehicleData.vermogen_motor || vehicleData.max_vermogen) || 'Onbekend'}</p>
                <p><strong>Cilinderinhoud:</strong> ${vehicleData.cilinderinhoud ? vehicleData.cilinderinhoud + ' cc' : 'Onbekend'}</p>
                <p><strong>Aantal cilinders:</strong> ${vehicleData.aantal_cilinders || 'Onbekend'}</p>
                <p><strong>Transmissie:</strong> ${lookupValue(vehicleData.transmissie, LOOKUP.transmissie) || 'Onbekend'}</p>
                <p><strong>Brandstof:</strong> ${vehicleData.brandstof || 'Onbekend'}</p>
            </div>
            <div class="info-card">
                <h4>Wielen & Banden</h4>
                <p><strong>Wielbasis:</strong> ${formatLengte(vehicleData.wielbasis) || 'Onbekend'}</p>
                <p><strong>Spoorbreedte voor:</strong> ${formatLengte(vehicleData.spoorbreedte_voor) || 'Onbekend'}</p>
                <p><strong>Spoorbreedte achter:</strong> ${formatLengte(vehicleData.spoorbreedte_achter) || 'Onbekend'}</p>
                <p><strong>Bandenmaat:</strong> ${vehicleData.bandenmaat || 'Onbekend'}</p>
            </div>
        </div>
    `;

    content.innerHTML = html;
    section.style.display = 'block';
}

function displayAPKHistory(vehicleData) {
    const section = document.getElementById('apk-history-section');
    const content = document.getElementById('apk-history-content');

    if (!vehicleData) {
        section.style.display = 'none';
        return;
    }

    let html = `
        <div class="info-card">
            <h4>APK Status</h4>
            <p><strong>APK verplicht:</strong> ${vehicleData.apk_verplicht || 'Onbekend'}</p>
            <p><strong>APK vervaldatum:</strong> ${formatDate(vehicleData.apk_vervaldatum) || 'Onbekend'}</p>
            <p><strong>APK status:</strong> ${vehicleData.apk_status || 'Onbekend'}</p>
        </div>
    `;

    content.innerHTML = html;
    section.style.display = 'block';
}

function displayMaintenanceInstructions(vehicleData) {
    const section = document.getElementById('maintenance-instructions-section');
    const content = document.getElementById('maintenance-instructions-content');

    if (!vehicleData) {
        section.style.display = 'none';
        return;
    }

    // Get maintenance instructions based on vehicle type
    const instructions = getMaintenanceInstructions(vehicleData);

    let html = `
        <div class="info-card">
            <h4>Onderhoudsinterval</h4>
            <p><strong>Kleine beurt:</strong> Elke 15.000 km of 12 maanden</p>
            <p><strong>Grote beurt:</strong> Elke 30.000 km of 24 maanden</p>
            <p><strong>APK keuring:</strong> Elke 2 jaar (na 4 jaar)</p>
        </div>

        <div class="info-card">
            <h4>Belangrijke onderhoudspunten</h4>
            <ul>
                <li>Olie en oliefilter vervangen elke 15.000 km</li>
                <li>Luchtfilter vervangen elke 30.000 km</li>
                <li>Bougies vervangen elke 60.000 km</li>
                <li>Remvloeistof vervangen elke 2 jaar</li>
                <li>Koelvloeistof controleren elke 2 jaar</li>
            </ul>
        </div>

        <div class="info-card">
            <h4>Seizoensonderhoud</h4>
            <p><strong>Winter:</strong> Controleer accu, bandenprofiel, antivries</p>
            <p><strong>Zomer:</strong> Controleer airconditioning, koelvloeistof, bandenspanning</p>
        </div>
    `;

    content.innerHTML = html;
    section.style.display = 'block';
}

function getMaintenanceInstructions(vehicleData) {
    // This would be expanded with specific instructions per vehicle type
    const instructions = {
        general: [
            "Olie en oliefilter vervangen elke 15.000 km",
            "Luchtfilter vervangen elke 30.000 km",
            "Bougies vervangen elke 60.000 km",
            "Remvloeistof vervangen elke 2 jaar",
            "Koelvloeistof controleren elke 2 jaar"
        ]
    };

    return instructions;
}

function displayVideoContent(vehicleData) {
    const section = document.getElementById('video-section');
    const content = document.getElementById('video-content');

    if (!vehicleData) {
        section.style.display = 'none';
        return;
    }

    // Sample videos - in a real implementation, these would be fetched based on vehicle make/model
    const videos = [
        {
            title: 'Algemene onderhoudstips',
            url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
        },
        {
            title: 'Hoe vervang je olie',
            url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
        },
        {
            title: 'Banden wisselen',
            url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
        }
    ];

    let html = '<div class="video-grid">';

    videos.forEach(video => {
        html += `
            <div class="video-card" onclick="openVideoModal('${video.title}', '${video.url}')">
                <div class="video-thumbnail">
                    <img src="${video.thumbnail}" alt="${video.title}">
                    <div class="play-icon">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
                <h4>${video.title}</h4>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;
    section.style.display = 'block';
}

function displayAllVehicleInformation(vehicleData) {
    // Display basic info
    displayResults(vehicleData);

    // Display all new sections
    displayOwnerHistory(vehicleData);
    displayTechnicalSpecs(vehicleData);
    displayAPKHistory(vehicleData);
    displayMaintenanceInstructions(vehicleData);
    displayVideoContent(vehicleData);

    // Show results section
    document.getElementById('results').style.display = 'block';
    document.getElementById('action-bar').style.display = 'flex';
}

// ========================================
// EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initUI(); loadTheme(); checkAuth(); loadHistory();
    document.getElementById('kenteken-input').addEventListener('input',e=>{const v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');e.target.value=v;if(v.length===6)setTimeout(searchKenteken,300);});
    document.getElementById('kenteken-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchKenteken();}});
    document.getElementById('kenteken-input').addEventListener('focus',e=>{document.querySelector('.kenteken-plate-input')?.classList.add('focused');});
    document.getElementById('kenteken-input').addEventListener('blur',e=>{document.querySelector('.kenteken-plate-input')?.classList.remove('focused');});
    ['compare-input-1','compare-input-2'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();compareVehicles();}});}});
    document.getElementById('reg-usertype').addEventListener('change',e=>{document.getElementById('garage-fields').style.display=(e.target.value==='garage'||e.target.value==='both')?'block':'none';});
    document.addEventListener('click',e=>{if(!e.target.closest('.user-avatar')&&!e.target.closest('.dropdown'))document.getElementById('user-dropdown').style.display='none';});
    const up=new URLSearchParams(window.location.search).get('kenteken');
    if(up){document.getElementById('kenteken-input').value=up;setTimeout(searchKenteken,500);}
    else setTimeout(()=>document.getElementById('kenteken-input').focus(),500);
    console.log('🚗 AWOJA v3.1 Geladen');
});