# P06 · Risiko AI/LLM dan Prompt Injection

Paket praktikum minggu 6 untuk mata kuliah PMI 1522 Keamanan Sistem Informasi, semester 5. Seluruh materi, simulator asisten, state, screenshot, studi kasus, backup, dan laporan berjalan offline sebagai file statis. Paket tidak memerlukan CDN, server, API AI, Python, file BAT, service worker, atau koneksi jaringan saat digunakan.

## Kontrak RPS minggu 6

- Mata kuliah: Keamanan Sistem Informasi
- Kode: PMI 1522
- Minggu: 6
- CPMK-1: Menjelaskan prinsip keamanan informasi, kontrol akses, keamanan aplikasi, dan risiko LLM/AI seperti prompt injection.
- Sub-2: Menjelaskan identitas, autentikasi, otorisasi, least privilege, keamanan aplikasi, privasi, dan risiko LLM/AI.
- Indikator: Menjelaskan risiko LLM/AI dan kontrolnya; minimal 60% skenario benar.
- Materi: Prompt injection; sensitive information disclosure; insecure output; excessive agency; human oversight.
- Metode: Threat modeling fitur AI; red-team exercise aman berbasis skenario.
- Waktu: T: 1×50 menit; P: 1×170 menit; PT+KM: 2×60 menit
- Asesmen: Studi kasus risiko AI/LLM
- Bobot: 5% (kontribusi ke CPMK-1; asesmen studi kasus risiko AI/LLM = 10 studi kasus 60% + web dummy LLM 40%. Empat lab terpandu dan latihan mandiri lain adalah kegiatan pendampingan dan tidak menambah bobot nilai RPS)
- Sumber: PP-1 (OWASP Top 10 for Large Language Model Applications, 2026); MD-1 (NIST AI Risk Management Framework, 2023)
- Dosen pengampu (RPS): M. Reza Redo Islami, S.Kom., M.T.I.; Akhmad Jayadi, S.Kom., M.Cs.
- Dosen paket: Muhammad Reza Redo Islami. S.Kom.,M.T.I.

## Yang dinilai dan yang tidak

- **Dinilai (5%):** teori enam bagian + satu demonstrasi terpandu (pilih satu lab) + asesmen studi kasus = 10 studi kasus (ambang 60%, bobot 60%) + satu web dummy LLM (bobot 40%).
- **Tidak dinilai (pengayaan):** tiga lab terpandu tambahan + tiga latihan mandiri lain + screenshotnya. Penyelesaian kegiatan ini hanya menandai kesiapan; tidak menambah atau mengurangi nilai RPS.

## Menjalankan modul

1. Pertahankan struktur `index.html` dan folder `assets/`.
2. Buka `index.html` langsung dengan browser modern melalui `file://`.
3. Mulai dari tab **02 Teori** (enam bagian: threat model, prompt injection langsung/tidak langsung, sensitive information disclosure, insecure output handling, excessive agency, human oversight), lalu **03 Lab Terpandu**, **04 Studi Kasus & Latihan**, dan **05 Rekap**.
4. Isi identitas dan deklarasi etis pada tab **01 Mulai**. Semua asisten adalah simulasi berbasis aturan dengan data sintetis. Jangan menguji chatbot, layanan AI, atau sistem pihak lain.

State disimpan sebagai satu objek `localStorage` dengan key `p06-ksi-ai-llm-state-v1` (unik terhadap paket lain). JSON korup dipulihkan menjadi struktur kosong. Penulisan state bersifat transaksional: bila kuota gagal, state lama tetap dipakai. **Reset semua data lokal** hanya menghapus key P06.

## Backup dan pemulihan

Tab **05 Rekap** menyediakan **Unduh backup JSON** dan **Pulihkan dari JSON**. Berkas backup memuat penanda `P06-KSI-AI-LLM`; backup paket lain, JSON rusak, atau berkas lebih dari 8 MB ditolak. Isi dinormalisasi ulang sehingga hanya field yang dikenal dan gambar `data:image/jpeg|png|webp` yang diterima.

## Struktur runtime

- `index.html` — lima tab ARIA, teori lengkap dengan glosarium, dua figur SVG aksesibel, dan wadah aktivitas.
- `assets/lab-engine.js` — asisten tiruan berbasis aturan untuk empat skenario (injeksi langsung, injeksi tidak langsung, pengungkapan data, agensi berlebih) beserta versi aman.
- `assets/security-lab.js` — kontrak empat lab delapan tahap, tiga kontrol per lab, kode rentan/aman, dan diff.
- `assets/web-dummy.js` — batas waktu dosen (`DEADLINE_ISO`), empat kasus uji dengan canary, model terburuk, harness iframe sandbox, pemindaian API key, ringkasan log LLM, hash SHA-256/FNV-1a, dan skor otomatis /40.
- `assets/task-bank.js` — sepuluh studi kasus (risiko + kontrol, ambang 60%), contoh kerja teori, dan empat tugas live.
- `assets/evidence.js` — normalisasi state, rollback kuota, backup/restore JSON, kompresi gambar, dan laporan resmi A4.
- `assets/app.js` — tab keyboard, tracker, gating tombol, persistence, screenshot, backup, preview, dan cetak.
- `assets/style.css` — tema navy/cyan identik paket MK lain, responsif, dan cetak A4 khusus laporan.
- `assets/logo-polinela.png`, `assets/logo-sdgs.jpg` — logo lokal untuk UI dan laporan.

## Lab terpandu

Setiap lab mengikuti siklus prediksi → jalankan simulasi lokal → lihat perbedaan → pilih/terapkan kontrol → retest payload sama → observasi → sebab → kesimpulan. Payload hanya dikunci bila simulator benar-benar mencatat pelanggaran kebijakan. Pilihan kontrol yang keliru memberi alasan kausal dan tidak membuka retest. Semua field catatan tetap dapat diedit.

## Web dummy dinilai (40% asesmen)

Mahasiswa memilih satu kasus Latihan Mandiri dan membangun dua halaman (rentan dan aman) yang memanggil **LLM asli dengan API key milik sendiri**. Key tidak boleh ada di kode atau repo; halaman menyediakan kolom isian key. Halaman wajib menyediakan `window.asisten(pesan, konteks, model)` yang mengembalikan `{ balasan, aksi }`.

- **Pemeriksa otomatis (40 poin):** modul memuat file unggahan di `iframe sandbox="allow-scripts"` dan memberi `model` terburuk (LLM tiruan yang selalu mematuhi penyusup). Versi rentan harus terbukti rentan, versi aman harus menahan serangan dan tetap melayani permintaan normal. Kontrol harus berada di luar model.
- **Bukti LLM asli:** log JSON `P06-WEB-DUMMY` berisi minimal 3 run per versi dengan payload sama.
- **Hosting:** GitHub Pages atau Netlify Drop (wajib login). Patokan waktu adalah waktu deploy tercatat server; batas waktu ditanam di `assets/web-dummy.js` dan modul menampilkan TEPAT WAKTU/TERLAMBAT. Ubah `DEADLINE_ISO` sebelum membagikan ZIP bila batas waktu berubah.
- **Laporan PDF:** URL https dicetak sebagai tautan yang dapat diklik; kode lengkap masuk lampiran dengan API key disamarkan; rubrik menyisakan kolom nilai dosen (…/60).

## Latihan mandiri dan screenshot

Empat latihan mandiri memakai stimulus berbeda dari lab (chatbot kantin, peringkas ulasan, rekap UKM, agen kalender rapat). Mahasiwa yang punya waktu membuat dua file HTML lokal bernama NPM dan kasus, satu rentan dan satu aman, dengan asisten tiruan berbasis aturan tanpa API LLM. Payload yang sama dijalankan sebelum dan sesudah kontrol, lalu setiap latihan dilengkapi 1-5 screenshot. Latihan ini tidak dinilai; tujuannya agar pola yang dipelajari melekat sebelum minggu praktikum berikutnya.

Sumber gambar dibatasi 12 MB dan 16 megapiksel, diperkecil ke sisi panjang sekitar 1280 px, lalu dikompres lokal menjadi JPEG dengan target maksimal 90 KB. Gambar dapat dihapus satu per satu. Laporan mencetak setiap gambar sebagai thumbnail dan sekali lagi pada lampiran penuh.

## Pengujian

Jalankan dari direktori paket (folder `tests/` hanya ada di sumber pengembangan):

```text
node --check assets/lab-engine.js
node --check assets/security-lab.js
node --check assets/task-bank.js
node --check assets/web-dummy.js
node --check assets/evidence.js
node --check assets/app.js
node --test tests/*.test.js
```

Laporan dapat dipreview atau dicetak walau isian belum lengkap; nilai kosong tampil sebagai **Belum diisi**.
