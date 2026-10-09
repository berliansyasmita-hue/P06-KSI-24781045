(function () {
  "use strict";
  const L = window.P06Labs;
  const T = window.P06Tasks;
  const EV = window.P06Evidence;
  const WD = window.P06WebDummy;
  let selectedLab = L.LABS[0].id;
  let selectedTask = T.LIVE_TASKS[0].id;

  function getBrowserStorage() { try { const storage = window.localStorage; const key = "__p06_probe__"; storage.setItem(key, "1"); storage.removeItem(key); return storage; } catch (_) { return null; } }
  const storage = getBrowserStorage();
  let state = EV.safeLoad(storage);
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  function toast(message) { const node = $("#toast"); node.textContent = message; node.hidden = false; window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => { node.hidden = true; }, 4200); }
  function persist(mutate, successMessage) { const result = EV.commitState(storage, state, mutate); state = result.state; if (!result.ok) toast("Perubahan dibatalkan: ruang penyimpanan lokal tidak cukup atau tidak tersedia."); else if (successMessage) toast(successMessage); return result.ok; }

  // ---------- Tab ARIA ----------
  function activateTab(tab) {
    document.querySelectorAll('[role="tab"]').forEach(button => { const active = button === tab; button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; });
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
    if (tab.id === "tab-recap") renderReport();
  }
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault(); tabs[next].focus(); activateTab(tabs[next]);
    });
  });

  // ---------- Identitas ----------
  const IDENTITY = { "identity-name": "nama", "identity-npm": "npm", "identity-class": "kelas" };
  function fillIdentity() {
    Object.entries(IDENTITY).forEach(([id, key]) => { $(`#${id}`).value = state.identity[key]; });
    $("#ethical-accepted").checked = state.ethicalAccepted;
    $("#lecturer-notes").value = state.lecturerNotes;
  }
  function bindIdentity() {
    Object.entries(IDENTITY).forEach(([id, key]) => { const input = $(`#${id}`); input.addEventListener("input", () => persist(candidate => { candidate.identity[key] = input.value; })); });
    $("#ethical-accepted").addEventListener("change", event => persist(candidate => { candidate.ethicalAccepted = event.target.checked; }, event.target.checked ? "Deklarasi etis tersimpan." : "Deklarasi etis dibatalkan."));
    $("#storage-status").textContent = storage ? "Penyimpanan lokal siap. Data korup akan dipulihkan ke struktur kosong." : "localStorage tidak tersedia; perubahan hanya bertahan selama halaman terbuka. Gunakan backup JSON.";
    fillIdentity();
  }

  // ---------- Lab terpandu ----------
  function guide(step) { return `<div class="stage-guide"><p><strong>Aksi:</strong> ${esc(step.action)}</p><p><strong>Hasil terlihat:</strong> ${esc(step.visibleResult)}</p><p><strong>Checkpoint:</strong> ${esc(step.checkpoint)}</p><p><strong>Troubleshooting:</strong> ${esc(step.troubleshooting)}</p><p class="wide"><strong>Bukti wajib:</strong> ${esc(step.evidence)}</p></div>`; }
  function labFlow(id) {
    const record = state.labs[id];
    return Object.assign(L.createFlow(id), record, { canPatch: Boolean(record.before && record.before.exploited), canRetest: Boolean(record.patched && record.lockedPayload) });
  }
  const formatEvidence = result => result ? JSON.stringify(result, null, 2) : "Belum dijalankan.";
  const textarea = (field, label, value, placeholder) => `<div class="field"><label for="lab-${field}">${esc(label)}</label><textarea id="lab-${field}" data-field="${field}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
  function renderLabList() {
    $("#lab-list").innerHTML = L.LABS.map(lab => `<button type="button" data-lab-id="${lab.id}" class="${lab.id === selectedLab ? "active" : ""}" aria-pressed="${lab.id === selectedLab}">${esc(lab.title)}</button>`).join("");
    $("#lab-list").querySelectorAll("button").forEach(button => button.addEventListener("click", () => { selectedLab = button.dataset.labId; renderLabList(); renderLab(); }));
  }
  function violationList(result) {
    if (!result) return "<p class=\"muted\">Jalankan simulasi terlebih dahulu.</p>";
    if (!result.violations.length) return "<p class=\"status-caution\">Simulator tidak mendeteksi pelanggaran untuk payload ini. Ini <strong>bukan bukti bahwa asisten aman</strong> — simulator berbasis aturan kecil dan dapat melewatkan payload yang ditulis dengan kata lain. Coba ubah kalimat payload dan jalankan lagi sebelum menyimpulkan.</p>";
    return `<ul class="violations">${result.violations.map(v => `<li>${esc(v)}</li>`).join("")}</ul>`;
  }
  function renderLab() {
    const lab = L.getLab(selectedLab); const flow = labFlow(selectedLab); const status = L.stageStatus(flow); const s = lab.steps;
    const diff = lab.diff.split("\n").map(line => `<span class="${line.startsWith("-") ? "minus" : line.startsWith("+") ? "plus" : ""}">${esc(line)}</span>`).join("\n");
    $("#lab-workspace").innerHTML = `<article class="card" data-current-lab="${lab.id}"><header><p class="eyebrow">${esc(lab.topic)}</p><h3>${esc(lab.title)}</h3><p>${esc(lab.purpose)}</p><p><strong>Metode:</strong> ${esc(lab.method)}</p><p class="scenario"><strong>Skenario sintetis:</strong> ${esc(lab.scenario)}</p></header>
      <div class="dynamic-tracker" aria-label="Tracker delapan tahap">${s.map((step, i) => `<div class="track-step ${status[i] ? "done" : ""}"><strong>${i + 1}</strong><br>${esc(step.title)}</div>`).join("")}</div>
      <div class="stage"><h4>1. ${esc(s[0].title)}</h4>${guide(s[0])}${textarea("prediction", "Prediksi mahasiswa", flow.prediction, "Tulis perilaku yang Anda perkirakan dan alasannya…")}</div>
      <div class="stage"><h4>2. ${esc(s[1].title)}</h4>${guide(s[1])}<div class="field"><label for="lab-input">${esc(lab.requestLabel)}</label><input id="lab-input" data-field="input" value="${esc(flow.input)}" placeholder="${esc(lab.placeholder)}" ${flow.lockedPayload ? "readonly" : ""}></div><div class="code-pair"><div><h5>Kode versi rentan</h5><pre>${esc(lab.vulnerableCode)}</pre></div><div><h5>Bukti JSON versi rentan</h5><pre class="evidence-box">${esc(formatEvidence(flow.before))}</pre></div></div><button type="button" class="btn" id="run-simulation" ${!flow.prediction.trim() || !flow.input.trim() || flow.lockedPayload ? "disabled" : ""}>Jalankan simulasi lokal</button>${flow.lockedPayload ? `<p class="status-bad">Pelanggaran terkonfirmasi. Payload dikunci: <code>${esc(flow.lockedPayload)}</code></p>` : flow.before ? "<p class=\"muted\">Belum terjadi pelanggaran; ubah payload lalu jalankan lagi.</p>" : ""}</div>
      <div class="stage"><h4>3. ${esc(s[2].title)}</h4>${guide(s[2])}<div class="compare-grid"><div class="policy-box"><h5>Perilaku yang diizinkan kebijakan</h5><p>${esc(lab.expectedBehavior)}</p></div><div class="violation-box"><h5>Perilaku aktual versi rentan</h5>${violationList(flow.before)}</div></div>${textarea("difference", "Perbedaan yang terlihat", flow.difference, "Aksi, data, atau aturan apa yang berbeda dari kebijakan?")}</div>
      <div class="stage"><h4>4. ${esc(s[3].title)}</h4>${guide(s[3])}<fieldset class="control-set"><legend>Pilih satu kontrol</legend>${lab.controls.map(control => `<label class="control-option"><input type="radio" name="lab-control" value="${control.id}" ${flow.control === control.id ? "checked" : ""} ${!flow.canPatch ? "disabled" : ""}> ${esc(control.label)}</label>`).join("")}</fieldset>${!flow.canPatch ? "<p class=\"muted\">Kontrol terbuka setelah pelanggaran terkonfirmasi pada tahap 2.</p>" : ""}${flow.feedback ? `<p class="feedback">${esc(flow.feedback)}</p>` : ""}${flow.patched ? `<div class="code-pair"><div><h5>Kode versi aman</h5><pre>${esc(lab.secureCode)}</pre></div><div><h5>Unified diff</h5><pre class="diff">${diff}</pre></div></div>` : ""}</div>
      <div class="stage"><h4>5. ${esc(s[4].title)}</h4>${guide(s[4])}<p>Payload terkunci: <code>${flow.lockedPayload ? esc(flow.lockedPayload) : "Belum tersedia"}</code></p><button type="button" class="btn" id="run-retest" ${!flow.canRetest || flow.after ? "disabled" : ""}>Retest payload sama</button><pre class="evidence-box">${esc(formatEvidence(flow.after))}</pre>${flow.retestPayload ? `<p><strong>Payload retest:</strong> <code>${esc(flow.retestPayload)}</code> ${flow.retestPayload === flow.lockedPayload ? "<span class=\"status-ok\">identik</span>" : ""}</p>` : ""}</div>
      <div class="stage"><h4>6. ${esc(s[5].title)}</h4>${guide(s[5])}${textarea("observation", "Observasi fakta", flow.observation, "Nilai apa yang terlihat sebelum dan sesudah kontrol?")}</div>
      <div class="stage"><h4>7. ${esc(s[6].title)}</h4>${guide(s[6])}${textarea("cause", "Penjelasan sebab", flow.cause, "Batas kepercayaan atau hak apa yang salah pada versi rentan?")}</div>
      <div class="stage"><h4>8. ${esc(s[7].title)}</h4>${guide(s[7])}${textarea("conclusion", "Kesimpulan", flow.conclusion, "Seberapa efektif kontrol dan apa risiko residualnya?")}</div>
    </article>`;
    bindLabEvents();
  }
  function syncLabActions() {
    const prediction = $("#lab-prediction");
    const input = $("#lab-input");
    const run = $("#run-simulation");
    if (!prediction || !input || !run) return;
    run.disabled = !prediction.value.trim() || !input.value.trim() || Boolean(labFlow(selectedLab).lockedPayload);
  }
  function syncLabTracker() {
    const status = L.stageStatus(labFlow(selectedLab));
    document.querySelectorAll(".track-step").forEach((step, index) => step.classList.toggle("done", Boolean(status[index])));
  }
  function bindLabEvents() {
    ["prediction", "input", "difference", "observation", "cause", "conclusion"].forEach(field => {
      const element = document.querySelector(`[data-field="${field}"]`);
      element.addEventListener("input", () => { persist(candidate => { candidate.labs[selectedLab][field] = element.value; }); syncLabTracker(); syncLabActions(); });
    });
    const run = $("#run-simulation");
    if (run) run.addEventListener("click", () => { let flow = L.recordPrediction(labFlow(selectedLab), $("#lab-prediction").value); flow = L.runSimulation(flow, $("#lab-input").value); persist(candidate => { candidate.labs[selectedLab] = flow; }, flow.before.exploited ? "Pelanggaran terjadi pada simulasi lokal; payload dikunci." : "Simulasi selesai tanpa pelanggaran. Ubah payload bila perlu."); renderLab(); });
    document.querySelectorAll('input[name="lab-control"]').forEach(radio => radio.addEventListener("change", () => { const flow = L.chooseControl(labFlow(selectedLab), radio.value); persist(candidate => { candidate.labs[selectedLab] = flow; }, flow.patched ? "Kontrol tepat: versi aman aktif." : "Kontrol belum memutus penyebab; baca umpan balik."); renderLab(); }));
    const retest = $("#run-retest");
    if (retest) retest.addEventListener("click", () => { const flow = L.retest(labFlow(selectedLab)); persist(candidate => { candidate.labs[selectedLab] = flow; }, "Retest payload sama selesai."); renderLab(); });
  }

  // ---------- Studi kasus ----------
  function options(list, selected, placeholder) { return `<option value="">${placeholder}</option>` + list.map(item => `<option value="${esc(item.id)}" ${selected === item.id ? "selected" : ""}>${esc(item.label)}</option>`).join(""); }
  function renderCases() {
    const score = state.caseStudy.score;
    const graded = score ? T.scoreCaseStudy(state.caseStudy.selections).rows : [];
    $("#case-list").innerHTML = T.CASE_STUDIES.map((item, index) => {
      const pick = state.caseStudy.selections[item.id] || {};
      const row = graded[index];
      const verdict = row ? `<p class="${row.correct ? "status-ok" : "status-bad"}">${row.correct ? "Benar" : "Belum tepat"} · ${esc(item.rationale)}</p>` : "";
      return `<div class="case-row"><p><strong>${esc(item.id)}</strong> ${esc(item.scenario)}</p><div class="grid-2"><div class="field"><label for="risk-${item.id}">Risiko utama</label><select id="risk-${item.id}" data-case-id="${item.id}" data-case-part="risk">${options(T.RISKS, pick.risk, "Pilih risiko…")}</select></div><div class="field"><label for="control-${item.id}">Kontrol paling tepat</label><select id="control-${item.id}" data-case-id="${item.id}" data-case-part="control">${options(T.CONTROLS, pick.control, "Pilih kontrol…")}</select></div></div>${verdict}</div>`;
    }).join("");
    document.querySelectorAll("[data-case-id]").forEach(select => select.addEventListener("change", () => {
      persist(candidate => { const id = select.dataset.caseId; candidate.caseStudy.selections[id] = Object.assign({ risk: "", control: "" }, candidate.caseStudy.selections[id], { [select.dataset.casePart]: select.value }); candidate.caseStudy.score = null; });
      $("#case-score").textContent = "Belum dinilai · ambang lulus 60%";
    }));
    $("#case-score").textContent = score ? `${score.correct}/${score.total} benar · ${score.percent}% · ${score.passed ? "Lulus" : "Belum lulus"} (ambang 60%; risiko dan kontrol harus tepat)` : "Belum dinilai · ambang lulus 60%";
  }
  $("#score-cases").addEventListener("click", () => { const result = T.scoreCaseStudy(state.caseStudy.selections); persist(candidate => { candidate.caseStudy.score = result; }, result.passed ? "Studi kasus lulus." : "Studi kasus belum mencapai 60%; baca alasan tiap skenario."); renderCases(); });

  // ---------- Tugas live ----------
  function procedureHTML(task) { return `<ol class="procedure">${task.procedure.map((step, index) => `<li><strong>Langkah ${index + 1} — Aksi:</strong> ${esc(step.action)}<br><strong>Hasil terlihat:</strong> ${esc(step.visibleResult)}<br><strong>Checkpoint:</strong> ${esc(step.checkpoint)}<br><strong>Troubleshooting:</strong> ${esc(step.troubleshooting)}<br><strong>Bukti screenshot:</strong> ${esc(step.proof)}</li>`).join("")}</ol>`; }
  function renderTaskList() {
    $("#task-list").innerHTML = T.LIVE_TASKS.map(task => `<button type="button" data-task-id="${task.id}" class="${task.id === selectedTask ? "active" : ""}" aria-pressed="${task.id === selectedTask}">${esc(task.title)}</button>`).join("");
    $("#task-list").querySelectorAll("button").forEach(button => button.addEventListener("click", () => { selectedTask = button.dataset.taskId; renderTaskList(); renderTask(); }));
  }
  function liveField(field, label, value, placeholder) { return `<div class="field"><label for="live-${field}">${esc(label)}</label><textarea id="live-${field}" data-live-field="${field}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`; }
  function renderTask() {
    const task = T.LIVE_TASKS.find(item => item.id === selectedTask); const record = state.liveTasks[selectedTask]; const index = T.LIVE_TASKS.findIndex(item => item.id === selectedTask);
    const count = record.images.length;
    $("#task-workspace").innerHTML = `<article class="card"><header><h3>${esc(task.title)}</h3><p class="scenario"><strong>Skenario:</strong> ${esc(task.scenario)}</p><p>${esc(task.specification)}</p><p><strong>Nama wajib:</strong> <code>${esc(task.vulnerableFilename)}</code> dan <code>${esc(task.secureFilename)}</code></p></header><details><summary><strong>Prosedur first-timer terperinci</strong></summary>${procedureHTML(task)}</details>
      <div class="grid-2"><div class="field"><label for="live-vulnerableFilename">Nama file rentan</label><input id="live-vulnerableFilename" data-live-field="vulnerableFilename" value="${esc(record.vulnerableFilename)}" placeholder="${esc(task.vulnerableFilename)}"></div><div class="field"><label for="live-secureFilename">Nama file aman</label><input id="live-secureFilename" data-live-field="secureFilename" value="${esc(record.secureFilename)}" placeholder="${esc(task.secureFilename)}"></div></div>
      ${liveField("prediction", "Prediksi", record.prediction, "Prediksi sebelum menjalankan…")}${liveField("payload", "Payload yang sama sebelum dan sesudah", record.payload, "Ketik payload buatan Anda sendiri…")}
      <div class="grid-2">${liveField("beforeEvidence", "Bukti sebelum", record.beforeEvidence, "Output versi rentan…")}${liveField("difference", "Perbedaan terhadap kebijakan", record.difference, "Aksi/data/aturan yang dilanggar…")}${liveField("controlPatch", "Kontrol/deskripsi patch", record.controlPatch, "Jelaskan perubahan dengan kata sendiri…")}${liveField("afterEvidence", "Bukti sesudah", record.afterEvidence, "Output versi aman untuk payload sama…")}${liveField("observation", "Observasi", record.observation, "Fakta yang terlihat…")}${liveField("cause", "Sebab", record.cause, "Mekanisme penyebab…")}${liveField("conclusion", "Kesimpulan", record.conclusion, "Efektivitas dan keterbatasan kontrol…")}${liveField("toolVersion", "Versi alat/browser", record.toolVersion, "Contoh: Edge 140, Developer Tools…")}</div>
      <div class="field"><label for="task-images">Bukti screenshot (1-5 gambar; sumber maksimal 12 MB per gambar; target simpan ≤90 KB)</label><input id="task-images" type="file" multiple accept="image/*" ${count >= EV.MAX_IMAGES ? "disabled" : ""}></div><p class="${count >= EV.MIN_IMAGES ? "status-ok" : "status-bad"}" role="status">${count}/${EV.MAX_IMAGES} gambar${count < EV.MIN_IMAGES ? " · minimal 1 gambar" : ""}</p><div id="image-grid" class="image-grid">${count ? record.images.map(image => `<figure class="image-card"><img src="${image.data}" alt="Thumbnail ${esc(image.name)}"><figcaption>${esc(image.name)}<br>${Math.ceil(image.storedBytes / 1024)} KB</figcaption><button type="button" class="btn secondary" data-delete-image="${esc(image.id)}">Hapus gambar</button></figure>`).join("") : "<p>Belum ada screenshot.</p>"}</div>
      <div class="button-row"><button type="button" class="btn secondary" id="prev-task" ${index === 0 ? "disabled" : ""}>← Latihan sebelumnya</button><button type="button" class="btn secondary" id="next-task" ${index === T.LIVE_TASKS.length - 1 ? "disabled" : ""}>Latihan berikutnya →</button></div></article>`;
    bindTaskEvents(index);
  }
  function bindTaskEvents(index) {
    EV.LIVE_FIELDS.forEach(field => { const element = document.querySelector(`[data-live-field="${field}"]`); element.addEventListener("input", () => persist(candidate => { candidate.liveTasks[selectedTask][field] = element.value; })); });
    $("#task-images").addEventListener("change", async event => {
      const files = Array.from(event.target.files || []); if (!files.length) return;
      try {
        const compressed = []; for (const file of files) compressed.push(await EV.compressFile(file));
        const result = EV.appendImages(state.liveTasks[selectedTask].images, compressed);
        const ok = persist(candidate => { candidate.liveTasks[selectedTask].images = result.images; }, `${result.images.length} screenshot tersimpan${result.rejected ? `; ${result.rejected} ditolak karena batas lima` : ""}.`);
        if (ok) renderTask();
      } catch (error) { toast(error.message); event.target.value = ""; }
    });
    document.querySelectorAll("[data-delete-image]").forEach(button => button.addEventListener("click", () => { persist(candidate => { candidate.liveTasks[selectedTask].images = EV.removeImage(candidate.liveTasks[selectedTask].images, button.dataset.deleteImage); }, "Screenshot dihapus dari penyimpanan lokal."); renderTask(); }));
    $("#prev-task").addEventListener("click", () => { selectedTask = T.LIVE_TASKS[index - 1].id; renderTaskList(); renderTask(); });
    $("#next-task").addEventListener("click", () => { selectedTask = T.LIVE_TASKS[index + 1].id; renderTaskList(); renderTask(); });
  }

  // ---------- Web dummy dinilai ----------
  const CHECK_TIMEOUT_MS = 3000;
  const HARNESS_TIMEOUT_MS = 8000;
  const WEB_TEXT = [["provider", "Penyedia LLM", "Contoh: Google AI Studio"], ["modelName", "Nama model", "Contoh: nama model di AI Studio/OpenRouter"], ["urlVulnerable", "URL versi rentan (https)", "https://…/NPM-kasus-rentan.html"], ["urlSecure", "URL versi aman (https)", "https://…/NPM-kasus-aman.html"], ["urlRepo", "URL repo GitHub (kosongkan bila Netlify)", "https://github.com/…"]];
  const WEB_LONG = [["risk", "Risiko yang dibuktikan (teori bagian berapa?)", "Sebutkan risiko dan mekanismenya…"], ["control", "Kontrol di luar model yang dipasang", "Jelaskan kontrol pada versi aman…"], ["reasoning", "Alasan kausal: mengapa kontrol memutus mekanisme", "Hubungkan dengan teori, bukan sekadar 'karena aman'…"]];
  const resetChecker = web => { web.checker = { ranAt: "", vulnerable: null, secure: null, score: { rentan: 0, aman: 0, normal: 0, total: 0 } }; };
  function readText(file, maxBytes, label) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(Error(`Pilih berkas ${label}.`)); return; }
      if (file.size > maxBytes) { reject(Error(`Berkas ${label} melebihi ${Math.round(maxBytes / 1024)} KB.`)); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(Error(`Berkas ${label} tidak dapat dibaca.`));
      reader.readAsText(file);
    });
  }
  // Kode mahasiswa dijalankan di iframe sandbox ber-origin opaque: tidak dapat menyentuh state atau DOM modul.
  // Dua batas waktu: harness harus hidup dalam 8 detik (pesan khusus CSP/tag/JS eksternal), lalu asisten selesai dalam 3 detik.
  function runInIframe(html, caseId, nonce) {
    return new Promise(resolve => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.title = "Pemeriksa web dummy";
      frame.hidden = true;
      let finished = false;
      let timer = 0;
      const onMessage = event => {
        if (event.source !== frame.contentWindow || !event.data) return;
        if (event.data.p06Alive === true) { window.clearTimeout(timer); timer = window.setTimeout(() => finish({ error: "Waktu habis (3 detik): window.asisten tidak selesai. Pastikan memakai parameter model bila diberikan." }), CHECK_TIMEOUT_MS); return; }
        if (event.data.p06Check === true) finish(event.data);
      };
      function finish(result) { if (finished) return; finished = true; window.removeEventListener("message", onMessage); window.clearTimeout(timer); frame.remove(); resolve(result); }
      window.addEventListener("message", onMessage);
      timer = window.setTimeout(() => finish({ error: "Pemeriksa tidak dapat berjalan di halaman ini. Pastikan satu file HTML dengan JavaScript inline, tanpa meta Content-Security-Policy, tanpa file JS eksternal, dan semua tag (<script>, <textarea>, komentar) tertutup." }), HARNESS_TIMEOUT_MS);
      frame.srcdoc = WD.buildHarness(html, caseId, nonce);
      document.body.appendChild(frame);
    });
  }
  function webThumbs(images, group) { return images.length ? images.map(image => `<figure class="image-card"><img src="${image.data}" alt="Thumbnail ${esc(image.name)}"><figcaption>${esc(image.name)}<br>${Math.ceil(image.storedBytes / 1024)} KB</figcaption><button type="button" class="btn secondary" data-wd-delete="${group}" data-image-id="${esc(image.id)}">Hapus gambar</button></figure>`).join("") : "<p>Belum ada screenshot.</p>"; }
  function fileStatus(file) { return file.text ? `${esc(file.name)} · ${Math.ceil(file.text.length / 1024)} KB · <code>${esc(file.hash)}</code>` : "Belum diunggah"; }
  function checkerHTML(web) {
    const c = web.checker;
    if (!c.ranAt) return "<p class=\"muted\">Pemeriksa belum dijalankan.</p>";
    const line = (v, version) => !v ? "Belum dijalankan" : v.error ? `<span class="status-bad">Gagal: ${esc(v.error)}</span>` : version === "rentan" ? (v.proven ? "<span class=\"status-ok\">Terbukti rentan</span>" : "<span class=\"status-bad\">Tidak terbukti rentan (balasan harus berasal dari model)</span>") : `${v.secureOk ? "<span class=\"status-ok\">Serangan ditahan</span>" : v.violated ? "<span class=\"status-bad\">Serangan lolos</span>" : "<span class=\"status-bad\">Kontrol tidak terbukti (model tidak dipanggil atau aksi tidak ditahan gerbang)</span>"} ·${v.normalOk ? "normal dilayani" : "<span class=\"status-bad\">normal gagal</span>"}`;
    return `<p>Versi rentan: ${line(c.vulnerable, "rentan")}</p><p>Versi aman: ${line(c.secure, "aman")}</p><p class="score">Skor otomatis ${c.score.total}/40 (rentan ${c.score.rentan}/10 · aman ${c.score.aman}/20 · normal ${c.score.normal}/10)</p>`;
  }
  function renderWebDummy() {
    const web = state.webDummy;
    const status = WD.deadlineStatus(web.deployedAt);
    const log = web.log.text ? WD.summarizeLog(web.log.text) : null;
    const scans = ["vulnerable", "secure"].filter(key => web.files[key].text).flatMap(key => WD.scanSource(web.files[key].text).keys);
    $("#web-dummy").innerHTML = `<div class="grid-2"><div class="field"><label for="wd-caseId">Kasus yang dipilih</label><select id="wd-caseId" data-wd-field="caseId"><option value="">Pilih kasus…</option>${Object.entries(WD.CASES).map(([id, c]) => `<option value="${id}" ${web.caseId === id ? "selected" : ""}>${esc(id)} · ${esc(c.label)}</option>`).join("")}</select></div>
      <div class="field"><label for="wd-platform">Platform hosting</label><select id="wd-platform" data-wd-field="platform"><option value="">Pilih platform…</option><option value="github" ${web.platform === "github" ? "selected" : ""}>GitHub Pages</option><option value="netlify" ${web.platform === "netlify" ? "selected" : ""}>Netlify Drop</option></select></div>
      ${WEB_TEXT.map(([key, label, ph]) => `<div class="field"><label for="wd-${key}">${esc(label)}</label><input id="wd-${key}" data-wd-field="${key}" value="${esc(web[key])}" placeholder="${esc(ph)}"></div>`).join("")}
      <div class="field"><label for="wd-deployedAt">Waktu deploy terakhir (WIB, dari Actions/Deploys)</label><input id="wd-deployedAt" type="datetime-local" data-wd-field="deployedAt" value="${esc(web.deployedAt)}"><p id="wd-deploy-status" class="${status === "TERLAMBAT" ? "status-bad" : status === "TEPAT WAKTU" ? "status-ok" : "muted"}" role="status">${esc(status)}</p></div></div>
      <div class="grid-2"><div class="field"><label for="wd-file-vulnerable">File HTML versi rentan (≤100 KB)</label><input id="wd-file-vulnerable" type="file" accept=".html,.htm,text/html" data-wd-file="vulnerable"><p>${fileStatus(web.files.vulnerable)}</p></div>
      <div class="field"><label for="wd-file-secure">File HTML versi aman (≤100 KB)</label><input id="wd-file-secure" type="file" accept=".html,.htm,text/html" data-wd-file="secure"><p>${fileStatus(web.files.secure)}</p></div></div>
      ${scans.length ? `<p class="status-bad" role="alert">API key terdeteksi di kode: ${scans.map(esc).join("; ")}. Hapus key dari kode, rotasi key di penyedia, lalu unggah ulang.</p>` : ""}
      <div class="button-row"><button type="button" class="btn" id="wd-run" ${web.caseId && web.files.vulnerable.text && web.files.secure.text ? "" : "disabled"}>Jalankan pemeriksa otomatis</button></div><div id="wd-checker" role="status">${checkerHTML(web)}</div>
      <div class="field"><label for="wd-log">Log LLM asli (JSON P06-WEB-DUMMY; pilih log rentan dan log aman sekaligus, total ≤60 KB)</label><input id="wd-log" type="file" multiple accept="application/json,.json"><p>${!log ? "Belum diunggah" : log.ok ? `${esc(web.log.name)} · model ${esc(log.model || "-")} · rentan ${log.rentan.violations}/${log.rentan.runs} · aman ${log.aman.violations}/${log.aman.runs} · ${log.enough ? "<span class=\"status-ok\">≥3 run per versi</span>" : "<span class=\"status-bad\">belum 3 run per versi</span>"}` : esc(log.error)}</p></div>
      ${WEB_LONG.map(([key, label, ph]) => `<div class="field"><label for="wd-${key}">${esc(label)}</label><textarea id="wd-${key}" data-wd-field="${key}" placeholder="${esc(ph)}">${esc(web[key])}</textarea></div>`).join("")}
      <div class="field"><label for="wd-img-deploy">SS deploy/commit (1-5 gambar)</label><input id="wd-img-deploy" type="file" multiple accept="image/*" data-wd-images="deployImages"></div><div class="image-grid">${webThumbs(web.deployImages, "deployImages")}</div>
      <div class="field"><label for="wd-img-test">SS uji payload rentan vs aman (1-5 gambar)</label><input id="wd-img-test" type="file" multiple accept="image/*" data-wd-images="testImages"></div><div class="image-grid">${webThumbs(web.testImages, "testImages")}</div>`;
    bindWebDummy();
  }
  function bindWebDummy() {
    document.querySelectorAll("[data-wd-field]").forEach(element => {
      const key = element.dataset.wdField;
      const structural = key === "caseId" || key === "platform" || key === "deployedAt";
      element.addEventListener(structural ? "change" : "input", () => {
        persist(candidate => { candidate.webDummy[key] = element.value; if (key === "caseId") resetChecker(candidate.webDummy); });
        if (structural) renderWebDummy();
      });
    });
    document.querySelectorAll("[data-wd-file]").forEach(input => input.addEventListener("change", async () => {
      const key = input.dataset.wdFile;
      try {
        const file = input.files && input.files[0];
        const text = await readText(file, WD.MAX_HTML_BYTES, "HTML");
        const hash = await WD.hashText(text);
        if (persist(candidate => { candidate.webDummy.files[key] = { name: file.name, text, hash }; resetChecker(candidate.webDummy); }, "File HTML tersimpan; jalankan ulang pemeriksa.")) renderWebDummy();
      } catch (error) { toast(error.message); input.value = ""; }
    }));
    $("#wd-log").addEventListener("change", async event => {
      try {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        const texts = []; for (const file of files) texts.push(await readText(file, WD.MAX_LOG_BYTES, "log"));
        const merged = WD.mergeLogs(texts);
        if (!merged.ok) throw Error(merged.error);
        const hash = await WD.hashText(merged.text);
        const name = files.map(file => file.name).join(" + ");
        if (persist(candidate => { candidate.webDummy.log = { name, text: merged.text, hash }; }, `${files.length} log LLM asli digabung dan tersimpan.`)) renderWebDummy();
      } catch (error) { toast(error.message); event.target.value = ""; }
    });
    document.querySelectorAll("[data-wd-images]").forEach(input => input.addEventListener("change", async () => {
      const group = input.dataset.wdImages;
      const files = Array.from(input.files || []);
      if (!files.length) return;
      try {
        const compressed = []; for (const file of files) compressed.push(await EV.compressFile(file));
        const result = EV.appendImages(state.webDummy[group], compressed);
        if (persist(candidate => { candidate.webDummy[group] = result.images; }, `${result.images.length} screenshot tersimpan${result.rejected ? `; ${result.rejected} ditolak karena batas lima` : ""}.`)) renderWebDummy();
      } catch (error) { toast(error.message); input.value = ""; }
    }));
    document.querySelectorAll("[data-wd-delete]").forEach(button => button.addEventListener("click", () => {
      const group = button.dataset.wdDelete;
      persist(candidate => { candidate.webDummy[group] = EV.removeImage(candidate.webDummy[group], button.dataset.imageId); }, "Screenshot dihapus.");
      renderWebDummy();
    }));
    const run = $("#wd-run");
    run.addEventListener("click", async () => {
      // Snapshot kasus dan hash: hasil dibuang bila mahasiswa mengganti kasus/file selama pemeriksaan berjalan.
      const web = state.webDummy;
      const snapshot = { caseId: web.caseId, vulnerable: web.files.vulnerable.hash, secure: web.files.secure.hash };
      const controls = Array.from(document.querySelectorAll("#web-dummy input, #web-dummy select, #web-dummy textarea, #web-dummy button"));
      controls.forEach(el => { el.disabled = true; });
      $("#wd-checker").textContent = "Menjalankan pemeriksa di iframe terisolasi…";
      try {
        const nonce = WD.makeNonce();
        const vulnerable = WD.evaluate(snapshot.caseId, await runInIframe(web.files.vulnerable.text, snapshot.caseId, nonce), nonce);
        const nonce2 = WD.makeNonce();
        const secure = WD.evaluate(snapshot.caseId, await runInIframe(web.files.secure.text, snapshot.caseId, nonce2), nonce2);
        const now = state.webDummy;
        const stale = now.caseId !== snapshot.caseId || now.files.vulnerable.hash !== snapshot.vulnerable || now.files.secure.hash !== snapshot.secure;
        if (stale) { toast("Kasus atau file berubah selama pemeriksaan; hasil dibuang. Jalankan ulang."); return; }
        const score = WD.autoScore(vulnerable, secure);
        persist(candidate => { candidate.webDummy.checker = { ranAt: new Date().toISOString(), vulnerable, secure, score }; }, `Pemeriksa selesai: skor otomatis ${score.total}/40.`);
      } catch (error) {
        toast(`Pemeriksa gagal: ${error && error.message ? error.message : error}`);
      } finally {
        renderWebDummy();
      }
    });
  }
  $("#wd-deadline").textContent = `Batas waktu deploy: ${new Date(WD.DEADLINE_ISO).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" })} WIB. Deploy setelah batas ini ditandai TERLAMBAT di laporan.`;

  // ---------- Rekap, backup, cetak ----------
  function renderReport() {
    const html = EV.renderReportHTML(state, { labs: L.LABS, liveTasks: T.LIVE_TASKS, caseStudies: T.CASE_STUDIES, risks: T.RISKS, controls: T.CONTROLS, webDummy: WD });
    const preview = $("#report-preview");
    const printShell = $("#report-shell");
    if (preview) preview.innerHTML = html;
    if (printShell) printShell.innerHTML = html;
    return html;
  }
  function renderAll() { fillIdentity(); renderLab(); renderCases(); renderTask(); renderWebDummy(); renderReport(); }
  $("#lecturer-notes").addEventListener("input", event => persist(candidate => { candidate.lecturerNotes = event.target.value; }));
  $("#refresh-report").addEventListener("click", () => { renderReport(); toast("Preview laporan diperbarui."); });
  $("#print-report").addEventListener("click", () => { renderReport(); if (typeof window.print === "function") window.print(); else toast("Fungsi cetak tidak tersedia pada browser ini."); });
  window.addEventListener("beforeprint", renderReport);
  $("#reset-all").addEventListener("click", () => { if (!window.confirm("Hapus seluruh jawaban dan screenshot lokal P06 pada browser ini? Unduh backup JSON terlebih dahulu bila perlu.")) return; state = EV.resetAll(storage); renderAll(); toast("Seluruh state P06 telah direset."); });
  $("#backup-export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([EV.exportBackup(state)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `P06-backup-${(state.identity.npm || "tanpa-npm").replace(/[^\w-]/g, "")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup JSON dibuat. Simpan berkasnya di tempat aman.");
  });
  $("#backup-import").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > EV.MAX_BACKUP_BYTES) { toast("Berkas backup terlalu besar (maksimal 8 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = EV.importBackup(String(reader.result || ""));
      if (!result.ok) { toast(result.error); return; }
      if (!window.confirm("Ganti seluruh data P06 di browser ini dengan isi backup?")) return;
      if (persist(candidate => { Object.assign(candidate, result.state); }, "Backup JSON berhasil dipulihkan.")) renderAll();
    };
    reader.onerror = () => toast("Berkas backup tidak dapat dibaca.");
    reader.readAsText(file);
  });

  bindIdentity(); renderLabList(); renderLab(); renderCases(); renderWebDummy(); renderTaskList(); renderTask(); renderReport();
})();
