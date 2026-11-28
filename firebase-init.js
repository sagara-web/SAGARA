/* =========================================================
   SAGARA — firebase-init.js
   Port verbatim dari <script type="module"> di sagaraprev.html
   Module script. Wajib di-load SETELAH app.js:
     <script src="app.js"></script>
     <script type="module" src="firebase-init.js"></script>
   Meng-ekspos:
     window.__sagaraData   (CRUD + watch + seed)
     window.__sagaraAuth   (login/logout wrapper)
     window.__sagaraUser   (di-set oleh onAuthStateChanged)
     window.__sagaraApplyAuth  (didefinisikan app.js, dipanggil di sini)
   ========================================================= */
import {
  auth, db,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch
} from './firebase-config.js';

// ========== ROLE CONFIG ==========
const DEVELOPER_EMAILS = ['users@arczeyn.arcane.com'];
const ADMIN_EMAILS     = ['users@admin.sagara.com', 'users@hanzz.arcane.com'];
const WALI_EMAILS      = ['users@walikelas.sagara.com'];
const MEMBER_EMAILS    = ['users@member.arcane.com', 'users@member.sagara.com', 'users@anggota.sagara.com'];

function roleFromEmail(email){
  if (!email) return null;
  const e = email.toLowerCase();
  if (DEVELOPER_EMAILS.includes(e)) return 'developer';
  if (ADMIN_EMAILS.includes(e))     return 'admin';
  if (WALI_EMAILS.includes(e))      return 'walikelas';
  if (MEMBER_EMAILS.includes(e))    return 'member';
  return 'member';
}

// ========== COLLECTIONS ==========
const COL = {
  pengurus:      'sagara_pengurus',
  aturan:        'sagara_aturan',
  mapel:         'sagara_mapel',
  tugas:         'sagara_tugas',
  acara:         'sagara_acara',
  kenangan:      'sagara_kenangan',
  media:         'sagara_media',
  meta:          'sagara_meta'
};

// ========== SEED DATA ==========
const SEED_PENGURUS = [
  { id: 'walikelas',   nama: 'Wali Kelas IX-G', jabatan: 'Wali Kelas', wa: '', foto: '' },
  { id: 'ketua',       nama: 'Ketua Kelas',     jabatan: 'Ketua',      wa: '', foto: '' },
  { id: 'wakil',       nama: 'Wakil Ketua',     jabatan: 'Wakil',      wa: '', foto: '' },
  { id: 'sekretaris1', nama: 'Sekretaris 1',    jabatan: 'Sekretaris', wa: '', foto: '' },
  { id: 'bendahara1',  nama: 'Bendahara 1',     jabatan: 'Bendahara',  wa: '', foto: '' },
  { id: 'sekretaris2', nama: 'Sekretaris 2',    jabatan: 'Sekretaris', wa: '', foto: '' },
  { id: 'bendahara2',  nama: 'Bendahara 2',     jabatan: 'Bendahara',  wa: '', foto: '' }
];

const SEED_ATURAN = [
  { nomor: '01', judul: 'Datang tepat waktu',  deskripsi: 'Masuk kelas sebelum bel. Kalau terlambat, beri alasan yang jelas di buku piket.', urutan: 1 },
  { nomor: '02', judul: 'Izin sebelum keluar', deskripsi: 'Mau keluar kelas? Lapor dulu ke guru yang mengajar atau ketua kelas.',         urutan: 2 },
  { nomor: '03', judul: 'Jaga kebersihan',     deskripsi: 'Buang sampah pada tempatnya dan jalankan piket sesuai jadwal mingguan.',         urutan: 3 },
  { nomor: '04', judul: 'Hindari keributan',   deskripsi: 'Saat guru menjelaskan, dengarkan dulu. Bercanda setelahnya.',                    urutan: 4 },
  { nomor: '05', judul: 'Saling menghargai',   deskripsi: 'Tidak ada yang boleh di-bully. Beda pendapat itu biasa.',                        urutan: 5 },
  { nomor: '06', judul: 'HP sesuai kebutuhan', deskripsi: 'Dipakai saat perlu untuk belajar, disimpan saat tidak diperlukan.',              urutan: 6 }
];

const SEED_MAPEL = [
  { nama: 'Matematika',       aturan: ['Bawa kalkulator ilmiah setiap pelajaran.', 'Kumpul PR sebelum masuk kelas.', 'Tulis langkah pengerjaan, bukan cuma jawaban akhir.'], urutan: 1 },
  { nama: 'IPA',              aturan: ['Wajib pakai jas lab saat praktikum.', 'Cuci alat sebelum dikembalikan.', 'Laporan praktikum dikumpul maks. 3 hari setelahnya.'],   urutan: 2 },
  { nama: 'Bahasa Indonesia', aturan: ['Tugas tulis tangan, tidak boleh print.', 'Minimal 300 kata untuk teks eksposisi.', 'Sertakan daftar pustaka kalau mengutip.'],        urutan: 3 },
  { nama: 'Sejarah',          aturan: ['Rangkuman minimal 2 halaman, tulis tangan.', 'Sertakan garis waktu peristiwa.', 'Tulis sendiri-sendiri walau diskusi kelompok.'],    urutan: 4 }
];

const SEED_TUGAS = [
  { judul: 'Latihan soal bab 4', deskripsi: 'Halaman 88–90, nomor 1 sampai 15. Tulis di buku tulis.',       mapel: 'Matematika',    dueDate: '2026-11-15', urutan: 1 },
  { judul: 'Teks eksposisi',      deskripsi: 'Buat teks eksposisi 300 kata, tema bebas.',                     mapel: 'B. Indonesia', dueDate: '2026-11-17', urutan: 2 },
  { judul: 'Laporan praktikum',   deskripsi: 'Laporan fotosintesis, dikerjakan per kelompok.',                mapel: 'IPA',          dueDate: '2026-11-19', urutan: 3 },
  { judul: 'Rangkuman materi',    deskripsi: 'Rangkum bab kemerdekaan, minimal dua halaman, tulis tangan.',   mapel: 'Sejarah',      dueDate: '2026-11-21', urutan: 4 }
];

const SEED_ACARA = [
  { judul: 'Class Meeting',     deskripsi: 'Lomba antar kelas dan pertandingan persahabatan.', tanggal: '2026-12-05', waktu: '08.00', tempat: 'Lapangan sekolah', badge: 'Lomba',     urutan: 1 },
  { judul: 'Kerja Bakti Kelas', deskripsi: 'Bersih-bersih kelas dan menghias dinding.',         tanggal: '2026-12-14', waktu: '07.30', tempat: 'Ruang IX-G',        badge: 'Rutin',     urutan: 2 },
  { judul: 'Study Tour',        deskripsi: 'Kunjungan belajar ke museum.',                       tanggal: '2026-12-20', waktu: '06.00', tempat: 'Gerbang sekolah',   badge: 'Kunjungan', urutan: 3 }
];

const SEED_KENANGAN = [
  { caption: 'foto kelas pertama',  imageUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&q=80', urutan: 1 },
  { caption: 'perayaan ulang tahun', imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&q=80', urutan: 2 },
  { caption: 'praktikum IPA',       imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&q=80', urutan: 3 },
  { caption: 'futsal antar kelas',  imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80', urutan: 4 },
  { caption: 'menghias kelas',      imageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80', urutan: 5 },
  { caption: 'kerja bakti sore',    imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80', urutan: 6 }
];

const SEED_MEDIA = [
  { judul: 'Stiker SAGARA Keren', deskripsi: 'Stiker resmi kelas IX-G', tipe: 'stiker', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&q=80', urutan: 1 },
  { judul: 'Video Lucu Kelas', deskripsi: 'Kompilasi tingkah lucu anak IX-G', tipe: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', urutan: 2 },
  { judul: 'Stiker Tepuk Tangan', deskripsi: 'Stiker tepuk tangan khas Sagara', tipe: 'stiker', url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&q=80', urutan: 3 }
];

// ========== SEED LOGIC ==========
async function seedIfEmpty(colKey, items, useFixedIds){
  const colRef = collection(db, COL[colKey]);
  const snap = await getDocs(colRef);
  if (!snap.empty) return;
  const batch = writeBatch(db);
  items.forEach(function(item, idx){
    const copy = { ...item };
    if (useFixedIds && copy.id){
      const id = copy.id;
      delete copy.id;
      batch.set(doc(colRef, id), { ...copy, urutan: idx, createdAt: serverTimestamp() });
    } else {
      const newRef = doc(colRef);
      batch.set(newRef, { ...copy, urutan: copy.urutan || idx, createdAt: serverTimestamp() });
    }
  });
  await batch.commit();
  console.log('[Sagara] Seeded:', colKey, '(' + items.length + ')');
}

async function seedAll(){
  const metaRef = doc(db, COL.meta, 'init');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().seeded) return;
  } catch(e){}
  try {
    await seedIfEmpty('pengurus', SEED_PENGURUS, true);
    await seedIfEmpty('aturan',   SEED_ATURAN);
    await seedIfEmpty('mapel',    SEED_MAPEL);
    await seedIfEmpty('tugas',    SEED_TUGAS);
    await seedIfEmpty('acara',    SEED_ACARA);
    await seedIfEmpty('kenangan', SEED_KENANGAN);
    await seedIfEmpty('media',    SEED_MEDIA);
    await setDoc(metaRef, { seeded: true, seededAt: serverTimestamp() });
    console.log('[Sagara] Seed complete');
  } catch (err) {
    console.error('[Sagara] Seed failed:', err);
  }
}

// ========== DATA WRAPPER ==========
window.__sagaraData = {
  async add(colKey, data){ return addDoc(collection(db, COL[colKey]), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); },
  async update(colKey, id, data){ return updateDoc(doc(db, COL[colKey], id), { ...data, updatedAt: serverTimestamp() }); },
  async updateFixed(colKey, id, data){ return setDoc(doc(db, COL[colKey], id), { ...data, updatedAt: serverTimestamp() }, { merge: true }); },
  async remove(colKey, id){ return deleteDoc(doc(db, COL[colKey], id)); },
  watch(colKey, orderField, cb){
    try {
      const colRef = collection(db, COL[colKey]);
      const q = orderField ? query(colRef, orderBy(orderField)) : colRef;
      return onSnapshot(q, function(snap){
        const items = [];
        snap.forEach(function(d){ items.push({ id: d.id, ...d.data() }); });
        cb(items);
      }, function(err){
        console.warn('[Sagara] Watch ' + colKey + ':', err.message);
        cb([]);
      });
    } catch(err){
      console.warn('[Sagara] Watch setup ' + colKey + ':', err.message);
      cb([]);
    }
  },
  seedAll,
  ready: true
};

// ========== AUTH ==========
window.__sagaraAuth = {
  login:  (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  logout: () => signOut(auth)
};

onAuthStateChanged(auth, async function(user){
  window.__sagaraUser = user ? { email: user.email, uid: user.uid, role: roleFromEmail(user.email) } : null;
  if (window.__sagaraUser && (window.__sagaraUser.role === 'admin' || window.__sagaraUser.role === 'walikelas' || window.__sagaraUser.role === 'developer')){
  await seedAll();
  }
  if (typeof window.__sagaraApplyAuth === 'function'){
    window.__sagaraApplyAuth(window.__sagaraUser);
  }
});

console.log('[Sagara] Firestore module ready.');