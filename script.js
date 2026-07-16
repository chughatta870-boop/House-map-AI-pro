/* ============================================================
   script.js — Main App / UI Controller
   ============================================================ */

(() => {
  let deferredInstallPrompt = null;

  document.addEventListener("DOMContentLoaded", () => {
    HouseCanvas.init(document.getElementById("planCanvas"));
    buildRoomControls();
    bindInputs();
    bindButtons();
    renderSavedList();
    resizeCanvasToContainer();
    window.addEventListener("resize", debounce(resizeCanvasToContainer, 200));
    registerServiceWorker();
    setupInstallPrompt();
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ---------------- Room requirement controls ----------------
  function buildRoomControls() {
    const container = document.getElementById("roomControls");
    const state = HousePlanner.getState();
    container.innerHTML = "";
    HousePlanner.getRoomTypes().forEach(type => {
      const row = document.createElement("div");
      row.className = "room-row";
      const count = HousePlanner.getRoomCount(type);
      row.innerHTML = `
        <span class="room-name">${type}</span>
        <div class="stepper">
          <button type="button" class="step-btn" data-action="dec" data-type="${type}">−</button>
          <span class="step-count" id="count-${slug(type)}">${count}</span>
          <button type="button" class="step-btn" data-action="inc" data-type="${type}">+</button>
        </div>`;
      container.appendChild(row);
    });

    container.addEventListener("click", e => {
      const btn = e.target.closest(".step-btn");
      if (!btn) return;
      const type = btn.dataset.type;
      const current = HousePlanner.getRoomCount(type);
      const next = btn.dataset.action === "inc" ? current + 1 : current - 1;
      HousePlanner.setRoomCount(type, next);
      document.getElementById(`count-${slug(type)}`).textContent = Math.max(0, next);
      updateSummary();
    });
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function updateSummary() {
    const total = HousePlanner.totalRoomCount();
    document.getElementById("roomTotalCount").textContent = total;
  }

  // ---------------- Inputs ----------------
  function bindInputs() {
    const st = HousePlanner.getState();
    const w = document.getElementById("plotWidth");
    const l = document.getElementById("plotLength");
    w.value = st.plotWidth;
    l.value = st.plotLength;

    w.addEventListener("input", () => {
      HousePlanner.setPlot(w.value, l.value);
      updatePlotAreaLabel();
    });
    l.addEventListener("input", () => {
      HousePlanner.setPlot(w.value, l.value);
      updatePlotAreaLabel();
    });

    document.querySelectorAll('input[name="entrySide"]').forEach(radio => {
      radio.addEventListener("change", e => HousePlanner.setEntrySide(e.target.value));
    });

    updatePlotAreaLabel();
    updateSummary();
  }

  function updatePlotAreaLabel() {
    const st = HousePlanner.getState();
    const area = st.plotWidth * st.plotLength;
    const marla = (area / 272.25).toFixed(2);
    document.getElementById("plotAreaLabel").textContent =
      `${area.toFixed(0)} sq.ft ≈ ${marla} Marla`;
  }

  // ---------------- Buttons ----------------
  function bindButtons() {
    document.getElementById("btnGenerate").addEventListener("click", onGenerate);
    document.getElementById("btnRegenerate").addEventListener("click", onRegenerate);
    document.getElementById("btnUndo").addEventListener("click", onUndo);
    document.getElementById("btnReset").addEventListener("click", onReset);
    document.getElementById("btnExportPNG").addEventListener("click", onExportPNG);
    document.getElementById("btnExportPDF").addEventListener("click", onExportPDF);
    document.getElementById("btnSave").addEventListener("click", onSavePlan);
    document.getElementById("btnInstall").addEventListener("click", onInstallClick);
    document.getElementById("sidebarToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
  }

  function onGenerate() {
    const plan = HousePlanner.generate();
    if (plan.error) { showToast(plan.error, true); return; }
    drawCurrentPlan();
    if (plan.warning) showToast(plan.warning, true);
    else showToast("Naya naksha ban gaya!");
    renderRoomSchedule(plan);
    document.getElementById("emptyState").classList.add("hidden");
  }

  function onRegenerate() {
    const st = HousePlanner.getState();
    if (!st.currentPlan) { onGenerate(); return; }
    const plan = HousePlanner.regenerateVariant();
    drawCurrentPlan();
    renderRoomSchedule(plan);
    showToast("Nayi variation generate ki gayi.");
  }

  function onUndo() {
    const plan = HousePlanner.undo();
    if (!plan) { showToast("Undo ke liye kuch nahi hai.", true); return; }
    drawCurrentPlan();
    renderRoomSchedule(plan);
  }

  function onReset() {
    if (!confirm("Sab room selections reset kar dein?")) return;
    HousePlanner.reset();
    buildRoomControls();
    updateSummary();
    document.getElementById("emptyState").classList.remove("hidden");
    document.getElementById("roomSchedule").innerHTML = "";
    const ctx = HouseCanvas.getCanvasEl().getContext("2d");
    ctx.clearRect(0, 0, HouseCanvas.getCanvasEl().width, HouseCanvas.getCanvasEl().height);
  }

  function onExportPNG() {
    const plan = HouseCanvas.getCurrentPlan();
    if (!plan) { showToast("Pehle naksha generate karein.", true); return; }
    HouseExport.exportPNG(HouseCanvas.getCanvasEl(), "housemap-plan.png");
  }

  async function onExportPDF() {
    const plan = HouseCanvas.getCurrentPlan();
    if (!plan) { showToast("Pehle naksha generate karein.", true); return; }
    showToast("PDF ban raha hai...");
    await HouseExport.exportPDF(HouseCanvas.getCanvasEl(), plan, "housemap-plan.pdf");
  }

  function onSavePlan() {
    const plan = HouseCanvas.getCurrentPlan();
    if (!plan) { showToast("Pehle naksha generate karein.", true); return; }
    const name = prompt("Plan ka naam likhein:", `Ghar ${new Date().toLocaleDateString()}`);
    if (name === null) return;
    HousePlanner.savePlan(name);
    renderSavedList();
    showToast("Plan save ho gaya.");
  }

  function renderSavedList() {
    const list = document.getElementById("savedList");
    const saved = HousePlanner.loadAllSaved();
    list.innerHTML = "";
    if (saved.length === 0) {
      list.innerHTML = `<p class="muted small">Koi saved plan nahi.</p>`;
      return;
    }
    saved.slice().reverse().forEach(p => {
      const row = document.createElement("div");
      row.className = "saved-row";
      row.innerHTML = `
        <span>${p.name}</span>
        <div>
          <button class="link-btn" data-id="${p.id}" data-act="load">Load</button>
          <button class="link-btn danger" data-id="${p.id}" data-act="del">Delete</button>
        </div>`;
      list.appendChild(row);
    });
    list.addEventListener("click", e => {
      const btn = e.target.closest(".link-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === "load") {
        HousePlanner.loadPlan(id);
        buildRoomControls();
        bindInputs();
        const plan = HousePlanner.generate();
        drawCurrentPlan();
        renderRoomSchedule(plan);
        document.getElementById("emptyState").classList.add("hidden");
      } else {
        if (confirm("Ye saved plan delete karein?")) {
          HousePlanner.deletePlan(id);
          renderSavedList();
        }
      }
    }, { once: true });
  }

  // ---------------- Drawing / schedule ----------------
  function drawCurrentPlan() {
    const state = HousePlanner.getState();
    const container = document.getElementById("canvasWrap");
    HouseCanvas.render(state.currentPlan, container.clientWidth, container.clientHeight);
  }

  function resizeCanvasToContainer() {
    const state = HousePlanner.getState();
    if (!state.currentPlan) return;
    drawCurrentPlan();
  }

  function renderRoomSchedule(plan) {
    const el = document.getElementById("roomSchedule");
    if (!plan || !plan.rooms.length) { el.innerHTML = ""; return; }
    let rows = plan.rooms.map(r => `
      <tr>
        <td>${r.label || r.type}</td>
        <td>${r.w}' × ${r.h}'</td>
        <td>${r.areaSqFt} sq.ft</td>
      </tr>`).join("");
    el.innerHTML = `
      <table class="schedule-table">
        <thead><tr><th>Room</th><th>Size</th><th>Area</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted small">Total Plot: ${plan.totalAreaSqFt} sq.ft (${plan.marlas} Marla)</p>`;
  }

  // ---------------- Toast ----------------
  let toastTimer;
  function showToast(msg, isWarning = false) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (isWarning ? " warn" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast"; }, 3500);
  }

  // ---------------- PWA install / SW ----------------
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW register failed", err));
      });
    }
  }

  function setupInstallPrompt() {
    const installBtn = document.getElementById("btnInstall");
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      installBtn.classList.remove("hidden");
    });
    window.addEventListener("appinstalled", () => {
      installBtn.classList.add("hidden");
      deferredInstallPrompt = null;
    });
  }

  async function onInstallClick() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById("btnInstall").classList.add("hidden");
  }
})();
