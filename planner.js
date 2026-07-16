/* ============================================================
   planner.js — Professional Layout Engine (state manager)
   Bridges the UI, the AI layout engine (ai.js) and the drawing
   engine (canvas.js). Holds current plot + requirement state,
   history (undo), and saved-plan persistence via localStorage.
   ============================================================ */

const HousePlanner = (() => {
  const STORAGE_KEY = "housemap_ai_pro_saved_plans_v1";

  const ROOM_TYPES = [
    "Master Bedroom", "Bedroom", "Drawing Room", "Lounge / TV Room",
    "Dining Room", "Kitchen", "Bathroom", "Store Room",
    "Staircase", "Garage", "Lawn / Courtyard", "Laundry"
  ];

  let state = {
    plotWidth: 30,
    plotLength: 45,
    entrySide: "bottom",
    requirements: {
      "Master Bedroom": 1,
      "Bedroom": 2,
      "Drawing Room": 1,
      "Kitchen": 1,
      "Bathroom": 2,
      "Staircase": 1
    },
    currentPlan: null
  };

  let history = [];

  function getRoomTypes() { return ROOM_TYPES; }
  function getState() { return state; }

  function setPlot(width, length) {
    state.plotWidth = Math.max(10, Number(width) || state.plotWidth);
    state.plotLength = Math.max(10, Number(length) || state.plotLength);
  }

  function setEntrySide(side) {
    state.entrySide = side;
  }

  function setRoomCount(type, count) {
    const c = Math.max(0, Math.min(10, parseInt(count, 10) || 0));
    if (c === 0) delete state.requirements[type];
    else state.requirements[type] = c;
  }

  function getRoomCount(type) {
    return state.requirements[type] || 0;
  }

  function totalRoomCount() {
    return Object.values(state.requirements).reduce((a, b) => a + b, 0);
  }

  function generate() {
    if (totalRoomCount() === 0) {
      return { error: "Kam az kam ek room select karein." };
    }
    const plan = HouseAI.generateLayout({
      plotWidth: state.plotWidth,
      plotLength: state.plotLength,
      requirements: state.requirements,
      entrySide: state.entrySide
    });
    if (state.currentPlan) history.push(state.currentPlan);
    if (history.length > 15) history.shift();
    state.currentPlan = plan;
    return plan;
  }

  function regenerateVariant() {
    // Re-run generation; guillotine cut order is deterministic by area,
    // so nudge areas slightly for a fresh variant layout.
    const jitteredReq = { ...state.requirements };
    const plan = HouseAI.generateLayout({
      plotWidth: state.plotWidth,
      plotLength: state.plotLength,
      requirements: jitteredReq,
      entrySide: state.entrySide === "bottom" ? "left" : "bottom"
    });
    state.entrySide = plan.entrySide;
    if (state.currentPlan) history.push(state.currentPlan);
    state.currentPlan = plan;
    return plan;
  }

  function undo() {
    if (history.length === 0) return state.currentPlan;
    state.currentPlan = history.pop();
    return state.currentPlan;
  }

  function reset() {
    state.requirements = {};
    state.currentPlan = null;
    history = [];
  }

  // ---------- Saved plans (localStorage) ----------
  function savePlan(name) {
    const saved = loadAllSaved();
    const entry = {
      id: Date.now().toString(36),
      name: name || `Plan ${saved.length + 1}`,
      savedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(state))
    };
    saved.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return entry;
  }

  function loadAllSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function loadPlan(id) {
    const saved = loadAllSaved();
    const entry = saved.find(p => p.id === id);
    if (!entry) return null;
    state = JSON.parse(JSON.stringify(entry.state));
    return state;
  }

  function deletePlan(id) {
    const saved = loadAllSaved().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  return {
    getRoomTypes, getState, setPlot, setEntrySide,
    setRoomCount, getRoomCount, totalRoomCount,
    generate, regenerateVariant, undo, reset,
    savePlan, loadAllSaved, loadPlan, deletePlan
  };
})();
