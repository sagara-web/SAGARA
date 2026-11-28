/* =========================================================
   SAGARA — app.js
   Port verbatim dari IIFE <script> di sagaraprev.html
   Classic script (bukan module). Wajib di-load SETELAH:
     - Lenis (window.Lenis)
     - GLightbox (window.GLightbox)
   dan SEBELUM:
     - firebase-init.js (module)
   File ini mengandalkan global:
     window.__sagaraUser, window.__sagaraData, window.__sagaraAuth,
     window.__sagaraApplyAuth
   ========================================================= */
(function(){
"use strict";

// ===== UTILS =====
function $id(id){ return document.getElementById(id); }
function $$(sel, ctx){ var r = ctx === undefined ? document : ctx; if (!r || !r.querySelectorAll) return []; try { return Array.prototype.slice.call(r.querySelectorAll(sel)); } catch(e){ return []; } }
function on(el, evt, fn){ if (el && el.addEventListener) el.addEventListener(evt, fn); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }
function stGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function stSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

// ===== CONFIG GITHUB FOLDER =====
var SAGARA_CONFIG = {
  repo: '', 
  cacheTTL: 15 * 60 * 1000,
  folders: { kenangan: 'assets/kenangan', hiburan: 'assets/hiburan' }
};
function getGitHubRepo() {
  if (SAGARA_CONFIG.repo) return SAGARA_CONFIG.repo;
  var host = location.hostname;
  if (!host.endsWith('.github.io')) return null;
  var user = host.split('.')[0];
  var parts = location.pathname.split('/').filter(Boolean);
  return parts.length === 0 ? user + '/' + user + '.github.io' : user + '/' + parts[0];
}
var FOLDER_CACHE_PREFIX = 'sagara-folder-cache:';
async function fetchFolderFiles(folderPath) {
  var repo = getGitHubRepo();
  if (!repo) return null;
  var cacheKey = FOLDER_CACHE_PREFIX + folderPath;
  try {
    var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && cached.ts && (Date.now() - cached.ts) < SAGARA_CONFIG.cacheTTL) return cached.files;
  } catch(e) {}
  try {
    var res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + folderPath, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub API ' + res.status);
    var data = await res.json();
    if (!Array.isArray(data)) throw new Error('Bukan direktori');
    var files = data.filter(function(f){ return f.type === 'file'; }).map(function(f){ return { name: f.name }; });
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), files: files })); } catch(e) {}
    return files;
  } catch(e) {
    console.warn('[Sagara] Fetch folder gagal:', folderPath, e.message);
    try { var c = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (c && c.files) return c.files; } catch(e2) {}
    return null;
  }
}
window.sagaraRefresh = function() {
  Object.keys(localStorage).forEach(function(k){ if (k.indexOf(FOLDER_CACHE_PREFIX) === 0) localStorage.removeItem(k); });
  location.reload();
};

// ===== STATE =====
var root = document.documentElement;
var THEME_KEY = 'sagara-theme';
var TASKS_KEY = 'sagara-tasks-done';
var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var hasTouch = window.matchMedia && window.matchMedia('(hover:none) and (pointer:coarse)').matches;
var lenis = null;
var glightbox = null;
var tasksDone = {}; try { tasksDone = JSON.parse(stGet(TASKS_KEY) || '{}'); } catch(e){ tasksDone = {}; }

// ===== DATES =====
var HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
var BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function parseISO(iso){ if (!iso) return new Date(); var p = String(iso).split('-'); var d = new Date(+p[0], +p[1]-1, +p[2]); return isNaN(d.getTime()) ? new Date() : d; }
function startToday(){ var n = new Date(); n.setHours(0,0,0,0); return n; }
function daysUntil(iso){ return Math.round((parseISO(iso) - startToday()) / 86400000); }
function shortDate(iso){ var d = parseISO(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; }
function longDate(d){ return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN_PANJANG[d.getMonth()] + ' ' + d.getFullYear(); }
function dueLabel(iso){ var off = daysUntil(iso); if (off===0) return 'Hari ini · ' + shortDate(iso); if (off===1) return 'Besok · ' + shortDate(iso); if (off>1) return off + ' hari lagi · ' + shortDate(iso); if (off===-1) return 'Lewat 1 hari · ' + shortDate(iso); return 'Lewat ' + Math.abs(off) + ' hari · ' + shortDate(iso); }

// ===== THEME =====
var themeToggle = $id('themeToggle'); var metaTheme = document.querySelector('meta[name="theme-color"]');
function setTheme(t){ root.setAttribute('data-theme',t); if (metaTheme) metaTheme.setAttribute('content',t==='dark'?'#071412':'#f4f9f5'); if (themeToggle) themeToggle.setAttribute('aria-label',t==='dark'?'Aktifkan tema terang':'Aktifkan tema gelap'); stSet(THEME_KEY,t); }
setTheme(stGet(THEME_KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light'));
on(themeToggle,'click',function(){ setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark'); });

// ===== LENIS =====
if (window.Lenis && !prefersReduced){ try { lenis = new Lenis({duration:1.1,smoothWheel:true}); (function raf(t){ lenis.raf(t); requestAnimationFrame(raf); })(); root.style.scrollBehavior='auto'; } catch(e){ lenis=null; } }
function smoothScroll(target){ if (lenis){ try { lenis.scrollTo(target,{offset:-72}); return; } catch(e){} } var behavior = prefersReduced?'auto':'smooth'; if (typeof target==='string'){ var el=document.querySelector(target); if(el) el.scrollIntoView({behavior:behavior,block:'start'}); } else if (target===0||target==='top'){ window.scrollTo({top:0,behavior:behavior}); } else if (target&&target.nodeType===1){ target.scrollIntoView({behavior:behavior,block:'start'}); } }

// ===== LAZY =====
$$('img.lazy-img').forEach(function(img){ var done=function(){ img.classList.add('loaded'); }; if (img.complete&&img.naturalWidth>0) done(); else { img.addEventListener('load',done); img.addEventListener('error',done); } });

// ===== AUTH =====
window.__sagaraUser = window.__sagaraUser || null;
var ROLE_CONFIG = { developer:{label:'DEVELOPER',cls:'is-developer'}, admin:{label:"I'M THE ADMIN",cls:'is-admin'}, walikelas:{label:'WALI KELAS',cls:'is-wali'}, member:{label:'MEMBER',cls:'is-member'} };
function isAuthed(){ return !!window.__sagaraUser; }
function isAdmin(){ return !!(window.__sagaraUser && (window.__sagaraUser.role==='admin' || window.__sagaraUser.role==='walikelas' || window.__sagaraUser.role==='developer')); }
function setRole(role){
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', function(){ setRole(role); }, { once: true });
    return;
  }
  var cfg = ROLE_CONFIG[role];
  var brandSub = $id('brandSub');
  var brand = $id('brand');
  if (brandSub) brandSub.textContent = cfg ? cfg.label : 'Papan Kelas IX-G';
  if (brand){
  brand.classList.toggle('is-developer', role==='developer');
  brand.classList.toggle('is-admin', role==='admin');
  brand.classList.toggle('is-member', role==='member');
  brand.classList.toggle('is-wali', role==='walikelas');
  brand.setAttribute('aria-label', isAuthed() ? 'SAGARA — klik logout' : 'SAGARA');
  }
  document.body.classList.toggle('is-admin', isAdmin());
  if (!isAdmin()) { exitEditMode(); exitSelectionMode(); }
}
window.__sagaraApplyAuth = function(user){
  window.__sagaraUser = user;
  setRole(user ? user.role : null);
  if (user && location.hash === '#/login'){
    if (history.replaceState) history.replaceState(null,'','#home');
    else location.hash = '#home';
    showMain();
  }
};

// ===== LOGIN =====
var loginView = $id('loginView'); var loginForm = $id('loginForm'); var loginError = $id('loginError'); var loginSubmit = $id('loginSubmit'); var passwordToggle = $id('passwordToggle'); var loginPassword = $id('loginPassword');
function showLogin(){ closeSearch(); loginView.hidden = false; document.body.style.overflow = 'hidden'; window.scrollTo({top:0, behavior:'auto'}); var e = $id('loginEmail'); if (e) setTimeout(function(){ try { e.focus(); } catch(err){} }, 30); }
function showMain(){ loginView.hidden = true; document.body.style.overflow = ''; }
function route(){ if (location.hash === '#/login' && isAuthed()){ if (history.replaceState) history.replaceState(null,'','#home'); else location.hash = '#home'; showMain(); return; } if (location.hash === '#/login') showLogin(); else showMain(); }
window.addEventListener('hashchange', route);
if (passwordToggle && loginPassword){ on(passwordToggle, 'click', function(){ var isHidden = loginPassword.type === 'password'; loginPassword.type = isHidden ? 'text' : 'password'; passwordToggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false'); passwordToggle.setAttribute('aria-label', isHidden ? 'Sembunyikan password' : 'Tampilkan password'); }); }
on(loginForm, 'submit', async function(e){
  e.preventDefault(); if (loginError) loginError.textContent = '';
  var email = (loginForm.elements.email.value||'').trim().toLowerCase(); var pass = loginForm.elements.password.value || '';
  if (!email || !pass) { if (loginError) loginError.textContent = 'Email dan password wajib diisi.'; return; }
  if (!window.__sagaraAuth) { if (loginError) loginError.textContent = 'Sistem auth belum siap.'; return; }
  if (loginSubmit){ loginSubmit.disabled = true; loginSubmit.textContent = 'Memeriksa…'; }
  try { await window.__sagaraAuth.login(email, pass); loginForm.reset(); if (loginPassword) loginPassword.type = 'password'; if (passwordToggle){ passwordToggle.setAttribute('aria-pressed','false'); } if (history.replaceState) history.replaceState(null, '', '#home'); else location.hash = 'home'; showMain(); } catch(err) { if (loginError) loginError.textContent = 'Email atau password salah.'; } finally { if (loginSubmit){ loginSubmit.disabled = false; loginSubmit.textContent = 'Masuk'; } }
});
if (loginForm){ on(loginForm.elements.email, 'input', function(){ if (loginError) loginError.textContent = ''; }); on(loginForm.elements.password, 'input', function(){ if (loginError) loginError.textContent = ''; }); }

// ===== CONFIRM =====
var confirmDialog = $id('confirmDialog'); var confirmTitle = $id('confirmTitle'); var confirmDesc = $id('confirmDesc'); var confirmYes = $id('confirmYes'); var confirmCallback = null;
function openConfirm(opts){ opts = opts || {}; if (!confirmDialog || !confirmDialog.hidden) return; if (confirmTitle) confirmTitle.textContent = opts.title || 'Yakin?'; if (confirmDesc) confirmDesc.textContent = opts.desc || ''; if (confirmYes) confirmYes.textContent = opts.confirmLabel || 'Ya'; confirmCallback = typeof opts.onConfirm === 'function' ? opts.onConfirm : null; confirmDialog.hidden = false; setTimeout(function(){ var c = confirmDialog.querySelector('[data-confirm-close]'); if (c) c.focus(); }, 30); }
function closeConfirm(){ if (!confirmDialog) return; confirmDialog.hidden = true; confirmCallback = null; }
$$('[data-confirm-close]').forEach(function(el){ on(el, 'click', closeConfirm); });
on(confirmYes, 'click', function(){ var cb = confirmCallback; closeConfirm(); if (cb) cb(); });

// ===== MODAL =====
var formModal = $id('formModal'); var formModalTitle = $id('formModalTitle'); var formModalForm = $id('formModalForm'); var formSubmitCallback = null; var lastFocus = null; var currentFormSection = null;
var FORM_FIELDS = { aturan: { num: true, desc: true }, mapel: { list: true }, tugas: { desc: true, tag: true, date: true }, acara: { desc: true, badge: true, date: true, time: true, place: true }, kenangan: { image: true, caption: true }, pengurus: { jabatan: true, wa: true, foto: true }, media: { desc: true, mediaType: true, mediaUrl: true } };
function openFormModal(opts){
  opts = opts || {}; if (!formModal || !formModalForm) return; lastFocus = document.activeElement; currentFormSection = opts.sectionId || null; if (formModalTitle) formModalTitle.textContent = opts.title || 'Form';
  var fields = FORM_FIELDS[currentFormSection] || { desc: true };
  $$('[data-field]', formModalForm).forEach(function(f){ f.hidden = !fields[f.getAttribute('data-field')]; });
  formModalForm.reset();
  if (formModalForm.elements.title) formModalForm.elements.title.value = opts.title_value || '';
  if (fields.desc && formModalForm.elements.desc) formModalForm.elements.desc.value = opts.desc_value || '';
  if (fields.num && formModalForm.elements.num) formModalForm.elements.num.value = opts.num_value || '';
  if (fields.tag && formModalForm.elements.tag) formModalForm.elements.tag.value = opts.tag_value || '';
  if (fields.badge && formModalForm.elements.badge) formModalForm.elements.badge.value = opts.badge_value || '';
  if (fields.date && formModalForm.elements.date) formModalForm.elements.date.value = opts.date_value || '';
  if (fields.time && formModalForm.elements.time) formModalForm.elements.time.value = opts.time_value || '';
  if (fields.place && formModalForm.elements.place) formModalForm.elements.place.value = opts.place_value || '';
  if (fields.image && formModalForm.elements.image) formModalForm.elements.image.value = opts.image_value || '';
  if (fields.caption && formModalForm.elements.caption) formModalForm.elements.caption.value = opts.caption_value || '';
  if (fields.wa && formModalForm.elements.wa) formModalForm.elements.wa.value = opts.wa_value || '';
  if (fields.list && formModalForm.elements.list) formModalForm.elements.list.value = (opts.list_value || []).join('\n');
  if (fields.jabatan && formModalForm.elements.jabatan) formModalForm.elements.jabatan.value = opts.jabatan_value || '';
  if (fields.foto && formModalForm.elements.foto) formModalForm.elements.foto.value = opts.foto_value || '';
  if (fields.mediaType && formModalForm.elements.mediaType) formModalForm.elements.mediaType.value = opts.mediaType_value || 'stiker';
  if (fields.mediaUrl && formModalForm.elements.mediaUrl) formModalForm.elements.mediaUrl.value = opts.mediaUrl_value || '';
  formSubmitCallback = typeof opts.onSubmit === 'function' ? opts.onSubmit : null;
  formModal.hidden = false; setTimeout(function(){ if (formModalForm.elements.title) formModalForm.elements.title.focus(); }, 30);
}
function closeFormModal(){ if (!formModal) return; formModal.hidden = true; formSubmitCallback = null; if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus(); lastFocus = null; }
$$('[data-modal-close]', formModal).forEach(function(el){ on(el, 'click', closeFormModal); });
on(formModalForm, 'submit', function(e){
  e.preventDefault(); var title = formModalForm.elements.title.value.trim(); if (!title && currentFormSection !== 'kenangan') { formModalForm.elements.title.focus(); return; }
  var fields = FORM_FIELDS[currentFormSection] || {}; var data = { title: title };
  if (fields.desc && formModalForm.elements.desc) data.desc = formModalForm.elements.desc.value.trim();
  if (fields.num && formModalForm.elements.num) data.num = formModalForm.elements.num.value.trim();
  if (fields.tag && formModalForm.elements.tag) data.tag = formModalForm.elements.tag.value.trim();
  if (fields.badge && formModalForm.elements.badge) data.badge = formModalForm.elements.badge.value.trim();
  if (fields.date && formModalForm.elements.date){ var dv = formModalForm.elements.date.value; if (dv) data.date = dv; else if (currentFormSection==='tugas'||currentFormSection==='acara'){ formModalForm.elements.date.focus(); return; } }
  if (fields.time && formModalForm.elements.time) data.time = formModalForm.elements.time.value.trim();
  if (fields.place && formModalForm.elements.place) data.place = formModalForm.elements.place.value.trim();
  if (fields.image && formModalForm.elements.image) data.image = formModalForm.elements.image.value.trim();
  if (fields.caption && formModalForm.elements.caption) data.caption = formModalForm.elements.caption.value.trim();
  if (fields.wa && formModalForm.elements.wa) data.wa = formModalForm.elements.wa.value.trim();
  if (fields.list && formModalForm.elements.list) data.list = formModalForm.elements.list.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  if (fields.jabatan && formModalForm.elements.jabatan) data.jabatan = formModalForm.elements.jabatan.value.trim();
  if (fields.foto && formModalForm.elements.foto) data.foto = formModalForm.elements.foto.value.trim();
  if (fields.mediaType && formModalForm.elements.mediaType) data.mediaType = formModalForm.elements.mediaType.value;
  if (fields.mediaUrl && formModalForm.elements.mediaUrl) data.mediaUrl = formModalForm.elements.mediaUrl.value.trim();
  
  if ((currentFormSection === 'media') && !data.mediaUrl) { formModalForm.elements.mediaUrl.focus(); return; }

  var cb = formSubmitCallback; closeFormModal(); if (cb) cb(data);
});

// ===== LOGOUT =====
var brand = $id('brand');
on(brand, 'click', function(e){
  if (searchPanel && searchPanel.classList.contains('open')){ e.preventDefault(); e.stopPropagation(); closeSearch(); return; }
  if (isAuthed()){ e.preventDefault(); openConfirm({ title: 'Logout?', desc: 'Kamu akan keluar dari akun SAGARA.', confirmLabel: 'Ya, Logout', onConfirm: async function(){ if (window.__sagaraAuth) { try { await window.__sagaraAuth.logout(); } catch(err){} } if (history.replaceState) history.replaceState(null,'','#home'); else location.hash='home'; } }); }
});

// ===== EDIT MODE =====
var editToggle = $id('editToggle');
var ICON_EDIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
var ICON_DONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
function enterEditMode(){ if (!isAdmin()) return; exitSelectionMode(); document.body.classList.add('editing'); var label = editToggle ? editToggle.querySelector('span') : null; if (label) label.textContent = 'Selesai'; var icon = editToggle ? editToggle.querySelector('svg') : null; if (icon) icon.outerHTML = ICON_DONE; if (editToggle) editToggle.setAttribute('aria-label','Matikan mode edit'); }
function exitEditMode(){ document.body.classList.remove('editing'); var label = editToggle ? editToggle.querySelector('span') : null; if (label) label.textContent = 'Edit'; var svg = editToggle ? editToggle.querySelector('svg') : null; if (svg) svg.outerHTML = ICON_EDIT; if (editToggle) editToggle.setAttribute('aria-label','Aktifkan mode edit'); $$('[data-card].card-active').forEach(function(c){ c.classList.remove('card-active'); }); }
on(editToggle, 'click', function(){ if (document.body.classList.contains('editing')) exitEditMode(); else enterEditMode(); });

// ===== SELECTION MODE =====
var selToolbar = $id('selToolbar'); var selCount = $id('selCount'); var selCancel = $id('selCancel'); var selDelete = $id('selDelete'); var selectedCards = new Set();
var suppressNextClick = false;
function enterSelectionMode(){ if (!isAdmin()) return; exitEditMode(); document.body.classList.add('selecting'); selectedCards.clear(); updateSelToolbar(); if (selToolbar) selToolbar.hidden = false; }
function exitSelectionMode(){ document.body.classList.remove('selecting'); Array.from(selectedCards).forEach(function(c){ if (c && c.classList) c.classList.remove('is-selected'); }); selectedCards.clear(); if (selToolbar) selToolbar.hidden = true; }
function toggleCard(card){ if (!card) return; if (selectedCards.has(card)) { selectedCards.delete(card); card.classList.remove('is-selected'); } else { selectedCards.add(card); card.classList.add('is-selected'); } updateSelToolbar(); }
function updateSelToolbar(){ if (selCount) selCount.textContent = selectedCards.size; if (selDelete) selDelete.disabled = selectedCards.size === 0; }
on(selCancel, 'click', exitSelectionMode);
on(selDelete, 'click', function(){ if (selectedCards.size === 0) return; var cards = Array.from(selectedCards), n = cards.length; openConfirm({ title:'Hapus ' + n + ' item?', desc:'Tidak bisa dikembalikan.', confirmLabel:'Ya, Hapus', onConfirm: async function(){ for (var i = 0; i < cards.length; i++){ var c = cards[i]; var fireId = c.getAttribute('data-firestore-id'); var sec = c.closest('section'); var sid = sec ? sec.id : ''; var colKey = sidToCol(sid, c); if (fireId && window.__sagaraData){ try { await window.__sagaraData.remove(colKey, fireId); } catch (err){ console.error(err); } } else if (c && c.remove) { c.remove(); } } exitSelectionMode(); } }); });

// ===== CARD HELPERS =====
function sidToCol(sid, card){ if (sid === 'aturan') return card.classList.contains('mapel-group') ? 'mapel' : 'aturan'; if (sid === 'struktur') return 'pengurus'; return sid; }
function buildPayload(colKey, data){
  if (colKey === 'aturan') return { nomor: data.num || '', judul: data.title, deskripsi: data.desc || '', urutan: Date.now() };
  if (colKey === 'mapel') return { nama: data.title, aturan: data.list || [], urutan: Date.now() };
  if (colKey === 'tugas') return { judul: data.title, deskripsi: data.desc || '', mapel: data.tag || '', dueDate: data.date || '', urutan: Date.now() };
  if (colKey === 'acara') return { judul: data.title, deskripsi: data.desc || '', badge: data.badge || '', tanggal: data.date || '', waktu: data.time || '', tempat: data.place || '', urutan: Date.now() };
  if (colKey === 'kenangan') return { caption: data.caption || data.title || '', imageUrl: data.image || '', urutan: Date.now() };
  if (colKey === 'media') return { judul: data.title, deskripsi: data.desc || '', tipe: data.mediaType || 'stiker', url: data.mediaUrl || '', urutan: Date.now() };
  return data;
}

// ===== ADD =====
function handleAdd(sid){
  var formSection = sid, colKey = sid;
  if (sid === 'aturan'){ var activeTab = document.querySelector('.tab-btn.is-active'); var tab = activeTab ? activeTab.getAttribute('data-tab') : 'umum'; if (tab === 'mapel'){ formSection = 'mapel'; colKey = 'mapel'; } }
  openFormModal({ sectionId: formSection, title: 'Tambah ' + (formSection === 'mapel' ? 'mapel' : formSection), onSubmit: async function(data){ if (!window.__sagaraData) { alert('Firestore belum siap.'); return; } try { await window.__sagaraData.add(colKey, buildPayload(colKey, data)); } catch (err) { console.error('[Add]', err); alert('Gagal menambah: ' + err.message); } } });
}
$$('.add-btn-wrap').forEach(function(wrap){ var btn = wrap.querySelector('.add-btn'); var sid = wrap.getAttribute('data-tools'); if (!btn) return; on(btn, 'click', function(e){ e.stopPropagation(); if (!isAdmin()) return; handleAdd(sid); }); });

// ===== CARD ACTIONS =====
function getCardData(card){
  var out = { title:'', desc:'', num:'', tag:'', badge:'', date:'', time:'', place:'', image:'', caption:'', wa:'', list:[], mediaType:'stiker', mediaUrl:'' };
  if (card.classList.contains('rule')){ out.num = (card.querySelector('.rule-num')||{}).textContent || ''; out.title = (card.querySelector('h3')||{}).textContent || ''; out.desc = (card.querySelector('p')||{}).textContent || ''; }
  else if (card.classList.contains('mapel-group')){ out.title = (card.querySelector('summary')||{}).textContent || ''; var lis = card.querySelectorAll('.mapel-rules li'); out.list = Array.prototype.map.call(lis, function(l){ return l.textContent; }); }
  else if (card.classList.contains('tugas-item')){ out.title = (card.querySelector('h3')||{}).textContent || ''; out.desc = (card.querySelector('p')||{}).textContent || ''; out.tag = (card.querySelector('.tugas-tag')||{}).textContent || ''; out.date = card.getAttribute('data-due') || ''; }
  else if (card.classList.contains('acara-item')){ out.title = (card.querySelector('.acara-body h3')||{}).textContent || ''; out.desc = (card.querySelector('.acara-body p')||{}).textContent || ''; out.badge = (card.querySelector('.acara-badge')||{}).textContent || ''; out.time = (card.querySelector('.acara-time')||{}).textContent || ''; out.place = (card.querySelector('.acara-place')||{}).textContent || ''; out.date = card.getAttribute('data-due') || ''; }
  else if (card.classList.contains('bento-item')){ var img = card.querySelector('img'); out.image = img ? (img.getAttribute('src') || '') : ''; out.caption = card.getAttribute('data-caption') || ''; }
  else if (card.classList.contains('pg-card')){ out.title = (card.querySelector('[data-name]')||{}).textContent || ''; out.jabatan = (card.querySelector('.pg-role')||{}).textContent || ''; var wa = card.querySelector('.pg-wa'); out.wa = wa && wa.href ? wa.href.replace(/\D/g,'') : ''; }
  else if (card.classList.contains('media-item')){ out.title = (card.querySelector('h3')||{}).textContent || ''; out.desc = (card.querySelector('p')||{}).textContent || ''; out.mediaType = card.getAttribute('data-tipe') || 'stiker'; out.mediaUrl = card.getAttribute('data-url') || ''; }
  return out;
}
function updateCardData(card, data){
  var section = card.closest('section'); var sid = section ? section.id : ''; var fireId = card.getAttribute('data-firestore-id'); var colKey = sidToCol(sid, card);
  if (card.classList.contains('rule')){ if (data.num != null) { var n = card.querySelector('.rule-num'); if (n) n.textContent = data.num; } if (data.title != null) { var h = card.querySelector('h3'); if (h) h.textContent = data.title; } if (data.desc != null) { var p = card.querySelector('p'); if (p) p.textContent = data.desc; } }
  else if (card.classList.contains('mapel-group')){ if (data.title != null) { var sm = card.querySelector('summary'); if (sm) sm.textContent = data.title; } if (data.list) { var ul = card.querySelector('.mapel-rules'); if (ul) ul.innerHTML = data.list.map(function(r){ return '<li>' + esc(r) + '</li>'; }).join(''); } }
  else if (card.classList.contains('tugas-item')){ if (data.title != null) { var h2 = card.querySelector('h3'); if (h2) h2.textContent = data.title; } if (data.desc != null) { var p2 = card.querySelector('p'); if (p2) p2.textContent = data.desc; } if (data.tag != null) { var tg = card.querySelector('.tugas-tag'); if (tg) tg.textContent = data.tag; card.setAttribute('data-tag', data.tag); } if (data.date){ card.setAttribute('data-due', data.date); var t = card.querySelector('.tugas-due'); if (t){ t.setAttribute('datetime', data.date); t.dataset.due = data.date; } } refreshTugasLabels(); refreshBoard(); updateTugasProgress(); }
  else if (card.classList.contains('acara-item')){ if (data.title != null) { var h3 = card.querySelector('.acara-body h3'); if (h3) h3.textContent = data.title; } if (data.desc != null) { var p3 = card.querySelector('.acara-body p'); if (p3) p3.textContent = data.desc; } if (data.badge != null) { var bd = card.querySelector('.acara-badge'); if (bd) bd.textContent = data.badge; } if (data.time != null) { var tm = card.querySelector('.acara-time'); if (tm) tm.textContent = data.time; } if (data.place != null) { var pl = card.querySelector('.acara-place'); if (pl) pl.textContent = data.place; } if (data.date){ card.setAttribute('data-due', data.date); var d = parseISO(data.date); var day = card.querySelector('.acara-day'); var mon = card.querySelector('.acara-mon'); if (day) day.textContent = d.getDate(); if (mon) mon.textContent = BULAN[d.getMonth()] + ' ' + d.getFullYear(); } refreshBoard(); }
  else if (card.classList.contains('bento-item')){ if (data.image != null){ var img = card.querySelector('img'); if (img){ img.src = data.image; } } if (data.caption != null){ card.setAttribute('data-caption', data.caption); } bindLightbox(); }
  else if (card.classList.contains('media-item')){
    if (data.title != null){ var hM = card.querySelector('h3'); if (hM) hM.textContent = data.title; }
    if (data.desc != null){ var pM = card.querySelector('p'); if (pM) pM.textContent = data.desc; }
    if (data.mediaUrl){ card.setAttribute('data-url', data.mediaUrl); var thumb = card.querySelector('.media-thumb'); if(thumb) { renderMediaThumb(thumb, data.mediaType, data.mediaUrl, data.title); } }
  }

  if (fireId && window.__sagaraData){
    var payload = buildPayload(colKey, data); delete payload.urutan;
    window.__sagaraData.update(colKey, fireId, payload).catch(function(err){ console.error('[Update]', err); });
  }
}
function ensureCardActions(card){
  if (!card) return; if (card.querySelector(':scope > .card-actions')) return;
  var section = card.closest('section'); var sid = section ? section.id : ''; var isPengurus = sid === 'struktur';
  var div = document.createElement('div'); div.className = 'card-actions';
  div.innerHTML = '<button type="button" class="card-action-btn" data-act="edit">Edit</button>' + (isPengurus ? '' : '<button type="button" class="card-action-btn card-action-delete" data-act="delete">Hapus</button>');
  card.appendChild(div);
  on(div, 'click', function(e){
    var btn = e.target.closest ? e.target.closest('[data-act]') : null; if (!btn) return; e.preventDefault(); e.stopPropagation(); var act = btn.getAttribute('data-act');
    if (act === 'edit'){
      if (isPengurus){ openPengurusEdit(card); }
      else { var cd = getCardData(card); openFormModal({ sectionId: sid, title: 'Edit', title_value: cd.title, desc_value: cd.desc, num_value: cd.num, tag_value: cd.tag, badge_value: cd.badge, date_value: cd.date, time_value: cd.time, place_value: cd.place, image_value: cd.image, caption_value: cd.caption, wa_value: cd.wa, list_value: cd.list || [], mediaType_value: cd.mediaType, mediaUrl_value: cd.mediaUrl, onSubmit: function(data){ updateCardData(card, data); card.classList.remove('card-active'); } }); }
    } else if (act === 'delete'){
      openConfirm({ title: 'Hapus item?', desc: 'Tidak bisa dikembalikan.', confirmLabel: 'Ya, Hapus', onConfirm: async function(){ var fireId = card.getAttribute('data-firestore-id'); var colKey = sidToCol(sid, card); if (fireId && window.__sagaraData){ try { await window.__sagaraData.remove(colKey, fireId); } catch (err){ console.error(err); } } else if (card.remove){ card.remove(); } if (selectedCards.has(card)){ selectedCards.delete(card); updateSelToolbar(); } } });
    }
  });
}
function openPengurusEdit(card){
  var roleId = card.getAttribute('data-role'); var fireId = card.getAttribute('data-firestore-id') || roleId; var namaEl = card.querySelector('[data-name]'); var roleEl = card.querySelector('.pg-role'); var waEl = card.querySelector('.pg-wa'); var imgEl = card.querySelector('.pg-avatar img');
  openFormModal({ sectionId: 'pengurus', title: 'Edit pengurus', title_value: namaEl ? namaEl.textContent : '', jabatan_value: roleEl ? roleEl.textContent : '', wa_value: waEl && waEl.href ? waEl.href.replace(/\D/g, '').replace(/^62/, '') : '', foto_value: imgEl ? imgEl.src : '', onSubmit: async function(data){ if (!window.__sagaraData) return; try { 
    var waNum = (data.wa || '').replace(/\D/g, ''); if (waNum) { waNum = waNum.replace(/^0/, '62'); if (!waNum.startsWith('62')) waNum = '62' + waNum; }
    await window.__sagaraData.updateFixed('pengurus', fireId, { nama: data.title, jabatan: data.jabatan || '', wa: waNum, foto: data.foto || '' }); card.classList.remove('card-active'); } catch (err) { console.error('[Pengurus edit]', err); alert('Gagal: ' + err.message); } } });
}

var longPressTimer = null; var longPressStart = null;
function cancelLongPress(){ if (longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; } longPressStart = null; }
function bindCard(card){
  if (!card || card.dataset.cardBound) return;
  card.dataset.cardBound = '1';

  on(card, 'pointerdown', function(e){ if (!isAdmin() || document.body.classList.contains('selecting') || document.body.classList.contains('editing')) return; if (e.button !== undefined && e.button !== 0) return; if (hasTouch) return; longPressStart = {x:e.clientX, y:e.clientY, card:card}; longPressTimer = setTimeout(function(){ suppressNextClick = true; enterSelectionMode(); toggleCard(card); longPressTimer = null; }, 500); });
  on(card, 'pointerup', cancelLongPress); on(card, 'pointerleave', cancelLongPress); on(card, 'pointercancel', cancelLongPress);
  on(card, 'pointermove', function(e){ if (!longPressStart || !longPressTimer) return; if (Math.abs(e.clientX - longPressStart.x) > 8 || Math.abs(e.clientY - longPressStart.y) > 8) cancelLongPress(); });
  on(card, 'click', function(e){ 
    if (suppressNextClick) { suppressNextClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!isAdmin()) return; if (document.body.classList.contains('selecting')){ e.preventDefault(); toggleCard(card); return; } if (document.body.classList.contains('editing')){ e.preventDefault(); $$('[data-card].card-active').forEach(function(c){ if (c !== card) c.classList.remove('card-active'); }); card.classList.toggle('card-active'); } });
  on(card, 'contextmenu', function(e){ if (!isAdmin()) return; e.preventDefault(); if (document.body.classList.contains('editing')) return; if (!document.body.classList.contains('selecting')) enterSelectionMode(); toggleCard(card); });
}

// ===== TUGAS =====
function saveTasks(){ stSet(TASKS_KEY, JSON.stringify(tasksDone)); }
function updateTugasProgress(){
  var items = $$('.tugas-item'); var total = items.length; var done = 0;
  items.forEach(function(it){ var cb = it.querySelector('input[type="checkbox"]'); if (cb && cb.checked) done++; });
  var pct = total ? Math.round((done/total)*100) : 0;
  var fill = $id('tpFill'); if (fill) fill.style.width = pct + '%';
  var td = $id('tpDone'); if (td) td.textContent = done; var tt = $id('tpTotal'); if (tt) tt.textContent = total;
}
function initTugasCheckboxes(){
  $$('.tugas-item input[type="checkbox"]').forEach(function(cb){
    var id = cb.getAttribute('data-task-id') || cb.id; if (tasksDone[id]) cb.checked = true;
    var item = cb.closest('.tugas-item'); if (item) item.classList.toggle('is-done', cb.checked);
    on(cb, 'change', function(){ if (cb.checked) tasksDone[id] = true; else delete tasksDone[id]; saveTasks(); if (item) item.classList.toggle('is-done', cb.checked); updateTugasProgress(); refreshBoard(); });
  });
}
function applyTugasFilter(filter){
  $$('.tugas-item').forEach(function(it){ var iso = it.getAttribute('data-due'); var off = iso ? daysUntil(iso) : 999; var cb = it.querySelector('input[type="checkbox"]'); var done = cb && cb.checked; var show = true; if (filter === 'week') show = off >= 0 && off <= 7; else if (filter === 'overdue') show = off < 0; else if (filter === 'undone') show = !done; it.style.display = show ? '' : 'none'; });
  var any = $$('.tugas-item').some(function(it){ return it.style.display !== 'none'; });
  var empty = $id('tugasEmpty'); if (empty) empty.hidden = any;
}
$$('.filter-chip').forEach(function(btn){ on(btn, 'click', function(){ var f = btn.getAttribute('data-filter'); $$('.filter-chip').forEach(function(b){ b.classList.toggle('is-active', b===btn); }); applyTugasFilter(f); }); });
function refreshTugasLabels(){
  $$('.tugas-item').forEach(function(it){ var iso = it.getAttribute('data-due'); if (!iso) return; var due = it.querySelector('.tugas-due'); if (due){ due.textContent = dueLabel(iso); due.classList.toggle('is-soon', daysUntil(iso) <= 1); } var off = daysUntil(iso); it.classList.toggle('is-soon', off >= 0 && off <= 1); it.classList.toggle('is-overdue', off < 0); });
}

// ===== BOARD =====
function refreshBoard(){
  var boardDate = $id('boardDate'); if (boardDate) boardDate.textContent = longDate(new Date());
  var nearest = null; var openCount = 0;
  $$('.tugas-item').forEach(function(item){ var iso = item.getAttribute('data-due'); if (!iso) return; var cb = item.querySelector('input[type="checkbox"]'); if (cb && cb.checked) return; var off = daysUntil(iso); if (off < 0) return; openCount++; if (!nearest || off < nearest.off){ nearest = { off: off, iso: iso, name: (item.querySelector('h3')||{}).textContent || '—', tag: (item.querySelector('.tugas-tag')||{}).textContent || '—' }; } });
  if (nearest){
    if ($id('boardTask')) $id('boardTask').textContent = nearest.name;
    if ($id('boardTag')) $id('boardTag').textContent = nearest.tag;
    if ($id('boardTaskDate')) $id('boardTaskDate').textContent = shortDate(nearest.iso);
    var bc = $id('boardCount'); if (bc){ bc.textContent = nearest.off === 0 ? 'kumpul hari ini' : nearest.off === 1 ? 'besok, jangan lupa' : 'masih ada ' + nearest.off + ' hari'; bc.className = 'board-count' + (nearest.off <= 1 ? ' is-soon' : ''); }
  } else { if ($id('boardTask')) $id('boardTask').textContent = 'Tidak ada PR terbuka'; if ($id('boardTag')) $id('boardTag').textContent = 'Kosong'; if ($id('boardTaskDate')) $id('boardTaskDate').textContent = '—'; if ($id('boardCount')) $id('boardCount').textContent = 'waktunya napas dulu'; }
  var nextEvent = null;
  $$('.acara-item').forEach(function(card){ var iso = card.getAttribute('data-due'); if (!iso) return; var off = daysUntil(iso); var inEl = card.querySelector('.acara-in'); if (inEl){ if (off < 0) { inEl.textContent = 'sudah lewat'; card.classList.add('is-past'); } else if (off === 0) { inEl.textContent = 'hari ini!'; inEl.classList.add('is-soon'); card.classList.remove('is-past'); } else if (off === 1) { inEl.textContent = 'besok'; inEl.classList.add('is-soon'); card.classList.remove('is-past'); } else { inEl.textContent = off + ' hari lagi'; inEl.classList.remove('is-soon'); card.classList.remove('is-past'); } } if (off >= 0 && (!nextEvent || off < nextEvent.off)){ nextEvent = { off: off, name: (card.querySelector('.acara-body h3')||{}).textContent || '—', date: longDate(parseISO(iso)) }; } });
  if (nextEvent){ if ($id('boardEvent')) $id('boardEvent').textContent = nextEvent.name; if ($id('boardEventDate')) $id('boardEventDate').textContent = nextEvent.date; } else { if ($id('boardEvent')) $id('boardEvent').textContent = 'Belum ada agenda'; if ($id('boardEventDate')) $id('boardEventDate').textContent = 'usul kegiatan di grup'; }
  var items = $$('.tugas-item'); var total = items.length; var done = items.filter(function(it){ var cb = it.querySelector('input[type="checkbox"]'); return cb && cb.checked; }).length; var pct = total ? Math.round((done/total)*100) : 0;
  var pf = $id('boardProgressFill'); if (pf) pf.style.width = pct + '%'; var pt = $id('boardProgressTxt'); if (pt) pt.textContent = done + ' / ' + total + ' PR selesai';
  var td = $id('tpDone'); if (td) td.textContent = done; var tt = $id('tpTotal'); if (tt) tt.textContent = total; var tf = $id('tpFill'); if (tf) tf.style.width = pct + '%';
}

// ===== KENANGAN (BENTO) =====
async function renderKenangan(fbItems) {
  var wrap = document.getElementById('kenanganList'); if (!wrap) return;
  var ep = $id('empty-kenangan');
  var folderPath = SAGARA_CONFIG.folders.kenangan;
  var folderImages = [];
  var files = await fetchFolderFiles(folderPath);
  if (files) {
    folderImages = files.filter(function(f){ return /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name); }).map(function(f){
      return { url: folderPath + '/' + f.name, caption: '', source: 'folder', name: f.name };
    });
  }
  var fbMapped = (fbItems || []).map(function(it){
    return { url: it.imageUrl || '', caption: it.caption || '', source: 'firebase', id: it.id, firestoreId: it.id };
  });
  var all = folderImages.concat(fbMapped).filter(function(x){ return x.url; });
  if (!all.length) { wrap.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  wrap.innerHTML = all.map(function(it){
    var isFolder = it.source === 'folder';
    var attrs = isFolder ? 'data-folder="1"' : 'data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.firestoreId) + '"';
    return '<div class="bento-item" data-card ' + attrs + ' data-caption="' + esc(it.caption) + '" data-source="' + it.source + '"><img class="lazy-img" src="' + esc(it.url) + '" alt="' + esc(it.caption) + '" loading="lazy" decoding="async"></div>';
  }).join('');
  wrap.querySelectorAll('[data-card][data-source="firebase"]').forEach(function(c){ ensureCardActions(c); bindCard(c); });
  wrap.querySelectorAll('img.lazy-img').forEach(function(img){ var done = function(){ img.classList.add('loaded'); }; if (img.complete && img.naturalWidth > 0) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); } });
  bindLightbox();
}
function bindLightbox(){
  if (!window.GLightbox) return; if (!glightbox){ try { glightbox = GLightbox({ selector: '.bento-item', touchNavigation: true, loop: true, openEffect: 'fade', closeEffect: 'fade', slideEffect: 'fade' }); glightbox.on('open', function(){ if (lenis){ try { lenis.stop(); } catch(e){} } }); glightbox.on('close', function(){ if (lenis){ try { lenis.start(); } catch(e){} } }); } catch(err){ glightbox = null; } }
  $$('.bento-item').forEach(function(card){ if (card.dataset.lbBound) return; card.dataset.lbBound = '1'; on(card, 'click', function(e){ if (document.body.classList.contains('editing') || document.body.classList.contains('selecting')) return; e.preventDefault(); var items = $$('.bento-item'); var idx = items.indexOf(card); var elements = items.map(function(c){ var img = c.querySelector('img'); return { href: img ? img.src : '', title: c.getAttribute('data-caption') || '', type: 'image' }; }).filter(function(el){ return !!el.href; }); if (!elements.length) return; try { glightbox.setElements(elements); glightbox.openAt(idx); } catch(err){ try { glightbox.open(elements[idx]); } catch(e2){} } }); });
}

// ===== MEDIA (Stiker & Video) =====
function getYouTubeId(url) {
  var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
function renderMediaThumb(container, type, url, title) {
  if (type === 'video') {
    var ytId = getYouTubeId(url);
    if (ytId) {
      container.innerHTML = '<div class="video-container"><iframe src="https://www.youtube.com/embed/' + ytId + '" title="' + esc(title) + '" allowfullscreen></iframe></div>';
    } else {
      container.innerHTML = '<video controls src="' + esc(url) + '"></video>';
    }
  } else {
    container.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(title) + '" loading="lazy">';
  }
}
async function renderMedia(fbItems) {
  var list = $id('mediaList'); if (!list) return;
  var ep = $id('empty-media');
  var folderPath = SAGARA_CONFIG.folders.hiburan;
  var folderItems = [];
  var files = await fetchFolderFiles(folderPath);
  if (files) {
    folderItems = files.map(function(f){
      var isVideo = /\.(mp4|webm|ogg|m4v)$/i.test(f.name);
      var isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name);
      if (!isVideo && !isImage) return null;
      return { url: folderPath + '/' + f.name, tipe: isVideo ? 'video' : 'stiker', judul: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), deskripsi: '', source: 'folder' };
    }).filter(Boolean);
  }
  var fbMapped = (fbItems || []).map(function(it){
    return { url: it.url || '', tipe: it.tipe || 'stiker', judul: it.judul || '', deskripsi: it.deskripsi || '', source: 'firebase', id: it.id, firestoreId: it.id };
  });
  var all = folderItems.concat(fbMapped).filter(function(x){ return x.url; });
  if (!all.length) { list.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  list.innerHTML = all.map(function(it){
    var isVid = it.tipe === 'video';
    var isFolder = it.source === 'folder';
    var attrs = isFolder ? 'data-folder="1"' : 'data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.firestoreId) + '"';
    return '<div class="media-item" data-card ' + attrs + ' data-tipe="' + esc(it.tipe) + '" data-url="' + esc(it.url) + '" data-source="' + it.source + '">' +
      '<div class="media-thumb"><span class="media-badge ' + (isVid ? 'is-video' : '') + '">' + (isVid ? 'Video' : 'Stiker') + '</span></div>' +
      '<div class="media-body"><h3>' + esc(it.judul || '—') + '</h3><p>' + esc(it.deskripsi) + '</p></div></div>';
  }).join('');
  list.querySelectorAll('.media-item').forEach(function(c){
    var tipe = c.getAttribute('data-tipe'); var url = c.getAttribute('data-url'); var title = c.querySelector('h3').textContent;
    renderMediaThumb(c.querySelector('.media-thumb'), tipe, url, title);
    if (c.getAttribute('data-source') === 'firebase') { ensureCardActions(c); bindCard(c); }
  });
}

// ===== SEARCH =====
var searchPanel = $id('searchPanel'); var searchInput = $id('searchInput'); var searchClear = $id('searchClear'); var searchResults = $id('searchResults'); var searchAnnounce = $id('searchAnnounce'); var searchBtn = $id('searchBtn');
var searchIndex = []; var searchActiveIdx = 0; var searchFilter = 'all';
var SEARCH_SECTIONS = [{ id:'home', label:'Beranda', kw:'home beranda awal hero sagara papan kelas ixg' },{ id:'struktur', label:'Struktur', kw:'struktur pengurus ketua wakil sekretaris bendahara wali kelas org' },{ id:'aturan', label:'Aturan', kw:'aturan kesepakatan rules mapel matematika ipa bindo sejarah' },{ id:'tugas', label:'Tugas', kw:'tugas pr homework pekerjaan rumah matematika ipa bindo sejarah' },{ id:'acara', label:'Acara', kw:'acara agenda event class meeting study tour kerja bakti' },{ id:'kenangan', label:'Kenangan', kw:'kenangan foto galeri memory polaroid' },{ id:'media', label:'Hiburan', kw:'media stiker video lucu youtube mp4 hiburan' }];
var SEARCH_RECENT_KEY = 'sagara-recent'; var recentSearches = []; try { recentSearches = JSON.parse(stGet(SEARCH_RECENT_KEY) || '[]') || []; } catch(e){ recentSearches = []; }
function searchIsOpen(){ return !!(searchPanel && searchPanel.classList.contains('open')); }
function buildSearchIndex(){
  var items = []; SEARCH_SECTIONS.forEach(function(s){ items.push({ type:'section', sectionId:s.id, title:s.label, desc:'', extra:s.kw }); });
  if (!isAuthed()){ items.push({ type:'login', sectionId:'', title:'Login', desc:'', extra:'login masuk signin auth akun' }); }
  $$('[data-card]').forEach(function(el){ var sec = el.closest('section'); if (!sec) return; var sid = sec.id; if (!sid) return; var d = getCardData(el); items.push({ type:'card', sectionId:sid, cardId: el.getAttribute('data-id') || '', title: d.title || '', desc: d.desc || '', extra: [d.num, d.tag, d.badge].filter(Boolean).join(' '), el: el }); });
  return items;
}
function fuzzyScore(tok, text){ if (!text) return 0; var t = String(text).toLowerCase(); var i = t.indexOf(tok); if (i === 0) return 100; if (i > 0){ var prev = t.charAt(i-1); var wordStart = (prev === ' ' || prev === '-' || prev === '_' || prev === '/' || prev === '('); return wordStart ? 80 : Math.max(30, 60 - i*0.5); } var p = 0, s = 0, last = -2, consec = 0; for (var j = 0; j < t.length && p < tok.length; j++){ if (t.charAt(j) === tok.charAt(p)){ s += (j === last+1) ? 12 : 5; if (j === last+1) consec++; last = j; p++; } } if (p !== tok.length) return 0; return Math.max(5, s + consec*3 - tok.length*0.2); }
function scoreItem(tokens, item){ var fields = [{ text:item.title, w:(item.type === 'section' || item.type === 'login') ? 1.8 : 1.4 },{ text:item.extra, w:0.9 },{ text:item.desc, w:0.6 }]; var sum = 0; for (var i = 0; i < tokens.length; i++){ var best = 0; for (var f = 0; f < fields.length; f++){ var sc = fuzzyScore(tokens[i], fields[f].text) * fields[f].w; if (sc > best) best = sc; } if (!best) return 0; sum += best; } return sum / tokens.length + ((item.type === 'section' || item.type === 'login') ? 10 : 0); }
function runSearch(q){ var tokens = String(q||'').trim().toLowerCase().split(/\s+/).filter(Boolean); if (!tokens.length) return null; var out = []; for (var i = 0; i < searchIndex.length; i++){ var sc = scoreItem(tokens, searchIndex[i]); if (sc > 0) out.push({ it: searchIndex[i], score: sc }); } out.sort(function(a,b){ return b.score - a.score; }); return out.slice(0, 50).map(function(r){ return r.it; }); }
function highlightText(text, tokens){ if (!text) return ''; if (!tokens || !tokens.length) return esc(text); var lower = text.toLowerCase(), ranges = []; for (var i = 0; i < tokens.length; i++){ var tok = tokens[i]; if (!tok) continue; var from = 0, at; while ((at = lower.indexOf(tok, from)) !== -1){ ranges.push([at, at+tok.length]); from = at + tok.length; } } if (!ranges.length) return esc(text); ranges.sort(function(a,b){ return a[0]-b[0]; }); var merged = [ranges[0]]; for (var k = 1; k < ranges.length; k++){ var last = merged[merged.length-1]; if (ranges[k][0] <= last[1]) last[1] = Math.max(last[1], ranges[k][1]); else merged.push(ranges[k]); } var out = '', pos = 0; for (var m = 0; m < merged.length; m++){ out += esc(text.slice(pos, merged[m][0])); out += '<mark>' + esc(text.slice(merged[m][0], merged[m][1])) + '</mark>'; pos = merged[m][1]; } out += esc(text.slice(pos)); return out; }
function snippet(text, tokens, max){ max = max || 90; if (!text) return ''; if (text.length <= max) return text; var lower = text.toLowerCase(), first = -1; for (var i = 0; i < tokens.length; i++){ var at = lower.indexOf(tokens[i]); if (at >= 0 && (first === -1 || at < first)) first = at; } if (first === -1) return text.slice(0, max).trim() + '…'; var start = Math.max(0, first-35); var end = Math.min(text.length, start + max); return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : ''); }
function sectionLabelOf(id){ for (var i = 0; i < SEARCH_SECTIONS.length; i++) if (SEARCH_SECTIONS[i].id === id) return SEARCH_SECTIONS[i].label; return id; }
function addRecent(q){ q = String(q||'').trim(); if (!q || q.length < 2) return; recentSearches = recentSearches.filter(function(x){ return x.toLowerCase() !== q.toLowerCase(); }); recentSearches.unshift(q); if (recentSearches.length > 3) recentSearches.length = 3; try { stSet(SEARCH_RECENT_KEY, JSON.stringify(recentSearches)); } catch(e){} }
function itemElements(){ if (!searchResults) return []; var all = searchResults.querySelectorAll('.search-item'), vis = []; for (var i = 0; i < all.length; i++) if (all[i].offsetParent !== null) vis.push(all[i]); return vis; }
function buildResultDOM(items, tokens){
  var html = '', nav = [], cards = []; items.forEach(function(it){ if (it.type === 'section' || it.type === 'login') nav.push(it); else cards.push(it); }); var idx = 0;
  function renderItem(it){
    var id = 'sopt-' + (idx++);
    if (it.type === 'section'){ return '<li class="search-item" role="option" id="'+id+'" data-type="section" data-sid="'+esc(it.sectionId)+'"><span class="search-item-body"><span class="search-item-label">Section</span><span class="search-item-title">'+highlightText(it.title, tokens)+'</span></span></li>'; }
    if (it.type === 'login'){ return '<li class="search-item" role="option" id="'+id+'" data-type="login"><span class="search-item-body"><span class="search-item-label">Akun</span><span class="search-item-title">'+highlightText(it.title, tokens)+'</span></span></li>'; }
    var sn = snippet(it.desc, tokens, 90);
    return '<li class="search-item" role="option" id="'+id+'" data-type="card" data-sid="'+esc(it.sectionId)+'" data-cid="'+esc(it.cardId||'')+'"><span class="search-item-body"><span class="search-item-label">'+esc(sectionLabelOf(it.sectionId))+'</span><span class="search-item-title">'+highlightText(it.title, tokens)+'</span>'+(sn?'<span class="search-item-snippet">'+highlightText(sn, tokens)+'</span>':'')+'</span></li>';
  }
  if (nav.length){ html += '<li class="search-group-label" data-group="section" role="presentation">Section</li>'; nav.forEach(function(it){ html += renderItem(it); }); }
  if (cards.length){ html += '<li class="search-group-label" data-group="card" role="presentation">Kartu</li>'; cards.forEach(function(it){ html += renderItem(it); }); }
  return html;
}
function buildEmptyState(){
  var html = ''; var validRecents = recentSearches.filter(function(saved){ for (var i = 0; i < searchIndex.length; i++) if (searchIndex[i].title === saved) return true; return false; });
  if (validRecents.length){ html += '<li class="search-group-label" data-group="recent" role="presentation">Pencarian terakhir</li>'; validRecents.forEach(function(q, i){ html += '<li class="search-item" role="option" id="sopt-'+i+'" data-type="recent" data-q="'+esc(q)+'"><span class="search-item-body"><span class="search-item-label">Terakhir</span><span class="search-item-title">'+esc(q)+'</span></span></li>'; }); }
  var base = validRecents.length; html += '<li class="search-group-label" role="presentation">Lompat ke</li>';
  SEARCH_SECTIONS.slice(0, 4).forEach(function(s, i){ html += '<li class="search-item" role="option" id="sopt-'+(base+i)+'" data-type="section" data-sid="'+esc(s.id)+'"><span class="search-item-body"><span class="search-item-label">Section</span><span class="search-item-title">'+esc(s.label)+'</span></span></li>'; }); return html;
}
function applyActiveIdx(){ var items = itemElements(); if (!items.length){ if (searchInput) searchInput.removeAttribute('aria-activedescendant'); return; } searchActiveIdx = ((searchActiveIdx % items.length) + items.length) % items.length; items.forEach(function(el, i){ el.classList.toggle('active', i === searchActiveIdx); el.setAttribute('aria-selected', i===searchActiveIdx?'true':'false'); }); var act = items[searchActiveIdx]; if (act){ if (searchInput) searchInput.setAttribute('aria-activedescendant', act.id); if (act.scrollIntoView) act.scrollIntoView({block:'nearest'}); } }
var announceTimer = null; function announce(msg){ if (announceTimer) clearTimeout(announceTimer); announceTimer = setTimeout(function(){ if (searchAnnounce) searchAnnounce.textContent = msg; }, 400); }
function renderSearch(){ if (!searchResults) return; var q = searchInput ? searchInput.value.trim() : ''; var tokens = q ? q.toLowerCase().split(/\s+/).filter(Boolean) : []; if (searchClear) searchClear.hidden = !q; if (!q){ searchResults.innerHTML = buildEmptyState(); announce('Menu pencarian terbuka'); } else { var results = runSearch(q) || []; if (!results.length){ searchResults.innerHTML = '<li class="search-empty">Tidak ada hasil untuk <b>'+esc(q)+'</b>.<br><span style="font-size:.72rem;opacity:.7">Coba kata lain, atau tekan esc untuk menutup.</span></li>'; announce('Tidak ada hasil untuk ' + q); } else { searchResults.innerHTML = buildResultDOM(results, tokens); announce(results.length + ' hasil untuk ' + q); } } searchActiveIdx = 0; applyActiveIdx(); }
function flashTarget(el){ if (!el) return; el.classList.add('is-flash'); setTimeout(function(){ el.classList.remove('is-flash'); }, 1600); }
function activateItem(el){
  if (!el) return; var type = el.getAttribute('data-type');
  if (type !== 'recent'){ var titleEl = el.querySelector('.search-item-title'); if (titleEl) addRecent(titleEl.textContent); }
  if (type === 'section'){ closeSearch(); var sid = el.getAttribute('data-sid'); var hash = '#' + sid; if (location.hash !== hash){ if (history.replaceState) history.replaceState(null, '', hash); else location.hash = hash; } setTimeout(function(){ smoothScroll(hash); }, 30); var secEl = $id(sid); if (secEl) setTimeout(function(){ flashTarget(secEl); }, 350); }
  else if (type === 'card'){ var sid2 = el.getAttribute('data-sid'); var cid = el.getAttribute('data-cid'); closeSearch(); var target = cid ? document.querySelector('[data-card][data-id="'+cid+'"]') : null; if (!target) target = $id(sid2); if (target){ if (history.replaceState) history.replaceState(null, '', '#' + sid2); else location.hash = sid2; smoothScroll(target); setTimeout(function(){ flashTarget(target); }, 350); } }
  else if (type === 'recent'){ if (searchInput){ searchInput.value = el.getAttribute('data-q') || ''; renderSearch(); } }
  else if (type === 'login'){ closeSearch(); location.hash = '#/login'; }
}
$$('.search-filter').forEach(function(btn){ on(btn, 'click', function(){ searchFilter = btn.getAttribute('data-filter') || 'all'; $$('.search-filter').forEach(function(b){ b.classList.toggle('is-active', b===btn); b.setAttribute('aria-selected', b===btn?'true':'false'); }); if (searchResults) searchResults.setAttribute('data-filter', searchFilter); searchActiveIdx = 0; applyActiveIdx(); }); });
function openSearch(){ if (!searchPanel || searchIsOpen()) return; if (formModal && !formModal.hidden) return; if (confirmDialog && !confirmDialog.hidden) return; if (loginView && !loginView.hidden) return; searchIndex = buildSearchIndex(); searchFilter = 'all'; if (searchResults) searchResults.setAttribute('data-filter', 'all'); $$('.search-filter').forEach(function(b){ var isAll = b.getAttribute('data-filter')==='all'; b.classList.toggle('is-active', isAll); b.setAttribute('aria-selected', isAll?'true':'false'); }); searchPanel.classList.add('open'); document.body.classList.add('search-open'); if (searchInput) searchInput.setAttribute('aria-expanded','true'); if (searchInput) searchInput.value = ''; renderSearch(); if (!hasTouch && searchInput) setTimeout(function(){ try { searchInput.focus(); } catch(e){} }, 80); }
function closeSearch(){ if (!searchPanel || !searchIsOpen()) return; searchPanel.classList.remove('open'); document.body.classList.remove('search-open'); if (searchInput) searchInput.setAttribute('aria-expanded','false'); }
on(searchBtn, 'click', function(e){ e.stopPropagation(); if (searchIsOpen()) closeSearch(); else openSearch(); });
on(searchInput, 'input', renderSearch);
on(searchClear, 'click', function(){ if (searchInput){ searchInput.value = ''; searchInput.focus(); renderSearch(); } });
on(searchInput, 'keydown', function(e){ var items = itemElements(); if (e.key === 'ArrowDown'){ e.preventDefault(); searchActiveIdx++; applyActiveIdx(); } else if (e.key === 'ArrowUp'){ e.preventDefault(); searchActiveIdx--; applyActiveIdx(); } else if (e.key === 'Home'){ e.preventDefault(); searchActiveIdx = 0; applyActiveIdx(); } else if (e.key === 'End'){ e.preventDefault(); searchActiveIdx = items.length-1; applyActiveIdx(); } else if (e.key === 'Enter'){ e.preventDefault(); var act = items[searchActiveIdx]; if (act) activateItem(act); } });
on(searchResults, 'click', function(e){ var item = e.target.closest ? e.target.closest('.search-item') : null; if (item) activateItem(item); });
on(searchResults, 'mouseover', function(e){ var item = e.target.closest ? e.target.closest('.search-item') : null; if (!item) return; var items = itemElements(); for (var i = 0; i < items.length; i++) if (items[i] === item){ if (searchActiveIdx !== i){ searchActiveIdx = i; applyActiveIdx(); } return; } });
document.addEventListener('click', function(e){ if (!searchIsOpen()) return; var t = e.target; if (!t || !t.closest) return; if (t.closest('.search-modal-wrap')) return; if (t.id === 'searchPanel'){ closeSearch(); return; } closeSearch(); });
document.addEventListener('keydown', function(e){ var tag = (e.target && e.target.tagName) || ''; var isField = tag === 'INPUT' || tag === 'TEXTAREA'; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); if (searchIsOpen()) closeSearch(); else openSearch(); return; } if (e.key === '/' && !isField && !searchIsOpen()){ e.preventDefault(); openSearch(); return; } if (e.key === 'Escape'){ if (confirmDialog && !confirmDialog.hidden){ closeConfirm(); return; } if (formModal && !formModal.hidden){ closeFormModal(); return; } if (searchIsOpen()){ closeSearch(); return; } if (document.body.classList.contains('editing')){ exitEditMode(); return; } if (document.body.classList.contains('selecting')){ exitSelectionMode(); return; } } });

// ===== ANCHOR =====
document.addEventListener('click', function(e){ var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return; var href = a.getAttribute('href'); if (!href || href === '#' || href.indexOf('#/') === 0) return; if (loginView && !loginView.hidden) return; if (a.id === 'brand' && isAuthed()) return; if (a.classList.contains('pg-wa')) return; var target = document.querySelector(href); if (!target) return; e.preventDefault(); if (history.replaceState) history.replaceState(null, '', href); smoothScroll(target); });

// ===== SECTION DOTS + PROGRESS =====
var SECTION_IDS = ['home','struktur','aturan','tugas','acara','kenangan','media']; var navMap = {}, dotMap = {};
SECTION_IDS.forEach(function(id){ var nl = document.querySelector('.links a[href="#'+id+'"]'); if (nl) navMap[id] = nl; var d = document.querySelector('.section-dots a[href="#'+id+'"]'); if (d) dotMap[id] = d; });
function setActiveSection(id){ Object.keys(navMap).forEach(function(k){ navMap[k].classList.remove('active'); }); Object.keys(dotMap).forEach(function(k){ dotMap[k].classList.remove('active'); }); if (navMap[id]) navMap[id].classList.add('active'); if (dotMap[id]) dotMap[id].classList.add('active'); }
if ('IntersectionObserver' in window){ var spy = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (en.isIntersecting) setActiveSection(en.target.id); }); }, {rootMargin:'-45% 0px -50% 0px', threshold:0}); SECTION_IDS.forEach(function(id){ var s = $id(id); if (s) spy.observe(s); }); }
var progress = $id('progress'), toTop = $id('toTop'), ticking = false;
function onScroll(){ var h = document.documentElement; var max = h.scrollHeight - h.clientHeight; var pct = max > 0 ? (h.scrollTop/max)*100 : 0; if (progress) progress.style.width = pct + '%'; if (toTop) toTop.classList.toggle('show', h.scrollTop > 300); ticking = false; }
window.addEventListener('scroll', function(){ if (!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive:true}); window.addEventListener('resize', onScroll); onScroll();
on(toTop, 'click', function(){ smoothScroll(0); }); var yearEl = $id('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

// ===== REVEAL =====
$$('.reveal').forEach(function(el){ var p = el.parentElement; if (!p) return; var sibs = Array.from(p.children).filter(function(c){ return c.classList && c.classList.contains('reveal'); }); var idx = sibs.indexOf(el); if (idx > 0 && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', (idx*70)+'ms'); });
var revealEls = $$('.reveal'); if ('IntersectionObserver' in window){ var io = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (!en.isIntersecting) return; en.target.classList.add('in'); io.unobserve(en.target); }); }, {threshold:0.08, rootMargin:'0px 0px -20px 0px'}); revealEls.forEach(function(el){ io.observe(el); }); } else { revealEls.forEach(function(el){ el.classList.add('in'); }); }

// ===== TABS ATURAN =====
$$('.tab-btn').forEach(function(btn){
  on(btn, 'click', function(){
    var targetTab = btn.getAttribute('data-tab');
    $$('.tab-btn').forEach(function(b){ b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('is-active'); btn.setAttribute('aria-selected', 'true');
    $$('.tab-panel').forEach(function(p){ p.classList.remove('is-active'); });
    var targetPanel = document.querySelector('.tab-panel[data-tabpanel="' + targetTab + '"]');
    if (targetPanel) targetPanel.classList.add('is-active');
  });
});

// ===== FIRESTORE RENDER FUNCTIONS =====
function renderPengurus(items){
  if (!items || items.length === 0) { var ep = $id('empty-pengurus'); if (ep) ep.hidden = false; return; }
  var ep2 = $id('empty-pengurus'); if (ep2) ep2.hidden = true;
  items.forEach(function(item){
    var card = document.querySelector('.pg-card[data-role="' + item.id + '"]'); if (!card) return;
    var nameEl = card.querySelector('[data-name]'); var roleEl = card.querySelector('.pg-role'); var waEl = card.querySelector('.pg-wa'); var avatarEl = card.querySelector('.pg-avatar');
    if (nameEl) nameEl.textContent = item.nama || '—';
    if (roleEl) roleEl.textContent = item.jabatan || '—';
    if (avatarEl){ if (item.foto){ avatarEl.innerHTML = '<img src="' + esc(item.foto) + '" alt="" loading="lazy">'; } else { avatarEl.textContent = (item.nama || '?').charAt(0).toUpperCase(); } }
    if (waEl){ var waNum = (item.wa || '').replace(/\D/g, ''); if (waNum){ waEl.href = 'https://wa.me/' + waNum; waEl.hidden = false; } else { waEl.hidden = true; } }
    card.setAttribute('data-firestore-id', item.id);
    ensureCardActions(card); bindCard(card);
  });
}
function renderAturanUmum(items){
  var list = document.querySelector('#aturan .tab-panel[data-tabpanel="umum"] .rules-list'); if (!list) return;
  var ep = $id('empty-aturan');
  if (!items || items.length === 0) { list.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  list.innerHTML = items.map(function(it, i){ var num = it.nomor || String(i + 1).padStart(2, '0'); return '<li class="rule" data-card data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.id) + '"><span class="rule-num">' + esc(num) + '</span><div><h3>' + esc(it.judul || '—') + '</h3><p>' + esc(it.deskripsi || '') + '</p></div></li>'; }).join('');
  list.querySelectorAll('[data-card]').forEach(function(c){ ensureCardActions(c); bindCard(c); });
}
function renderAturanMapel(items){
  var panel = document.querySelector('#aturan .tab-panel[data-tabpanel="mapel"] [data-cards]'); if (!panel) return;
  var ep = $id('empty-mapel');
  if (!items || items.length === 0) { panel.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  panel.innerHTML = items.map(function(it, i){ var rules = (it.aturan || []).map(function(r){ return '<li>' + esc(r) + '</li>'; }).join(''); return '<details class="mapel-group" data-card data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.id) + '"' + (i === 0 ? ' open' : '') + '><summary>' + esc(it.nama || '—') + '</summary><ul class="mapel-rules">' + rules + '</ul></details>'; }).join('');
  panel.querySelectorAll('[data-card]').forEach(function(c){ ensureCardActions(c); bindCard(c); });
}
function renderTugas(items){
  var list = document.getElementById('tugasList'); if (!list) return;
  var ep = $id('empty-tugas');
  if (!items || items.length === 0) { list.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  list.innerHTML = items.map(function(it){ var iso = it.dueDate || ''; var tid = 'chk-' + it.id; return '<div class="tugas-item" data-card data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.id) + '" data-due="' + esc(iso) + '" data-tag="' + esc(it.mapel || '') + '"><div class="tugas-check"><input type="checkbox" id="' + esc(tid) + '" data-task-id="' + esc(it.id) + '"><label for="' + esc(tid) + '" aria-label="Tandai selesai"></label></div><div class="tugas-body"><h3>' + esc(it.judul || '—') + '</h3><p>' + esc(it.deskripsi || '') + '</p></div><div class="tugas-meta"><span class="tugas-tag">' + esc(it.mapel || '—') + '</span><time class="tugas-due" datetime="' + esc(iso) + '" data-due="' + esc(iso) + '">—</time></div></div>'; }).join('');
  list.querySelectorAll('[data-card]').forEach(function(c){ ensureCardActions(c); bindCard(c); });
  initTugasCheckboxes(); refreshTugasLabels(); updateTugasProgress(); refreshBoard();
}
function renderAcara(items){
  var list = document.querySelector('#acara .acara-list'); if (!list) return;
  var ep = $id('empty-acara');
  if (!items || items.length === 0) { list.innerHTML = ''; if (ep) ep.hidden = false; return; }
  if (ep) ep.hidden = true;
  list.innerHTML = items.map(function(it){ var iso = it.tanggal || ''; var d = parseISO(iso); return '<div class="acara-item" data-card data-id="' + esc(it.id) + '" data-firestore-id="' + esc(it.id) + '" data-due="' + esc(iso) + '"><div class="acara-date"><b class="acara-day">' + d.getDate() + '</b><span class="acara-mon">' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + '</span></div><div class="acara-body"><h3>' + esc(it.judul || '—') + '</h3><p>' + esc(it.deskripsi || '') + '</p><div class="acara-meta"><span class="acara-time">' + esc(it.waktu || '—') + '</span><span class="acara-place">' + esc(it.tempat || '—') + '</span></div></div><div class="acara-side"><span class="acara-badge">' + esc(it.badge || 'Acara') + '</span><span class="acara-in"></span></div></div>'; }).join('');
  list.querySelectorAll('[data-card]').forEach(function(c){ ensureCardActions(c); bindCard(c); });
  refreshBoard();
}
function initFirestoreSync(){
  if (!window.__sagaraData) { 
    if(!window.__sagaraRetryCount) window.__sagaraRetryCount = 0;
    if(window.__sagaraRetryCount < 20) { window.__sagaraRetryCount++; setTimeout(initFirestoreSync, 500); } 
    else { console.warn('[Sagara] Firestore gagal dimuat.'); }
    return; 
  }
  window.__sagaraData.watch('pengurus', 'urutan', renderPengurus);
  window.__sagaraData.watch('aturan', 'urutan', renderAturanUmum);
  window.__sagaraData.watch('mapel', 'urutan', renderAturanMapel);
  window.__sagaraData.watch('tugas', 'urutan', renderTugas);
  window.__sagaraData.watch('acara', 'urutan', renderAcara);
  window.__sagaraData.watch('kenangan', 'urutan', function(items){ renderKenangan(items); });
  window.__sagaraData.watch('media', 'urutan', function(items){ renderMedia(items); });
  console.log('[Sagara] Firestore sync active');
}

// ===== INIT =====
function bootApp(){
  initTugasCheckboxes();
  refreshTugasLabels();
  refreshBoard();
  updateTugasProgress();
  renderKenangan([]);
  renderMedia([]);
  setRole(window.__sagaraUser ? window.__sagaraUser.role : null);
  route();
  initFirestoreSync();
  setInterval(function(){ refreshTugasLabels(); refreshBoard(); }, 60000);
}

// Safety net: tunggu body ada sebelum boot
if (document.readyState === 'loading' || !document.body) {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

})();