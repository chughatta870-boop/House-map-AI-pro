/* ============================================================
   ai.js — AI Layout Rules Engine
   Rule-based procedural floor-plan generator.
   Uses a guillotine-cut space partitioning algorithm: rooms are
   sorted, allocated a target area from standard architectural
   norms, then the plot rectangle is recursively sliced
   (alternating horizontal / vertical cuts) so every room gets a
   rectangle proportional to its required area.
   ============================================================ */

const HouseAI = (() => {

  // Standard architectural room-area guidance (sq.ft) — min/typical/max
  const ROOM_NORMS = {
    "Master Bedroom":   { min: 130, typical: 168, ratio: [1, 1.3] },
    "Bedroom":          { min: 100, typical: 130, ratio: [1, 1.3] },
    "Drawing Room":     { min: 120, typical: 165, ratio: [1.2, 1.6] },
    "Lounge / TV Room": { min: 100, typical: 150, ratio: [1.1, 1.5] },
    "Dining Room":      { min: 80,  typical: 110, ratio: [1, 1.4] },
    "Kitchen":          { min: 60,  typical: 90,  ratio: [1, 1.4] },
    "Bathroom":         { min: 25,  typical: 36,  ratio: [0.7, 1] },
    "Store Room":       { min: 20,  typical: 32,  ratio: [0.8, 1.2] },
    "Staircase":        { min: 36,  typical: 48,  ratio: [1, 1] },
    "Garage":           { min: 130, typical: 180, ratio: [1.3, 1.8] },
    "Lawn / Courtyard":  { min: 80,  typical: 120, ratio: [1, 1.6] },
    "Laundry":          { min: 25,  typical: 36,  ratio: [0.8, 1.2] },
  };

  function normFor(type) {
    return ROOM_NORMS[type] || { min: 60, typical: 90, ratio: [1, 1.4] };
  }

  // Build the room "wish list" (flat array) from the user's requirement counts
  function buildRoomList(requirements) {
    const list = [];
    Object.entries(requirements).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        const label = count > 1 && !type.includes("Bedroom") && !type.includes("Bathroom")
          ? `${type} ${i + 1}`
          : (count > 1 ? `${type} ${i + 1}` : type);
        list.push({
          type,
          label: i === 0 && type === "Bedroom" && requirements["Master Bedroom"] === undefined && i === 0
            ? label : label,
          area: normFor(type).typical,
          norm: normFor(type)
        });
      }
    });
    return list;
  }

  // Recursive guillotine-cut placement.
  // rect: {x,y,w,h} in feet. rooms: array of {type,label,area}
  // Returns array of placed rooms with x,y,w,h
  function slice(rect, rooms, depth = 0) {
    if (rooms.length === 0) return [];
    if (rooms.length === 1) {
      const r = rooms[0];
      return [{ ...r, x: rect.x, y: rect.y, w: rect.w, h: rect.h }];
    }

    // Sort largest first so big rooms claim proportionate space early
    const sorted = [...rooms].sort((a, b) => b.area - a.area);
    const totalArea = sorted.reduce((s, r) => s + r.area, 0);

    // Split rooms into two groups by area so each half gets ~50% of total area
    let running = 0;
    let splitIdx = 1;
    for (let i = 0; i < sorted.length; i++) {
      running += sorted[i].area;
      if (running >= totalArea / 2) { splitIdx = i + 1; break; }
    }
    splitIdx = Math.max(1, Math.min(splitIdx, sorted.length - 1));

    const groupA = sorted.slice(0, splitIdx);
    const groupB = sorted.slice(splitIdx);
    const areaA = groupA.reduce((s, r) => s + r.area, 0);
    const areaB = groupB.reduce((s, r) => s + r.area, 0);
    const fracA = areaA / (areaA + areaB);

    // Alternate cut direction by depth, but prefer cutting the longer side
    const cutVertical = rect.w >= rect.h ? true : false;
    const useVertical = depth % 2 === 0 ? cutVertical : !cutVertical;

    let rectA, rectB;
    if (useVertical) {
      const wA = Math.max(4, rect.w * fracA);
      rectA = { x: rect.x, y: rect.y, w: wA, h: rect.h };
      rectB = { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h };
    } else {
      const hA = Math.max(4, rect.h * fracA);
      rectA = { x: rect.x, y: rect.y, w: rect.w, h: hA };
      rectB = { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA };
    }

    return [
      ...slice(rectA, groupA, depth + 1),
      ...slice(rectB, groupB, depth + 1)
    ];
  }

  // Assign a door to each room (placed on the wall nearest the main corridor/entry)
  function assignDoors(rooms, plot, entrySide) {
    return rooms.map(r => {
      // default: door on the wall facing the plot entry side
      let doorWall = "bottom";
      const nearBottom = Math.abs((r.y + r.h) - plot.h) < plot.h * 0.35;
      const nearTop = Math.abs(r.y) < plot.h * 0.35;
      const nearLeft = Math.abs(r.x) < plot.w * 0.35;
      const nearRight = Math.abs((r.x + r.w) - plot.w) < plot.w * 0.35;

      if (entrySide === "bottom" && nearBottom) doorWall = "bottom";
      else if (entrySide === "top" && nearTop) doorWall = "top";
      else if (entrySide === "left" && nearLeft) doorWall = "left";
      else if (entrySide === "right" && nearRight) doorWall = "right";
      else {
        // pick the wall with the most open space (largest dimension) facing corridor-ish
        doorWall = r.w >= r.h ? "bottom" : "right";
      }
      return { ...r, door: doorWall };
    });
  }

  /**
   * Generate a full floor plan.
   * @param {Object} opts
   *   plotWidth, plotLength (feet)
   *   requirements: { "Master Bedroom": 1, "Bedroom": 2, ... }
   *   entrySide: "bottom" | "top" | "left" | "right"
   */
  function generateLayout(opts) {
    const { plotWidth, plotLength, requirements, entrySide = "bottom" } = opts;
    const plot = { x: 0, y: 0, w: plotWidth, h: plotLength };
    const totalArea = plotWidth * plotLength;

    let roomList = buildRoomList(requirements);
    if (roomList.length === 0) {
      return { rooms: [], plot, warning: "Koi room select nahi kiya gaya." };
    }

    // Scale target areas so they fit within plot's usable area (92% — rest is wall thickness allowance)
    const usable = totalArea * 0.92;
    const requestedArea = roomList.reduce((s, r) => s + r.area, 0);
    const scale = usable / requestedArea;

    let warning = null;
    if (scale < 0.55) {
      warning = "Plot size chuni gayi rooms ke liye chota hai — sizes automatically kam kar di gayi hain. Bara plot ya kam rooms try karein.";
    } else if (scale > 1.8) {
      warning = "Plot bohot bara hai in rooms ke liye — rooms proportionally bara kar diye gaye hain.";
    }

    roomList = roomList.map(r => ({ ...r, area: r.area * scale }));

    let placed = slice(plot, roomList, 0);
    placed = assignDoors(placed, plot, entrySide);

    // Round dims to 1 decimal foot for cleaner display
    placed = placed.map(r => ({
      ...r,
      x: round1(r.x), y: round1(r.y), w: round1(r.w), h: round1(r.h),
      areaSqFt: round1(r.w * r.h)
    }));

    return {
      rooms: placed,
      plot,
      totalAreaSqFt: round1(totalArea),
      marlas: round1(totalArea / 272.25), // 1 marla = 272.25 sq ft (Pakistan standard)
      entrySide,
      warning
    };
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  return { generateLayout, ROOM_NORMS };
})();
