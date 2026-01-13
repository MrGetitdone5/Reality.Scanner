import QrScanner from "https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js";

const video = document.querySelector("video");
const resultEl = document.querySelector("#result");
const scanBtn = document.querySelector("#scanBtn");
const flipBtn = document.querySelector("#flipBtn");

let scanner;
let last = "";
let facing = "environment";

function setResult(text){
  resultEl.textContent = text;
}

async function start(){
  if (scanner) scanner.destroy();

  scanner = new QrScanner(
    video,
    (res) => {
      if (!res?.data) return;
      if (res.data === last) return;
      last = res.data;
      setResult(`QR Found: ${res.data}`);
      // optional: stop after first successful scan
      // scanner.stop();
      if (navigator.vibrate) navigator.vibrate(30);
    },
    { preferredCamera: facing }
  );

  await scanner.start();
  setResult("Camera on. Point at a QR code.");
}

scanBtn.addEventListener("click", async () => {
  try { await start(); }
  catch (e){ setResult("Camera failed. Allow camera permission in Safari settings."); }
});

flipBtn.addEventListener("click", async () => {
  facing = (facing === "environment") ? "user" : "environment";
  await start();
});

// Auto-start on load (optional)
// start().catch(()=>setResult("Tap SCAN to start."));
