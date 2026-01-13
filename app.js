import QrScanner from "https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js";
QrScanner.WORKER_PATH =
  "https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner-worker.min.js";

const video = document.querySelector("video");
const resultEl = document.querySelector("#result");

const scanBtn = document.querySelector("#scanBtn");
const flipBtn = document.querySelector("#flipBtn");
const copyBtn = document.querySelector("#copyBtn");
const shareBtn = document.querySelector("#shareBtn");
const openBtn = document.querySelector("#openBtn");

const zoom = document.querySelector("#zoom");
const zoomVal = document.querySelector("#zoomVal");

let scanner;
let last = "";
let facing = "environment";
let currentText = "";
let mediaStream = null;

function isProbablyUrl(text) {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function setButtons() {
  const hasText = !!currentText;
  copyBtn.disabled = !hasText;
  shareBtn.disabled = !hasText;
  openBtn.disabled = !(hasText && isProbablyUrl(currentText));
}

function setResult(text) {
  currentText = text || "";
  resultEl.textContent = currentText ? `Found: ${currentText}` : "No result yet.";
  setButtons();
}

async function applyZoom(value) {
  try {
    const track = mediaStream?.getVideoTracks?.()?.[0];
    if (!track) return;

    const caps = track.getCapabilities?.();
    if (!caps?.zoom) return;

    await track.applyConstraints({ advanced: [{ zoom: value }] });
  } catch {
    // Ignore (Safari may reject constraints)
  }
}

async function setupZoomUI() {
  const track = mediaStream?.getVideoTracks?.()?.[0];
  const caps = track?.getCapabilities?.();

  if (caps?.zoom) {
    zoom.min = caps.zoom.min;
    zoom.max = caps.zoom.max;
    zoom.step = caps.zoom.step || 0.1;

    // try to start at a sensible value
    const start = Math.max(caps.zoom.min, Math.min(caps.zoom.max, 1));
    zoom.value = start;
    zoomVal.textContent = `${Number(zoom.value).toFixed(1)}×`;
    await applyZoom(Number(zoom.value));

    zoom.disabled = false;
  } else {
    zoom.disabled = true;
    zoomVal.textContent = `n/a`;
  }
}

async function start() {
  // destroy old scanner cleanly
  if (scanner) scanner.destroy();

  scanner = new QrScanner(
    video,
    (res) => {
      if (!res?.data) return;
      if (res.data === last) return;
      last = res.data;

      setResult(res.data);

      if (navigator.vibrate) navigator.vibrate(30);
    },
    { preferredCamera: facing }
  );

  await scanner.start();

  // get the underlying stream for focus/zoom attempts
  mediaStream = video.srcObject;

  await setupZoomUI();

  setResult("Camera on. Point at a QR code.");
}

scanBtn.addEventListener("click", async () => {
  try {
    await start();
  } catch {
    setResult("Camera failed. Check Safari camera permission.");
  }
});

flipBtn.addEventListener("click", async () => {
  facing = facing === "environment" ? "user" : "environment";
  last = "";
  await start();
});

copyBtn.addEventListener("click", async () => {
  if (!currentText) return;
  try {
    await navigator.clipboard.writeText(currentText);
    resultEl.textContent = "Copied to clipboard.";
    setTimeout(() => setResult(currentText), 900);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = currentText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    resultEl.textContent = "Copied.";
    setTimeout(() => setResult(currentText), 900);
  }
});

openBtn.addEventListener("click", () => {
  if (!isProbablyUrl(currentText)) return;
  window.open(currentText, "_blank", "noopener,noreferrer");
});

shareBtn.addEventListener("click", async () => {
  if (!currentText) return;

  if (navigator.share) {
    try {
      const data = isProbablyUrl(currentText)
        ? { title: "Reality Scanner", text: currentText, url: currentText }
        : { title: "Reality Scanner", text: currentText };
      await navigator.share(data);
    } catch {
      // user canceled
    }
  } else {
    // fallback: copy
    await navigator.clipboard.writeText(currentText);
    resultEl.textContent = "Share not supported here—copied instead.";
    setTimeout(() => setResult(currentText), 1100);
  }
});

// Tap-to-focus / exposure (best effort)
video.addEventListener("click", async (e) => {
  try {
    const track = mediaStream?.getVideoTracks?.()?.[0];
    if (!track) return;

    const caps = track.getCapabilities?.();
    if (!caps) return;

    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Some browsers support pointsOfInterest; many (incl iOS Safari) may not.
    await track.applyConstraints({
      advanced: [
        ...(caps.focusMode ? [{ focusMode: "continuous" }] : []),
        ...(caps.exposureMode ? [{ exposureMode: "continuous" }] : []),
        // Non-standard, may be ignored:
        { pointsOfInterest: [{ x, y }] },
      ],
    });

    if (navigator.vibrate) navigator.vibrate(10);
  } catch {
    // ignore if unsupported
  }
});

// Zoom slider
zoom.addEventListener("input", async () => {
  const v = Number(zoom.value);
  zoomVal.textContent = `${v.toFixed(1)}×`;
  await applyZoom(v);
});

// initialize button states
setButtons();