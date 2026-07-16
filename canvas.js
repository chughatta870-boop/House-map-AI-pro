/* ============================================================
   canvas.js — Drawing Engine
   Renders a generated floor-plan (in feet) onto an HTML canvas
   as a professional architectural blueprint drawing.
   ============================================================ */

const HouseCanvas = (() => {
  let canvas, ctx;
  let currentPlan = null;
  let scalePxPerFt = 20;
  let padding = 70;

  const ROOM_COLORS = {
    "Master Bedroom":   "#dbeafe",
    "Bedroom":          "#e0f2fe",
    "Drawing Room":     "#fef3c7",
    "Lounge / TV Room": "#fde68a",
    "Dining Room":      "#fce7f3",
    "Kitchen":          "#dcfce7",
    "Bathroom":         "#e2e8f0",
    "Store Room":       "#f1f5f9",
    "Staircase":        "#ede9fe",
    "Garage":           "#f3f4f6",
    "Lawn / Courtyard":  "#d1fae5",
    "Laundry":          "#e0e7ff"
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
  }

  function roomColor(type) {
    return ROOM_COLORS[type] || "#f8fafc";
  }

  function fitScale(plan, maxW, maxH) {
    const availW = maxW - padding * 2;
    const availH = maxH - padding * 2;
    const sX = availW / plan.plot.w;
    const sY = availH / plan.plot.h;
    return Math.max(4, Math.min(sX, sY));
  }

  function render(plan, containerW, containerH) {
    if (!plan || !plan.rooms.length) return;
    currentPlan = plan;

    // High-DPI canvas
    const dpr = window.devicePixelRatio || 1;
    const cssW = containerW;
    const cssH = containerH;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    scalePxPerFt = fitScale(plan, cssW, cssH - 60); // reserve bottom title block

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    const originX = padding;
    const originY = padding;
    const planW = plan.plot.w * scalePxPerFt;
    const planH = plan.plot.h * scalePxPerFt;

    drawGrid(originX, originY, planW, planH);
    drawRooms(plan, originX, originY);
    drawOuterWalls(originX, originY, planW, planH);
    drawDimensions(plan, originX, originY, planW, planH);
    drawNorthArrow(originX + planW + 15, originY);
    drawTitleBlock(plan, cssW, cssH);
  }

  function ftToPx(ft) { return ft * scalePxPerFt; }

  function drawGrid(ox, oy, w, h) {
    ctx.save();
    ctx.strokeStyle = "#eef2f7";
    ctx.lineWidth = 1;
    const step = ftToPx(5);
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath(); ctx.moveTo(ox + x, oy); ctx.lineTo(ox + x, oy + h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(ox, oy + y); ctx.lineTo(ox + w, oy + y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRooms(plan, ox, oy) {
    plan.rooms.forEach(r => {
      const x = ox + ftToPx(r.x);
      const y = oy + ftToPx(r.y);
      const w = ftToPx(r.w);
      const h = ftToPx(r.h);

      // fill
      ctx.fillStyle = roomColor(r.type);
      ctx.fillRect(x, y, w, h);

      // interior walls
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // door gap + swing arc
      drawDoor(r, x, y, w, h);

      // label
      ctx.fillStyle = "#1e293b";
      const fontSize = Math.max(10, Math.min(15, w / 8));
      ctx.font = `600 ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(wrapLabel(r.label || r.type), x + w / 2, y + h / 2 - 4, w - 6);

      ctx.font = `${Math.max(9, fontSize - 3)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = "#475569";
      ctx.fillText(`${r.w}' × ${r.h}'`, x + w / 2, y + h / 2 + 12, w - 6);
      ctx.fillText(`${r.areaSqFt} sq.ft`, x + w / 2, y + h / 2 + 26, w - 6);
    });
  }

  function wrapLabel(label) {
    return label.length > 16 ? label.slice(0, 15) + "…" : label;
  }

  function drawDoor(r, x, y, w, h) {
    const doorLen = Math.min(ftToPx(3), Math.min(w, h) * 0.5);
    ctx.save();
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2.5;

    let dx, dy, angleStart, angleEnd, hingeX, hingeY;
    switch (r.door) {
      case "top":
        hingeX = x + w * 0.25; hingeY = y;
        ctx.beginPath(); ctx.moveTo(hingeX, hingeY); ctx.lineTo(hingeX, hingeY - doorLen * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.arc(hingeX, hingeY, doorLen, Math.PI, Math.PI * 1.5); ctx.stroke();
        break;
      case "left":
        hingeX = x; hingeY = y + h * 0.25;
        ctx.beginPath(); ctx.arc(hingeX, hingeY, doorLen, -Math.PI / 2, 0); ctx.stroke();
        break;
      case "right":
        hingeX = x + w; hingeY = y + h * 0.25;
        ctx.beginPath(); ctx.arc(hingeX, hingeY, doorLen, Math.PI / 2, Math.PI); ctx.stroke();
        break;
      case "bottom":
      default:
        hingeX = x + w * 0.25; hingeY = y + h;
        ctx.beginPath(); ctx.arc(hingeX, hingeY, doorLen, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function drawOuterWalls(ox, oy, w, h) {
    ctx.save();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 5;
    ctx.strokeRect(ox, oy, w, h);
    ctx.restore();
  }

  function drawDimensions(plan, ox, oy, w, h) {
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.fillStyle = "#334155";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.lineWidth = 1;

    // Top dimension (width)
    const dimY = oy - 18;
    ctx.beginPath(); ctx.moveTo(ox, dimY); ctx.lineTo(ox + w, dimY); ctx.stroke();
    tick(ox, dimY); tick(ox + w, dimY);
    ctx.textAlign = "center";
    ctx.fillText(`${plan.plot.w}' `, ox + w / 2, dimY - 6);

    // Left dimension (height)
    const dimX = ox - 18;
    ctx.beginPath(); ctx.moveTo(dimX, oy); ctx.lineTo(dimX, oy + h); ctx.stroke();
    tick(dimX, oy, true); tick(dimX, oy + h, true);
    ctx.save();
    ctx.translate(dimX - 8, oy + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(`${plan.plot.h}'`, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function tick(x, y, vertical) {
    ctx.beginPath();
    if (vertical) { ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); }
    else { ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); }
    ctx.stroke();
  }

  function drawNorthArrow(x, y) {
    ctx.save();
    ctx.translate(x + 14, y + 14);
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(4, 4); ctx.lineTo(0, 0); ctx.lineTo(-4, 4);
    ctx.closePath(); ctx.fill();
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", 0, 24);
    ctx.restore();
  }

  function drawTitleBlock(plan, cssW, cssH) {
    ctx.save();
    const y = cssH - 44;
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(cssW - padding, y); ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("HouseMap AI Pro — Floor Plan", padding, y + 20);

    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(
      `Plot: ${plan.plot.w}' × ${plan.plot.h}'  (${plan.totalAreaSqFt} sq.ft / ${plan.marlas} Marla)   |   Scale approx.`,
      padding, y + 36
    );

    ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleDateString(), cssW - padding, y + 20);
    ctx.restore();
  }

  function getCurrentPlan() { return currentPlan; }
  function getCanvasEl() { return canvas; }

  return { init, render, getCurrentPlan, getCanvasEl };
})();
