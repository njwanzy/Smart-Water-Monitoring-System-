const STATUS = {
  normal: { label: "Normal", className: "normal" },
  attention: { label: "Butuh perhatian", className: "attention" },
  critical: { label: "Kritis", className: "critical" }
};

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const summaryIcons = {
  total: '<svg viewBox="0 0 24 24"><path d="M4 10c0-3.3 3.6-6.9 7-9.6.6-.3 1.4-.3 2 0 3.4 1.7 7 6.3 7 9.6 0 4.4-3.6 8-8 8s-8-3.6-8-8Zm2.5 1c.3 2.6 2.4 4.5 5 4.5.6 0 1-.4 1-1s-.4-1-1-1c-1.6 0-2.8-1.1-3-2.7-.1-.5-.6-.9-1.1-.8-.6.1-1 .5-.9 1Z"/></svg>',
  normal: '<svg viewBox="0 0 24 24"><path d="M9.6 17.2 4.8 12.4l-2 2 6.8 6.8L21.4 9.4l-2-2-9.8 9.8Z"/></svg>',
  attention: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"/></svg>',
  critical: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/></svg>'
};

const initialReadings = [
  [7.20, 168], [7.61, 192], [7.03, 155], [6.74, 216], [7.81, 247],
  [6.42, 286], [7.26, 179], [8.70, 348], [7.14, 164], [6.91, 202],
  [7.47, 231], [5.83, 423], [7.65, 188], [8.23, 272], [7.34, 209],
  [6.58, 258], [9.12, 395], [7.08, 174], [7.73, 298], [6.28, 319]
];

const pools = initialReadings.map(([ph, tds], index) => {
  const history = Array.from({ length: 18 }, (_, i) => ({
    timestamp: new Date(Date.now() - (17 - i) * 60 * 60 * 1000),
    ph: clamp(ph + Math.sin(i * .73 + index) * .18 + (Math.random() - .5) * .12, 0, 14),
    tds: Math.round(clamp(tds + Math.cos(i * .63 + index) * 12 + (Math.random() - .5) * 10, 0, 500))
  }));
  return { id: index + 1, ph, tds, history };
});

let selectedPoolId = 1;
let isPaused = false;
let tickCount = 0;
let toastTimer;

function statusFor(pool) {
  if (pool.ph < 6 || pool.ph > 9 || pool.tds > 380) return STATUS.critical;
  if (pool.ph < 6.5 || pool.ph > 8.5 || pool.tds > 300) return STATUS.attention;
  return STATUS.normal;
}

function healthScore(pool) {
  const phPenalty = Math.abs(pool.ph - 7.3) * 10;
  const tdsPenalty = Math.max(0, Math.abs(pool.tds - 190) - 30) * .08;
  return Math.round(clamp(98 - phPenalty - tdsPenalty, 35, 99));
}

function renderSummary() {
  const counts = pools.reduce((acc, pool) => {
    acc[statusFor(pool).className] += 1;
    return acc;
  }, { normal: 0, attention: 0, critical: 0 });

  const cards = [
    ["total", "Kolam Aktif", pools.length, "kolam"],
    ["normal", "Kondisi Normal", counts.normal, "kolam"],
    ["attention", "Butuh Perhatian", counts.attention, "kolam"],
    ["critical", "Status Kritis", counts.critical, "kolam"]
  ];

  $("#summaryGrid").innerHTML = cards.map(([type, label, number, suffix]) => `
    <article class="summary-card">
      <div>
        <span class="summary-label">${label}</span>
        <div class="status-number">${number}<small>${suffix}</small></div>
      </div>
      <div class="summary-icon ${type}">${summaryIcons[type]}</div>
    </article>
  `).join("");
}

function renderHeatmap() {
  $("#heatmap").innerHTML = pools.map(pool => {
    const status = statusFor(pool);
    return `
      <button class="pond-cell ${status.className} ${pool.id === selectedPoolId ? "selected" : ""}"
        data-pool-id="${pool.id}" aria-label="Pilih Kolam ${String(pool.id).padStart(2, "0")}">
        <span class="pond-id">KOLAM ${String(pool.id).padStart(2, "0")}</span>
        <span class="pond-score">${healthScore(pool)}<small>%</small></span>
      </button>
    `;
  }).join("");

  document.querySelectorAll(".pond-cell").forEach(button => {
    button.addEventListener("click", () => {
      selectedPoolId = Number(button.dataset.poolId);
      renderAll();
      showToast(`Menampilkan data Kolam ${String(selectedPoolId).padStart(2, "0")}`);
    });
  });
}

function rotateNeedle(element, value, max) {
  const angle = -90 + clamp(value / max, 0, 1) * 180;
  element.style.transform = `rotate(${angle}deg)`;
}

function renderSelectedPool() {
  const pool = pools.find(item => item.id === selectedPoolId);
  const status = statusFor(pool);
  $("#selectedPoolTitle").textContent = `Kolam ${String(pool.id).padStart(2, "0")}`;
  $("#selectedPoolStatus").textContent = status.label;
  $("#selectedPoolStatus").className = `status-pill ${status.className}`;
  $("#phValue").textContent = pool.ph.toFixed(2);
  $("#tdsValue").textContent = Math.round(pool.tds);
  $("#phCaption").textContent = pool.ph >= 6.5 && pool.ph <= 8.5 ? "Kondisi optimal" : "Di luar rentang optimal";
  $("#tdsCaption").textContent = pool.tds <= 300 ? "Kualitas air baik" : "Perlu tindakan segera";
  rotateNeedle($("#phNeedle"), pool.ph, 14);
  rotateNeedle($("#tdsNeedle"), pool.tds, 500);
  $("#selectedDetail").innerHTML = `
    <div class="detail-title">DETAIL KOLAM ${String(pool.id).padStart(2, "0")}</div>
    <div class="detail-row"><span>Status</span><strong>${status.label}</strong></div>
    <div class="detail-row"><span>pH Air</span><strong>${pool.ph.toFixed(2)} pH</strong></div>
    <div class="detail-row"><span>TDS</span><strong>${Math.round(pool.tds)} ppm</strong></div>
    <div class="detail-row"><span>Health Score</span><strong>${healthScore(pool)}%</strong></div>
  `;
}

function linePath(values, min, max, width, height, pad) {
  return values.map((value, index) => {
    const x = pad.left + (index / (values.length - 1)) * (width - pad.left - pad.right);
    const y = pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
    return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function renderSingleChart({ target, values, min, max, color, gradientId, formatter, history }) {
  const width = 900, height = 210, pad = { top: 14, right: 18, bottom: 30, left: 42 };
  const path = linePath(values, min, max, width, height, pad);
  const chartBottom = height - pad.bottom;
  let svg = `<defs>
    <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
  </defs>`;

  for (let i = 0; i < 5; i += 1) {
    const y = pad.top + i * ((height - pad.top - pad.bottom) / 4);
    const label = formatter(max - i * ((max - min) / 4));
    svg += `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"/>
      <text class="axis-label" x="5" y="${y + 3}">${label}</text>`;
  }

  history.forEach((item, index) => {
    if (index % 3 === 0 || index === history.length - 1) {
      const x = pad.left + (index / (history.length - 1)) * (width - pad.left - pad.right);
      const time = item.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      svg += `<text class="axis-label" text-anchor="middle" x="${x}" y="${height - 9}">${time}</text>`;
    }
  });

  svg += `<path class="chart-area" fill="url(#${gradientId})" d="${path} L ${width - pad.right} ${chartBottom} L ${pad.left} ${chartBottom} Z"/>
    <path class="chart-line" stroke="${color}" d="${path}"/>`;
  const lastX = width - pad.right;
  const lastY = pad.top + (1 - (values.at(-1) - min) / (max - min)) * (height - pad.top - pad.bottom);
  svg += `<circle class="chart-dot" fill="${color}" cx="${lastX}" cy="${lastY}" r="5"/>`;
  $(target).innerHTML = svg;
}

function renderChart() {
  const pool = pools.find(item => item.id === selectedPoolId);
  $("#chartPhValue").textContent = `${pool.ph.toFixed(2)} pH`;
  $("#chartTdsValue").textContent = `${Math.round(pool.tds)} ppm`;
  renderSingleChart({
    target: "#phLineChart", values: pool.history.map(item => item.ph),
    min: 5, max: 10, color: "#087f7b", gradientId: "phArea",
    formatter: value => value.toFixed(1), history: pool.history
  });
  renderSingleChart({
    target: "#tdsLineChart", values: pool.history.map(item => item.tds),
    min: 100, max: 450, color: "#45a4c2", gradientId: "tdsArea",
    formatter: value => Math.round(value), history: pool.history
  });
}

function renderAll() {
  renderSummary();
  renderHeatmap();
  renderSelectedPool();
  renderChart();
  $("#updatedTime").textContent = isPaused ? "Data dijeda" : "Baru saja";
}

function updateRealtimeData() {
  if (isPaused) return;
  tickCount += 1;
  pools.forEach(pool => {
    pool.ph = clamp(pool.ph + (Math.random() - .5) * .10, 4.8, 9.6);
    pool.tds = Math.round(clamp(pool.tds + (Math.random() - .5) * 8, 110, 450));
    pool.history.push({ timestamp: new Date(), ph: pool.ph, tds: pool.tds });
    if (pool.history.length > 18) pool.history.shift();
  });
  renderAll();
}

function togglePause() {
  isPaused = !isPaused;
  $("#pauseLabel").textContent = isPaused ? "Lanjutkan" : "Pause";
  $("#pauseIcon").setAttribute("d", isPaused ? "M8 5v14l11-7L8 5Z" : "M7 5h4v14H7V5Zm6 0h4v14h-4V5Z");
  $("#liveIndicator").classList.toggle("paused", isPaused);
  $("#liveText").textContent = isPaused ? "Monitoring dijeda" : "Live monitoring";
  renderAll();
  showToast(isPaused ? "Pembaruan realtime dijeda" : "Pembaruan realtime dilanjutkan");
}

function exportCsv() {
  const pool = pools.find(item => item.id === selectedPoolId);
  const rows = [
    ["kolam", "waktu", "ph", "tds_ppm", "status"],
    ...pool.history.map(item => [
      `Kolam ${String(pool.id).padStart(2, "0")}`,
      item.timestamp.toISOString(),
      item.ph.toFixed(2),
      item.tds,
      statusFor(item).label
    ])
  ];
  const content = rows.map(row => row.join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `data-kualitas-air-kolam-${String(pool.id).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`CSV Kolam ${String(pool.id).padStart(2, "0")} berhasil diunduh`);
}

function showToast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2400);
}

$("#pauseButton").addEventListener("click", togglePause);
$("#exportButton").addEventListener("click", exportCsv);
renderAll();
setInterval(updateRealtimeData, 4000);
