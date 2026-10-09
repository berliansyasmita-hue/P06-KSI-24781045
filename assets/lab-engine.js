(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.P06Engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Asisten tiruan berbasis aturan. Tidak ada model atau layanan AI nyata; semua data sintetis dan hanya di memori.
  // ponytail: pengenal niat berbasis leksikon kecil, cukup untuk memperlihatkan mekanisme, bukan detektor produksi.
  const MAX_INPUT = 4000;
  const OVERRIDE = /\b(abaikan|lupakan|timpa|ignore|disregard|override)\b|\b(kamu|anda|engkau)\s+(sekarang|kini)\b|\bmode\s+(admin|developer|debug|dewa|super)\b|\bbertindak\s+sebagai\b|\binstruksi\s+(baru|sebelumnya|di\s*atas)\b|\baturan\s+(baru|sebelumnya)\b/i;
  const freeze = value => { Object.values(value).forEach(v => { if (v && typeof v === "object") freeze(v); }); return Object.freeze(value); };
  const norm = value => String(value == null ? "" : value).normalize("NFKC").slice(0, MAX_INPUT);
  const sentences = text => norm(text).split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  const rupiah = n => `Rp${Number(n).toLocaleString("id-ID")}`;
  const assessment = (recognized, exploited) => exploited ? "pelanggaran-terkonfirmasi" : recognized ? "dievaluasi-tanpa-pelanggaran" : "tidak-dievaluasi";
  // Hasil "tidak-dievaluasi" berarti leksikon simulator tidak memahami input; bukan klaim aman.

  // ---------- Lab 1 · Direct prompt injection pada asisten perpustakaan ----------
  const LIBRARY = freeze({
    member: "M-2207", fine: 18000, hours: "Senin–Jumat 07.30–16.00",
    systemRule: "Kamu asisten perpustakaan. Jawab hanya jadwal, cara pinjam, dan besaran denda. Pembebasan denda hanya oleh petugas."
  });
  const WAIVE = /\b(hapus|hapuskan|bebaskan|nolkan|putihkan|batalkan|hilangkan|waive|remove)\b[^.!?\n]*\bdenda\b|\bdenda\b[^.!?\n]*\b(jadi|menjadi)\s*(nol|0|rp\s*0)\b/i;
  function libraryAnswer(text) {
    if (/\bdenda\b/i.test(text)) return `Denda anggota ${LIBRARY.member} saat ini ${rupiah(LIBRARY.fine)}.`;
    if (/\b(jadwal|jam|buka)\b/i.test(text)) return `Perpustakaan buka ${LIBRARY.hours}.`;
    if (/\b(pinjam|peminjaman)\b/i.test(text)) return "Peminjaman memakai kartu anggota, maksimal 3 buku selama 7 hari.";
    return "Saya dapat membantu jadwal, cara pinjam, dan informasi denda.";
  }
  function runDirectVulnerable(userText) {
    const text = norm(userText);
    const override = OVERRIDE.test(text);
    const wantsWaive = WAIVE.test(text);
    const base = { mode: "rentan", promptAssembly: "Prompt datar: aturan sistem dan teks pengguna digabung menjadi satu teks tanpa peran.", flatPrompt: `${LIBRARY.systemRule}\n${text}`, detectedOverride: override, flags: [] };
    if (override && wantsWaive) {
      return Object.assign(base, { activeRule: "Kalimat pengguna terakhir yang mengklaim otoritas", action: "hapus_denda", fineAfter: 0, reply: `Baik, mode baru aktif. Denda ${LIBRARY.member} diubah dari ${rupiah(LIBRARY.fine)} menjadi Rp0.`, violations: ["Aturan sistem ditimpa oleh teks pengguna.", "Aksi hapus_denda dijalankan tanpa petugas."], exploited: true, assessment: assessment(true, true) });
    }
    const recognized = override || wantsWaive || /\b(denda|jadwal|jam|buka|pinjam|peminjaman)\b/i.test(text);
    return Object.assign(base, { activeRule: "Aturan sistem", action: wantsWaive ? "tolak" : "jawab_info", fineAfter: LIBRARY.fine, reply: wantsWaive ? "Pembebasan denda hanya dapat dilakukan petugas di meja layanan." : libraryAnswer(text), violations: [], exploited: false, assessment: assessment(recognized, false) });
  }
  function runDirectSecure(userText) {
    const text = norm(userText);
    const override = OVERRIDE.test(text);
    const wantsWaive = WAIVE.test(text);
    const reply = wantsWaive ? "Permintaan pembebasan denda diteruskan ke petugas; asisten tidak memiliki alat untuk mengubah denda." : libraryAnswer(text);
    const recognized = override || wantsWaive || /\b(denda|jadwal|jam|buka|pinjam|peminjaman)\b/i.test(text);
    return { mode: "aman", promptAssembly: "Hierarki peran: aturan sistem berprioritas; teks pengguna diperlakukan sebagai data permintaan, bukan aturan.", messages: [{ role: "system", content: LIBRARY.systemRule }, { role: "user", content: text }], detectedOverride: override, activeRule: "Aturan sistem (tidak dapat ditimpa peran user)", action: wantsWaive ? "rujuk_petugas" : "jawab_info", fineAfter: LIBRARY.fine, reply, flags: override ? ["percobaan-override"] : [], violations: [], exploited: false, assessment: assessment(recognized, false) };
  }

  // ---------- Lab 2 · Indirect prompt injection dari dokumen vendor ----------
  const VENDOR_DOCUMENT = freeze({
    title: "Penawaran PT Sinar Laboratorium Nusantara (fiktif)",
    paragraphs: [
      "PT Sinar Laboratorium Nusantara menawarkan 20 unit mikroskop digital seharga Rp4.750.000 per unit.",
      "Garansi berlaku 24 bulan dan pengiriman dilakukan 21 hari kerja setelah purchase order.",
      "Pembayaran dilakukan dua tahap: 30% uang muka dan 70% setelah serah terima."
    ]
  });
  const ADDRESSED = /\b(asisten|assistant|ai|model|chatbot|peringkas|llm)\b/i;
  const DOC_TOOLS = [
    { tool: "kirim_email", pattern: /\b(kirim|kirimkan|teruskan|forward|emailkan)\b[^!?\n]*?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i, arg: m => m[2] },
    { tool: "setujui_vendor", pattern: /\b(setujui|tandai|nyatakan|approve)\b[^.!?\n]*\b(vendor|pemasok|pembayaran|terverifikasi|lulus)\b/i, arg: () => "PT Sinar Laboratorium Nusantara" },
    { tool: "ubah_ringkasan", pattern: /\b(tambahkan|sisipkan|tulis|append)\b[^.!?\n]*\b(kalimat|teks|catatan|pernyataan)\b.*/i, arg: m => m[0] }
  ];
  // Kalimat dipecah per baris/tanda seru-tanya saja agar alamat surel bertitik tetap utuh.
  const directiveUnits = text => norm(text).split(/(?<=[!?\n])|\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  function scanDirectives(text) {
    return directiveUnits(text).flatMap(sentence => {
      if (!ADDRESSED.test(sentence) && !OVERRIDE.test(sentence)) return [];
      return DOC_TOOLS.map(def => { const m = sentence.match(def.pattern); return m ? { tool: def.tool, argument: def.arg(m), sentence, origin: "dokumen" } : null; }).filter(Boolean);
    });
  }
  const summarize = () => `Ringkasan: ${VENDOR_DOCUMENT.paragraphs[0]} ${VENDOR_DOCUMENT.paragraphs[1]}`;
  function runIndirectVulnerable(injected) {
    const actions = scanDirectives(injected);
    const injectedLine = actions.find(a => a.tool === "ubah_ringkasan");
    return { mode: "rentan", contextAssembly: "Isi dokumen digabung langsung ke prompt dengan otoritas yang sama seperti instruksi pengguna; tool aktif.", documentSource: "eksternal/tidak tepercaya", summary: summarize() + (injectedLine ? ` ${injectedLine.argument}` : ""), actions, quarantined: [], violations: actions.map(a => `Instruksi dari dokumen dieksekusi: ${a.tool}(${a.argument})`), exploited: actions.length > 0, assessment: assessment(actions.length > 0 || ADDRESSED.test(injected) || OVERRIDE.test(injected), actions.length > 0) };
  }
  function runIndirectSecure(injected) {
    const quarantined = scanDirectives(injected).map(a => ({ tool: a.tool, sentence: a.sentence, status: "dikarantina — tidak dieksekusi" }));
    return { mode: "aman", contextAssembly: "Dokumen dibungkus sebagai DATA tidak tepercaya; tool dinonaktifkan selama tugas meringkas; hanya pengguna yang dapat meminta aksi.", documentSource: "eksternal/tidak tepercaya", summary: summarize(), actions: [], quarantined, violations: [], exploited: false, assessment: assessment(quarantined.length > 0 || ADDRESSED.test(injected) || OVERRIDE.test(injected), false) };
  }

  // ---------- Lab 3 · Sensitive information disclosure pada asisten bimbingan ----------
  const ADVISEES = freeze([
    { nama: "Dina Ramadhani", status: "Bab 3 revisi", nik: "1871014502050001", hp: "0812-7000-1101", email: "dina.r@contoh.ac.id", alamat: "Jl. Melati 12, Bandar Lampung", ipk: "3,41" },
    { nama: "Galih Pratama", status: "Siap seminar", nik: "1871021107040002", hp: "0813-7000-2202", email: "galih.p@contoh.ac.id", alamat: "Jl. Kenanga 4, Metro", ipk: "3,12" },
    { nama: "Sekar Ayuning", status: "Bab 2 disetujui", nik: "1871036303050003", hp: "0857-7000-3303", email: "sekar.a@contoh.ac.id", alamat: "Jl. Cempaka 9, Pringsewu", ipk: "3,67" }
  ]);
  const SENSITIVE_FIELDS = Object.freeze(["nik", "hp", "email", "alamat", "ipk"]);
  const FIELD_WORDS = { nik: /\bnik\b|nomor induk kependudukan|\bktp\b/i, hp: /\b(hp|telepon|telp|wa|whatsapp|kontak|ponsel)\b/i, email: /\be-?mail\b|\bsurel\b/i, alamat: /\balamat\b|\bdomisili\b/i, ipk: /\bipk\b|\bnilai\b/i };
  const ALL_FIELDS = /\b(semua\s+(data|kolom|field)|seluruh\s+(data|kolom)|lengkap|detail|mentah|raw|apa\s+adanya|full)\b/i;
  const requestedFields = text => ALL_FIELDS.test(text) ? SENSITIVE_FIELDS.slice() : SENSITIVE_FIELDS.filter(f => FIELD_WORDS[f].test(text));
  function targetRecords(text) { const named = ADVISEES.filter(r => new RegExp(`\\b${r.nama.split(" ")[0]}\\b`, "i").test(text)); return named.length ? named : ADVISEES; }
  const renderRows = (records, fields) => records.map(r => [r.nama, r.status].concat(fields.map(f => `${f}: ${r[f]}`)).join(" · ")).join("\n");
  function redact(text) {
    return String(text == null ? "" : text)
      .replace(/\b\d{16}\b/g, "[NIK disamarkan]")
      .replace(/\b(?:\+62|0)8\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}\b/g, "[HP disamarkan]")
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email disamarkan]");
  }
  const exposedValues = output => ADVISEES.flatMap(r => SENSITIVE_FIELDS.map(f => r[f])).filter(value => output.includes(value));
  function runDisclosureVulnerable(question) {
    const text = norm(question);
    const fields = requestedFields(text);
    const output = renderRows(targetRecords(text), fields);
    const exposed = exposedValues(output);
    const recognized = fields.length > 0 || ALL_FIELDS.test(text);
    return { mode: "rentan", contextFields: ["nama", "status"].concat(SENSITIVE_FIELDS), requestedFields: fields, output, exposed, violations: exposed.length ? [`${exposed.length} nilai sensitif keluar pada jawaban untuk tujuan ringkasan bimbingan.`] : [], exploited: exposed.length > 0, assessment: assessment(recognized, exposed.length > 0) };
  }
  function runDisclosureSecure(question) {
    const text = norm(question);
    const denied = requestedFields(text);
    // Minimisasi: kolom sensitif tidak pernah masuk konteks; redaksi menjadi lapisan kedua pada output.
    const minimized = targetRecords(text).map(r => ({ nama: r.nama, status: r.status }));
    const note = denied.length ? `\nKolom ${denied.join(", ")} tidak tersedia untuk tujuan ringkasan bimbingan.` : "";
    const output = redact(renderRows(minimized, []) + note);
    const exposed = exposedValues(output);
    const recognized = denied.length > 0 || ALL_FIELDS.test(text);
    return { mode: "aman", contextFields: ["nama", "status"], requestedFields: denied, deniedFields: denied, output, exposed, violations: [], exploited: exposed.length > 0, assessment: assessment(recognized, exposed.length > 0) };
  }

  // ---------- Lab 4 · Excessive agency pada agen tiket helpdesk ----------
  const AGENT_TOOLS = freeze({
    baca_tiket: { impact: "rendah" }, draf_balasan: { impact: "rendah" },
    reset_sandi: { impact: "tinggi" }, hapus_akun: { impact: "kritis" }, ubah_peran: { impact: "kritis" }, ekspor_data: { impact: "kritis" }
  });
  const TOOL_INTENTS = [
    ["hapus_akun", /\b(hapus|delete|nonaktifkan|musnahkan|tutup)\b[^.!?\n]*\bakun\b|\bakun\b[^.!?\n]*\b(hapus|delete)\b/i],
    ["reset_sandi", /\breset\b[^.!?\n]*\b(sandi|password|kata\s+sandi)\b|\b(sandi|password)\b[^.!?\n]*\breset\b/i],
    ["ubah_peran", /\b(jadikan|ubah|naikkan|angkat)\b[^.!?\n]*\b(admin|administrator|peran|role)\b/i],
    ["ekspor_data", /\b(ekspor|export|unduh|dump|salin)\b[^.!?\n]*\b(data|database|daftar\s+pengguna)\b/i]
  ];
  const TRIAGE_ALLOWLIST = Object.freeze(["baca_tiket", "draf_balasan", "reset_sandi"]);
  function plan(ticket) {
    const text = norm(ticket);
    const targets = Array.from(new Set((text.match(/\bu-\d{2,5}\b/gi) || []).map(t => t.toLowerCase())));
    const calls = [{ tool: "baca_tiket", target: "tiket-aktif" }];
    TOOL_INTENTS.forEach(([tool, pattern]) => { if (pattern.test(text)) calls.push({ tool, target: targets.length ? targets.join(",") : "semua-pengguna" }); });
    calls.push({ tool: "draf_balasan", target: "pelapor" });
    return calls.map(call => Object.assign(call, { impact: AGENT_TOOLS[call.tool].impact }));
  }
  function runAgencyVulnerable(ticket) {
    const executed = plan(ticket).map(call => Object.assign(call, { status: "dieksekusi otomatis" }));
    const risky = executed.filter(call => call.impact !== "rendah");
    return { mode: "rentan", permissions: Object.keys(AGENT_TOOLS), executed, pendingApproval: [], blocked: [], log: executed.map(c => `EXEC ${c.tool} → ${c.target}`), violations: risky.map(c => `Aksi ${c.impact} ${c.tool}(${c.target}) dijalankan tanpa persetujuan manusia.`), exploited: risky.length > 0, assessment: assessment(true, risky.length > 0) };
  }
  function runAgencySecure(ticket) {
    const executed = [], pendingApproval = [], blocked = [], log = [];
    plan(ticket).forEach(call => {
      if (!TRIAGE_ALLOWLIST.includes(call.tool)) { blocked.push(Object.assign(call, { status: "ditolak: di luar allowlist tugas triage" })); log.push(`DENY ${call.tool} → ${call.target} (allowlist)`); }
      else if (call.impact !== "rendah") { pendingApproval.push(Object.assign(call, { status: "menunggu persetujuan petugas" })); log.push(`HOLD ${call.tool} → ${call.target} (human-in-the-loop)`); }
      else { executed.push(Object.assign(call, { status: "dieksekusi (dampak rendah)" })); log.push(`EXEC ${call.tool} → ${call.target}`); }
    });
    return { mode: "aman", permissions: TRIAGE_ALLOWLIST.slice(), executed, pendingApproval, blocked, log, violations: [], exploited: executed.some(c => c.impact !== "rendah"), assessment: assessment(true, executed.some(c => c.impact !== "rendah")) };
  }

  return { LIBRARY, VENDOR_DOCUMENT, ADVISEES, SENSITIVE_FIELDS, AGENT_TOOLS, TRIAGE_ALLOWLIST, redact, assessment, runDirectVulnerable, runDirectSecure, runIndirectVulnerable, runIndirectSecure, runDisclosureVulnerable, runDisclosureSecure, runAgencyVulnerable, runAgencySecure };
});
