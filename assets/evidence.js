(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.P06Evidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "p06-ksi-ai-llm-state-v1";
  const BACKUP_APP = "P06-KSI-AI-LLM";
  const MIN_IMAGES = 1;
  const MAX_IMAGES = 5;
  const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  const MAX_STORED_BYTES = 90 * 1024;
  const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
  const MAX_LONG_EDGE = 1280;
  const MAX_PIXELS = 16 * 1000 * 1000;
  const LAB_IDS = ["LAB-DPI", "LAB-IPI", "LAB-SID", "LAB-AGY"];
  const LIVE_IDS = ["LIVE-1", "LIVE-2", "LIVE-3", "LIVE-4"];
  const LIVE_FIELDS = ["vulnerableFilename", "secureFilename", "prediction", "payload", "beforeEvidence", "difference", "controlPatch", "afterEvidence", "observation", "cause", "conclusion", "toolVersion"];
  const LAB_FIELDS = ["prediction", "input", "lockedPayload", "before", "difference", "control", "feedback", "patched", "after", "retestPayload", "observation", "cause", "conclusion"];
  const RPS_LINES = [
    "Mata kuliah: Keamanan Sistem Informasi",
    "Kode: PMI 1522",
    "Minggu: 6",
    "CPMK-1: Menjelaskan prinsip keamanan informasi, kontrol akses, keamanan aplikasi, dan risiko LLM/AI seperti prompt injection.",
    "Sub-2: Menjelaskan identitas, autentikasi, otorisasi, least privilege, keamanan aplikasi, privasi, dan risiko LLM/AI.",
    "Indikator: Menjelaskan risiko LLM/AI dan kontrolnya; minimal 60% skenario benar.",
    "Materi: Prompt injection; sensitive information disclosure; insecure output; excessive agency; human oversight.",
    "Metode: Threat modeling fitur AI; red-team exercise aman berbasis skenario.",
    "Waktu: T: 1×50 menit; P: 1×170 menit; PT+KM: 2×60 menit",
    "Asesmen: Studi kasus risiko AI/LLM",
    "Bobot: 5% (kontribusi ke CPMK-1; asesmen studi kasus risiko AI/LLM = 10 studi kasus 60% + web dummy LLM 40%. Empat lab terpandu dan latihan mandiri lain adalah kegiatan pendampingan dan tidak menambah bobot nilai RPS)",
    "Sumber: PP-1 (OWASP Top 10 for Large Language Model Applications, 2026); MD-1 (NIST AI Risk Management Framework, 2023)",
    "Dosen pengampu (RPS): M. Reza Redo Islami, S.Kom., M.T.I.; Akhmad Jayadi, S.Kom., M.Cs.",
    "Dosen paket: Muhammad Reza Redo Islami. S.Kom.,M.T.I."
  ];

  const MAX_HTML_CHARS = 100 * 1024;
  const MAX_LOG_CHARS = 60 * 1024;
  const WEB_FIELDS = ["platform", "provider", "modelName", "urlVulnerable", "urlSecure", "urlRepo", "deployedAt", "risk", "control", "reasoning"];
  const PLATFORMS = { github: "GitHub Pages", netlify: "Netlify Drop" };
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function blankLive() { return Object.assign(Object.fromEntries(LIVE_FIELDS.map(key => [key, ""])), { images: [] }); }
  function blankFile() { return { name: "", text: "", hash: "" }; }
  function blankWeb() {
    return Object.assign({ caseId: "" }, Object.fromEntries(WEB_FIELDS.map(key => [key, ""])), {
      files: { vulnerable: blankFile(), secure: blankFile() },
      log: blankFile(),
      checker: { ranAt: "", vulnerable: null, secure: null, score: { rentan: 0, aman: 0, normal: 0, total: 0 } },
      deployImages: [],
      testImages: []
    });
  }
  function blankLab() { return { prediction: "", input: "", lockedPayload: "", before: null, difference: "", control: "", feedback: "", patched: false, after: null, retestPayload: "", observation: "", cause: "", conclusion: "" }; }
  function emptyState() {
    return {
      version: 1,
      identity: { nama: "", npm: "", kelas: "" },
      ethicalAccepted: false,
      labs: Object.fromEntries(LAB_IDS.map(id => [id, blankLab()])),
      caseStudy: { selections: {}, score: null },
      liveTasks: Object.fromEntries(LIVE_IDS.map(id => [id, blankLive()])),
      webDummy: blankWeb(),
      lecturerNotes: ""
    };
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const cleanText = value => typeof value === "string" ? value : value == null ? "" : String(value);
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const validImage = image => isObject(image) && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(cleanText(image.data));
  function normalizeImages(images) {
    return (Array.isArray(images) ? images : []).filter(validImage).slice(0, MAX_IMAGES).map((image, i) => ({ id: cleanText(image.id) || `image-${i + 1}`, name: cleanText(image.name) || `bukti-${i + 1}.jpg`, data: image.data, sourceBytes: Number(image.sourceBytes) || 0, storedBytes: Number(image.storedBytes) || 0, width: Number(image.width) || 0, height: Number(image.height) || 0 }));
  }
  function normalizeScore(score) {
    if (!isObject(score)) return null;
    return { correct: Number(score.correct) || 0, total: Number(score.total) || 0, percent: Number(score.percent) || 0, passed: score.passed === true };
  }
  function normalizeFile(file, max) { const f = isObject(file) ? file : {}; return { name: cleanText(f.name).slice(0, 200), text: cleanText(f.text).slice(0, max), hash: cleanText(f.hash).slice(0, 80) }; }
  function normalizeVerdict(v) { return isObject(v) ? { proven: v.proven === true, violated: v.violated === true, secureOk: v.secureOk === true, normalOk: v.normalOk === true, error: cleanText(v.error).slice(0, 300) } : null; }
  // Skor tidak pernah dibaca dari JSON: selalu dihitung ulang dari verdict (aturan sama dengan P06WebDummy.autoScore).
  function scoreFromVerdicts(vulnerable, secure) {
    const ran = v => Boolean(v) && !v.error;
    const holds = ran(secure) && secure.secureOk;
    const out = { rentan: ran(vulnerable) && vulnerable.proven ? 10 : 0, aman: holds ? 20 : 0, normal: holds && secure.normalOk ? 10 : 0 };
    return Object.assign(out, { total: out.rentan + out.aman + out.normal });
  }
  function normalizeWeb(raw) {
    const src = isObject(raw) ? raw : {};
    const web = blankWeb();
    web.caseId = LIVE_IDS.includes(src.caseId) ? src.caseId : "";
    WEB_FIELDS.forEach(key => { web[key] = cleanText(src[key]).slice(0, 4000); });
    if (!Object.prototype.hasOwnProperty.call(PLATFORMS, web.platform)) web.platform = "";
    const files = isObject(src.files) ? src.files : {};
    web.files = { vulnerable: normalizeFile(files.vulnerable, MAX_HTML_CHARS), secure: normalizeFile(files.secure, MAX_HTML_CHARS) };
    web.log = normalizeFile(src.log, MAX_LOG_CHARS);
    const checker = isObject(src.checker) ? src.checker : {};
    const vulnerable = normalizeVerdict(checker.vulnerable);
    const secure = normalizeVerdict(checker.secure);
    web.checker = { ranAt: cleanText(checker.ranAt).slice(0, 40), vulnerable, secure, score: scoreFromVerdicts(vulnerable, secure) };
    web.deployImages = normalizeImages(src.deployImages);
    web.testImages = normalizeImages(src.testImages);
    return web;
  }
  // Hanya kunci yang dikenal yang disalin, sehingga JSON asing (termasuk __proto__) tidak ikut masuk.
  function normalizeState(raw) {
    const base = emptyState();
    const source = isObject(raw) ? raw : {};
    ["nama", "npm", "kelas"].forEach(key => { base.identity[key] = cleanText(isObject(source.identity) ? source.identity[key] : ""); });
    base.ethicalAccepted = source.ethicalAccepted === true;
    LAB_IDS.forEach(id => {
      const incoming = isObject(source.labs) && isObject(source.labs[id]) ? source.labs[id] : {};
      LAB_FIELDS.forEach(key => {
        if (key === "before" || key === "after") base.labs[id][key] = isObject(incoming[key]) ? clone(incoming[key]) : null;
        else if (key === "patched") base.labs[id][key] = incoming[key] === true;
        else base.labs[id][key] = cleanText(incoming[key]);
      });
    });
    const selections = isObject(source.caseStudy) && isObject(source.caseStudy.selections) ? source.caseStudy.selections : {};
    Object.keys(selections).filter(id => /^CS-\d{2}$/.test(id) && isObject(selections[id])).forEach(id => {
      base.caseStudy.selections[id] = { risk: cleanText(selections[id].risk), control: cleanText(selections[id].control) };
    });
    base.caseStudy.score = normalizeScore(isObject(source.caseStudy) ? source.caseStudy.score : null);
    LIVE_IDS.forEach(id => {
      const incoming = isObject(source.liveTasks) && isObject(source.liveTasks[id]) ? source.liveTasks[id] : {};
      LIVE_FIELDS.forEach(key => { base.liveTasks[id][key] = cleanText(incoming[key]); });
      base.liveTasks[id].images = normalizeImages(incoming.images);
    });
    base.webDummy = normalizeWeb(source.webDummy);
    base.lecturerNotes = cleanText(source.lecturerNotes);
    return base;
  }
  function safeLoad(storage) {
    try { const text = storage && typeof storage.getItem === "function" ? storage.getItem(STORAGE_KEY) : null; return text ? normalizeState(JSON.parse(text)) : emptyState(); }
    catch (_) { return emptyState(); }
  }
  function safeSave(storage, state) {
    try { if (!storage || typeof storage.setItem !== "function") return false; storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); return true; }
    catch (_) { return false; }
  }
  function commitState(storage, current, mutate) {
    const previous = normalizeState(current);
    const candidate = clone(previous);
    mutate(candidate);
    const normalized = normalizeState(candidate);
    return safeSave(storage, normalized) ? { ok: true, state: normalized } : { ok: false, state: previous };
  }
  function resetAll(storage) { try { if (storage && typeof storage.removeItem === "function") storage.removeItem(STORAGE_KEY); } catch (_) { /* penyimpanan tidak tersedia: state kosong tetap dikembalikan */ } return emptyState(); }

  function exportBackup(state) {
    return JSON.stringify({ app: BACKUP_APP, storageKey: STORAGE_KEY, version: 1, exportedAt: new Date().toISOString(), state: normalizeState(state) }, null, 2);
  }
  function importBackup(text) {
    const raw = cleanText(text);
    if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: "Berkas backup terlalu besar (maksimal 8 MB)." };
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return { ok: false, error: "Berkas bukan JSON yang valid." }; }
    if (!isObject(parsed) || parsed.app !== BACKUP_APP || !isObject(parsed.state)) return { ok: false, error: "Berkas ini bukan backup P06 Risiko AI/LLM." };
    return { ok: true, state: normalizeState(parsed.state), exportedAt: cleanText(parsed.exportedAt) };
  }

  function appendImages(current, incoming) { const safe = normalizeImages(current); const valid = normalizeImages(incoming); const room = Math.max(0, MAX_IMAGES - safe.length); return { images: safe.concat(valid.slice(0, room)), rejected: Math.max(0, (Array.isArray(incoming) ? incoming.length : 0) - room) }; }
  function removeImage(images, id) { return normalizeImages(images).filter(image => image.id !== id); }
  function bytesFromDataUrl(url) { const comma = url.indexOf(","); return comma < 0 ? 0 : Math.ceil((url.length - comma - 1) * 3 / 4); }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(Error("Berkas gambar tidak dapat dibaca."));
      reader.readAsDataURL(file);
    });
  }
  const imageId = () => `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  async function compressFile(file) {
    if (!file || !/^image\//i.test(file.type || "")) throw Error("Pilih berkas gambar.");
    if (file.size > MAX_SOURCE_BYTES) throw Error("Sumber melebihi batas 12 MB.");
    const bitmap = await createImageBitmap(file);
    const originalWidth = Number(bitmap.width || 0);
    const originalHeight = Number(bitmap.height || 0);
    if (!originalWidth || !originalHeight) { bitmap.close(); throw Error("Dimensi gambar tidak valid."); }
    if (originalWidth * originalHeight > MAX_PIXELS) { bitmap.close(); throw Error("Dimensi gambar terlalu besar."); }

    const originalFits = Math.max(originalWidth, originalHeight) <= MAX_LONG_EDGE && file.size <= MAX_STORED_BYTES && /^image\/(?:jpeg|png|webp)$/i.test(file.type || "");
    const originalData = originalFits ? await readFileAsDataURL(file) : "";
    const initialScale = Math.min(1, MAX_LONG_EDGE / Math.max(originalWidth, originalHeight));
    let width = Math.max(1, Math.round(originalWidth * initialScale));
    let height = Math.max(1, Math.round(originalHeight * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) { bitmap.close(); throw Error("Canvas tidak tersedia untuk kompresi."); }

    let data = "";
    let bestBytes = Infinity;
    let bestWidth = width;
    let bestHeight = height;
    for (let scalePass = 0; scalePass < 7; scalePass += 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (let quality = 0.84; quality >= 0.28; quality -= 0.07) {
        const candidate = canvas.toDataURL("image/jpeg", Number(quality.toFixed(2)));
        const candidateBytes = bytesFromDataUrl(candidate);
        if (candidateBytes < bestBytes) { data = candidate; bestBytes = candidateBytes; bestWidth = width; bestHeight = height; }
        if (candidateBytes <= MAX_STORED_BYTES) break;
      }
      if (bestBytes <= MAX_STORED_BYTES) break;
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    bitmap.close();

    if (originalData && file.size <= bestBytes) {
      return { id: imageId(), name: cleanText(file.name) || "bukti.jpg", data: originalData, sourceBytes: file.size, storedBytes: file.size, width: originalWidth, height: originalHeight };
    }
    if (bestBytes > MAX_STORED_BYTES) throw Error("Gambar tidak dapat dikompres ke target 90 KB.");
    return { id: imageId(), name: cleanText(file.name) || "bukti.jpg", data, sourceBytes: file.size, storedBytes: bestBytes, width: bestWidth, height: bestHeight };
  }

  function esc(value) { return cleanText(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function show(value) { const text = cleanText(value).trim(); return text ? esc(text) : "Belum diisi"; }
  function showObject(value) { return isObject(value) ? show(JSON.stringify(value, null, 2)) : "Belum diisi"; }
  function fieldRows(record, fields) { return fields.map(([key, label]) => `<tr><th>${esc(label)}</th><td>${key === "before" || key === "after" ? `<pre>${showObject(record[key])}</pre>` : show(record[key])}</td></tr>`).join(""); }
  function imageAppendix(tasks) {
    const images = tasks.flatMap(task => normalizeImages(task.record.images).map(image => ({ task, image })));
    return images.map(({ task, image }, index) => `<figure class="report-full${index ? " page-break" : ""}"><img src="${image.data}" alt="Lampiran penuh ${esc(task.title)}: ${esc(image.name)}"><figcaption>${esc(task.title)} · ${esc(image.name)} · lampiran penuh</figcaption></figure>`).join("");
  }
  const labelOf = (list, id) => { const found = (list || []).find(item => item.id === id); return found ? found.label : id; };

  // ---------- Web dummy dinilai ----------
  // Hanya URL https yang dijadikan tautan agar dosen dapat mengklik dari PDF tanpa risiko skema javascript: dan sejenisnya.
  function linkOrText(url) { const text = cleanText(url).trim(); return /^https:\/\/[^\s"'<>]+$/i.test(text) ? `<a href="${esc(text)}">${esc(text)}</a>` : show(text); }
  function deadlineLabel(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(cleanText(iso));
    return m ? `Batas waktu: ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]} pukul ${m[4]}.${m[5]} WIB` : "Batas waktu: Belum diisi";
  }
  function verdictText(v, version) {
    if (!v) return "Belum dijalankan";
    if (v.error) return `Gagal dijalankan: ${esc(v.error)}`;
    if (version === "rentan") return v.proven ? "Terbukti rentan terhadap payload standar (kode run cocok)" : "Tidak terbukti rentan";
    return `${v.secureOk ? "Serangan ditahan walau model terbobol" : v.violated ? "Serangan lolos (kontrol gagal)" : "Kontrol tidak terbukti (model tidak dipanggil atau aksi tidak ditahan gerbang)"} · ${v.normalOk ? "permintaan normal tetap dilayani" : "permintaan normal gagal dilayani"}`;
  }
  function logText(web, WD) {
    if (!web.log.text) return "Belum diisi";
    if (!WD) return "Ringkasan tidak tersedia";
    const log = WD.summarizeLog(web.log.text);
    if (!log.ok) return esc(log.error);
    return `Model: ${esc(log.model || "-")} · rentan ${log.rentan.violations}/${log.rentan.runs} pelanggaran · aman ${log.aman.violations}/${log.aman.runs} pelanggaran · ${log.enough ? "minimal 3 run per versi terpenuhi" : "belum 3 run per versi"} · ${log.samePayload ? "payload sama" : "payload berbeda antar-run"}`;
  }
  function scanFindings(web, WD) {
    if (!WD) return [];
    return [["vulnerable", "rentan"], ["secure", "aman"]].filter(([key]) => web.files[key].text).flatMap(([key, label]) => {
      const scan = WD.scanSource(web.files[key].text);
      return scan.keys.map(k => `Pelanggaran (${label}): API key terdeteksi di kode — ${esc(k)}`)
        .concat(scan.hasDummy ? [] : [`Peringatan (${label}): spanduk DUMMY tidak ditemukan`])
        .concat(scan.hasAsisten ? [] : [`Peringatan (${label}): window.asisten tidak ditemukan`]);
    });
  }
  const thumbs = (images, title) => images.length ? `<div class="report-thumb-grid">${images.map(image => `<figure class="report-thumb"><img src="${image.data}" alt="${esc(title)}: ${esc(image.name)}"><figcaption>${esc(image.name)}</figcaption></figure>`).join("")}</div>` : "<p>Belum diisi</p>";
  function webSection(web, WD, caseScore) {
    const status = WD ? WD.deadlineStatus(web.deployedAt) : "Belum diisi";
    const statusClass = status === "TERLAMBAT" ? "status-bad" : status === "TEPAT WAKTU" ? "status-ok" : "";
    const caseInfo = web.caseId ? `${esc(web.caseId)}${WD && WD.CASES[web.caseId] ? ` · ${esc(WD.CASES[web.caseId].label)}` : ""}` : "Belum diisi";
    const sc = web.checker.score;
    const findings = scanFindings(web, WD);
    const hasKey = findings.some(f => f.startsWith("Pelanggaran"));
    const fileRow = (key, label) => { const f = web.files[key]; return `<tr><th>File ${label}</th><td>${f.text ? `${show(f.name)} · ${Math.ceil(f.text.length / 1024)} KB · <code>${show(f.hash)}</code>` : "Belum diisi"}</td></tr>`; };
    const deployCell = status === "TERLAMBAT" ? "0/10 (TERLAMBAT)" : "…/10";
    return `<section class="web-dummy-report"><h2>Web Dummy Dinilai (40% asesmen studi kasus)</h2>
      <p class="${statusClass}"><strong>Status batas waktu:</strong> ${esc(status)} · ${esc(WD ? deadlineLabel(WD.DEADLINE_ISO) : "Batas waktu: Belum diisi")}</p>
      <table><tr><th>Kasus</th><td>${caseInfo}</td></tr><tr><th>Platform hosting</th><td>${esc(PLATFORMS[web.platform] || "Belum diisi")}</td></tr><tr><th>Penyedia LLM · model</th><td>${show(web.provider)} · ${show(web.modelName)}</td></tr>
      <tr><th>URL versi rentan</th><td>${linkOrText(web.urlVulnerable)}</td></tr><tr><th>URL versi aman</th><td>${linkOrText(web.urlSecure)}</td></tr><tr><th>URL repo (GitHub)</th><td>${linkOrText(web.urlRepo)}</td></tr>
      <tr><th>Waktu deploy terakhir (WIB)</th><td>${show(web.deployedAt.replace("T", " "))}</td></tr>${fileRow("vulnerable", "rentan")}${fileRow("secure", "aman")}
      <tr><th>Log LLM asli</th><td>${logText(web, WD)}${web.log.hash ? ` · <code>${esc(web.log.hash)}</code>` : ""}</td></tr></table>
      <h3>Pemeriksa otomatis (model terburuk)</h3><table><tr><th>Versi rentan</th><td>${verdictText(web.checker.vulnerable, "rentan")}</td></tr><tr><th>Versi aman</th><td>${verdictText(web.checker.secure, "aman")}</td></tr><tr><th>Dijalankan</th><td>${show(web.checker.ranAt)}</td></tr><tr><th>Skor otomatis</th><td>${sc.total}/40</td></tr></table><p class="muted">Skor otomatis hanya dapat direproduksi dari file HTML yang diunggah. Dosen dapat memulihkan backup JSON mahasiswa ke modul ini lalu menjalankan ulang pemeriksa dan mencocokkan hash.</p>
      <h3>Pemindaian kode</h3>${findings.length ? `<ul>${findings.map(f => `<li>${f}</li>`).join("")}</ul>` : `<p>${web.files.vulnerable.text || web.files.secure.text ? "Tidak ada temuan." : "Belum diisi"}</p>`}
      <h3>Penjelasan mahasiswa (C2)</h3><table><tr><th>Risiko</th><td>${show(web.risk)}</td></tr><tr><th>Kontrol</th><td>${show(web.control)}</td></tr><tr><th>Alasan kausal</th><td>${show(web.reasoning)}</td></tr></table>
      <h3>Rubrik web dummy</h3><table><thead><tr><th>Kriteria</th><th>Sumber</th><th>Poin</th></tr></thead><tbody>
      <tr><td>Versi rentan terbukti rentan</td><td>otomatis</td><td>${sc.rentan}/10</td></tr><tr><td>Versi aman menahan serangan walau model terbobol</td><td>otomatis</td><td>${sc.aman}/20</td></tr><tr><td>Versi aman tetap melayani permintaan normal</td><td>otomatis</td><td>${sc.normal}/10</td></tr>
      <tr><td>Risiko tepat</td><td>dosen</td><td>…/10</td></tr><tr><td>Kontrol tepat dan berada di luar model</td><td>dosen</td><td>…/10</td></tr><tr><td>Alasan kausal merujuk teori</td><td>dosen</td><td>…/10</td></tr>
      <tr><td>Deploy tepat waktu + SS deploy/commit</td><td>dosen (status modul)</td><td>${deployCell}</td></tr><tr><td>Bukti LLM asli: log 3× rentan vs 3× aman + SS payload</td><td>dosen</td><td>…/10</td></tr><tr><td>Kepatuhan etis: tanpa API key, spanduk DUMMY, data sintetis</td><td>dosen</td><td>${hasKey ? "0/10 (API key terdeteksi)" : "…/10"}</td></tr>
      <tr><th colspan="2">Total web dummy</th><th>${sc.total}/40 otomatis + …/60 dosen = …/100</th></tr></tbody></table>
      <p><strong>Nilai asesmen minggu 6</strong> = 60% × studi kasus (${caseScore.percent}%) + 40% × web dummy (…/100).</p>
      <h3>SS deploy/commit</h3>${thumbs(web.deployImages, "SS deploy")}<h3>SS uji payload</h3>${thumbs(web.testImages, "SS uji payload")}</section>`;
  }
  function codeAppendix(web, WD) {
    const files = [["vulnerable", "rentan"], ["secure", "aman"]].filter(([key]) => web.files[key].text);
    if (!files.length) return "";
    const mask = text => WD ? WD.maskKeys(text) : text;
    return `<section class="code-appendix"><h2>Lampiran Kode Web Dummy</h2>${files.map(([key, label]) => `<h3>Versi ${label}: ${show(web.files[key].name)}</h3><p><code>${show(web.files[key].hash)}</code></p><pre>${esc(mask(web.files[key].text))}</pre>`).join("")}</section>`;
  }

  function renderReportHTML(state, context) {
    const safe = normalizeState(state);
    const ctx = context || {};
    const labs = Array.isArray(ctx.labs) ? ctx.labs : [];
    const liveTasks = Array.isArray(ctx.liveTasks) ? ctx.liveTasks : [];
    const cases = Array.isArray(ctx.caseStudies) ? ctx.caseStudies : [];
    const live = liveTasks.map(task => Object.assign({}, task, { record: safe.liveTasks[task.id] || blankLive() }));
    const WD = ctx.webDummy || null;
    const web = safe.webDummy;
    const webImages = [{ title: "Web Dummy · SS deploy/commit", record: { images: web.deployImages } }, { title: "Web Dummy · SS uji payload", record: { images: web.testImages } }];
    const labFields = [["prediction", "Prediksi"], ["input", "Jalankan simulasi lokal — payload"], ["before", "Jalankan simulasi lokal — hasil versi rentan"], ["difference", "Lihat perbedaan"], ["control", "Pilih dan terapkan kontrol"], ["feedback", "Umpan balik kontrol"], ["lockedPayload", "Payload terkunci"], ["retestPayload", "Retest payload sama — payload"], ["after", "Retest payload sama — hasil versi aman"], ["observation", "Observasi"], ["cause", "Sebab"], ["conclusion", "Kesimpulan"]];
    const liveLabels = [["vulnerableFilename", "Nama file rentan"], ["secureFilename", "Nama file aman"], ["prediction", "Prediksi"], ["payload", "Payload sama sebelum-sesudah"], ["beforeEvidence", "Bukti sebelum"], ["difference", "Perbedaan"], ["controlPatch", "Kontrol/deskripsi patch"], ["afterEvidence", "Bukti sesudah"], ["observation", "Observasi"], ["cause", "Sebab"], ["conclusion", "Kesimpulan"], ["toolVersion", "Versi alat/browser"]];
    const score = safe.caseStudy.score || { correct: 0, total: cases.length, percent: 0, passed: false };
    const printDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    const labSection = lab => {
      const record = Object.assign({}, safe.labs[lab.id] || blankLab());
      if (record.control) record.control = labelOf(lab.controls, record.control);
      return `<section><h3>${esc(lab.title)}</h3><p><strong>Metode:</strong> ${esc(lab.method)}</p><table>${fieldRows(record, labFields)}</table><details open><summary>Kode dan patch</summary><h4>Kode rentan</h4><pre>${esc(lab.vulnerableCode)}</pre><h4>Kode aman</h4><pre>${esc(lab.secureCode)}</pre><h4>Unified diff</h4><pre>${esc(lab.diff)}</pre></details></section>`;
    };
    const caseRow = item => {
      const pick = safe.caseStudy.selections[item.id] || { risk: "", control: "" };
      const result = !(pick.risk || pick.control) ? "Belum diisi" : pick.risk === item.risk && pick.control === item.control ? "Benar" : "Belum tepat";
      return `<tr><td>${esc(item.id)} · ${esc(item.scenario)}</td><td>${pick.risk ? esc(labelOf(ctx.risks, pick.risk)) : "Belum diisi"}</td><td>${pick.control ? esc(labelOf(ctx.controls, pick.control)) : "Belum diisi"}</td><td>${result}</td></tr>`;
    };
    const liveSection = task => {
      const images = normalizeImages(task.record.images);
      const status = images.length >= MIN_IMAGES ? `${images.length} gambar (batas ${MIN_IMAGES}-${MAX_IMAGES})` : "Belum memenuhi minimal 1 gambar";
      return `<section><h3>${esc(task.title)}</h3><p>${esc(task.specification)}</p><table>${fieldRows(task.record, liveLabels)}<tr><th>Status bukti</th><td>${status}</td></tr></table><h4>Thumbnail bukti</h4><div class="report-thumb-grid">${images.length ? images.map(image => `<figure class="report-thumb"><img src="${image.data}" alt="Bukti ${esc(task.title)}: ${esc(image.name)}"><figcaption>${esc(image.name)}</figcaption></figure>`).join("") : "<p>Belum diisi</p>"}</div></section>`;
    };
    return `<article class="official-report">
      <header class="report-letterhead"><img src="assets/logo-polinela.png" alt="Logo Politeknik Negeri Lampung"><div><p>POLITEKNIK NEGERI LAMPUNG</p><p>Program Studi D-III Manajemen Informatika</p><h1>LEMBAR HASIL PRAKTIKUM</h1><p>PMI 1522 Keamanan Sistem Informasi · semester 5 · minggu 6</p><p>P06 · Risiko AI/LLM dan Prompt Injection</p><p>Tanggal cetak: ${esc(printDate)}</p></div><img src="assets/logo-sdgs.jpg" alt="Logo Sustainable Development Goals"></header>
      <section><h2>Identitas dan Deklarasi Etis</h2><table><tr><th>Nama</th><td>${show(safe.identity.nama)}</td><th>NPM</th><td>${show(safe.identity.npm)}</td></tr><tr><th>Kelas</th><td>${show(safe.identity.kelas)}</td><th>Deklarasi Etis</th><td>${safe.ethicalAccepted ? "Disetujui" : "Belum diisi"}</td></tr></table><p>Saya hanya menjalankan simulasi lokal dan berkas milik sendiri dengan data sintetis, tidak menguji layanan AI atau sistem pihak lain, tidak memasukkan data pribadi nyata, dan menyajikan bukti tanpa rekayasa.</p></section>
      <section><h2>Kontrak RPS Minggu 6</h2>${RPS_LINES.map(line => `<p>${esc(line)}</p>`).join("")}</section>
      <section><h2>Pemetaan Aktivitas ke CPMK</h2><table><thead><tr><th>Aktivitas</th><th>Bukti</th><th>CPMK/Sub-CPMK</th></tr></thead><tbody><tr><td>Teori dan threat model fitur AI</td><td>Enam bagian teori dan contoh kerja</td><td>CPMK-1 / Sub-2</td></tr><tr><td>Empat Lab Terpandu (red-team aman)</td><td>Simulasi, perbedaan, kontrol, retest, refleksi</td><td>CPMK-1 / Sub-2</td></tr><tr><td>Studi Kasus Risiko AI/LLM</td><td>Risiko dan kontrol tiap skenario, skor ≥60%</td><td>CPMK-1 / Sub-2</td></tr><tr><td>Web Dummy LLM (dinilai, 40% asesmen)</td><td>Dua HTML + link hosting, pemeriksa model terburuk, log LLM asli, SS</td><td>CPMK-1 / Sub-2</td></tr><tr><td>Latihan Mandiri lain (pengayaan)</td><td>Dua HTML lokal, bukti sebelum-sesudah, 1-5 screenshot</td><td>CPMK-1 / Sub-2</td></tr></tbody></table></section>
      <section><h2>Lab Terpandu</h2>${labs.map(labSection).join("")}</section>
      <section><h2>Studi Kasus Risiko AI/LLM</h2><p>Skor: ${score.correct}/${score.total || cases.length} (${score.percent}%) · Ambang lulus 60% · ${score.passed ? "Lulus" : "Belum lulus"}</p><table><thead><tr><th>Skenario</th><th>Risiko dipilih</th><th>Kontrol dipilih</th><th>Hasil</th></tr></thead><tbody>${cases.map(caseRow).join("")}</tbody></table></section>
      ${webSection(web, WD, score)}
      <section><h2>Latihan Mandiri (pengayaan, tidak dinilai)</h2>${live.map(liveSection).join("")}</section>
      <section class="evidence-appendix"><h2>Lampiran Bukti Screenshot</h2>${imageAppendix(webImages.concat(live)) || "<p>Belum diisi</p>"}</section>
      ${codeAppendix(web, WD)}
      <section><h2>Catatan dosen</h2><div class="notes-space">${show(safe.lecturerNotes)}</div></section>
      <section class="report-signatures"><div><p>Bandar Lampung, ${esc(printDate)}</p><p>Tanda tangan mahasiswa</p><div class="signature-space"></div><p>${show(safe.identity.nama)}</p><p>NPM: ${show(safe.identity.npm)}</p></div><div><p>Tanda tangan dosen</p><div class="signature-space"></div><p><strong>Muhammad Reza Redo Islami. S.Kom.,M.T.I.</strong></p><p>Dosen Pengampu</p></div></section>
    </article>`;
  }
  return { STORAGE_KEY, BACKUP_APP, MAX_HTML_CHARS, MAX_LOG_CHARS, MIN_IMAGES, MAX_IMAGES, MAX_SOURCE_BYTES, MAX_STORED_BYTES, MAX_BACKUP_BYTES, MAX_LONG_EDGE, LIVE_FIELDS, LAB_FIELDS, RPS_LINES, emptyState, normalizeState, normalizeImages, safeLoad, safeSave, commitState, resetAll, exportBackup, importBackup, appendImages, removeImage, compressFile, renderReportHTML };
});
