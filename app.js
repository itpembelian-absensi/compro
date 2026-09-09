const els = {
  book: document.getElementById("book"),
  loader: document.getElementById("loader"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  pageLabel: document.getElementById("pageLabel"),
  pageSlider: document.getElementById("pageSlider"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnPlay: document.getElementById("btnPlay"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),
  zoomLabel: document.getElementById("zoomLabel"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  btnThumbs: document.getElementById("btnThumbs"),
  thumbs: document.getElementById("thumbs"),
  thumbsGrid: document.getElementById("thumbsGrid"),
  btnCloseThumbs: document.getElementById("btnCloseThumbs"),
  bookWrap: document.querySelector(".book-wrap"),
  pdfScroll: document.getElementById("pdfScroll"),
};

let pageFlip = null;
let pageImages = [];
let zoom = 1;
let pageCount = 0;
let autoplay = false;
let autoplayTimer = null;
const AUTOPLAY_MS = 8000;
const PDF_SRC = "./company-profile.pdf";

function setProgress(done, total, label) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressText.textContent = label || `${done} / ${total} halaman`;
}

function preload(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    img.src = src;
  });
}

function updateUi(index) {
  const human = index + 1;
  els.pageLabel.textContent = `Halaman ${human} / ${pageCount}`;
  els.pageSlider.value = String(index);
  els.btnPrev.disabled = index <= 0;
  els.btnNext.disabled = index >= pageCount - 1;
  [...els.thumbsGrid.querySelectorAll("button")].forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}

function syncPlayButton() {
  els.btnPlay.setAttribute("aria-pressed", String(autoplay));
  els.btnPlay.querySelector(".play-icon").textContent = autoplay ? "❚❚" : "▶";
  els.btnPlay.querySelector(".play-text").textContent = autoplay ? "Jeda" : "Putar";
  els.btnPlay.setAttribute(
    "aria-label",
    autoplay ? "Jeda putar otomatis" : "Putar otomatis"
  );
}

function stopAutoplayTimer() {
  if (autoplayTimer) {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

function setAutoplay(on) {
  autoplay = Boolean(on);
  stopAutoplayTimer();
  syncPlayButton();
  if (autoplay) scheduleAutoplay();
}

function flipAutoplayOnce() {
  if (!autoplay || !pageFlip) return;
  const index = pageFlip.getCurrentPageIndex();
  if (index >= pageCount - 1) {
    pageFlip.turnToPage(0);
    updateUi(0);
    scheduleAutoplay();
    return;
  }
  pageFlip.flipNext();
}

function scheduleAutoplay() {
  stopAutoplayTimer();
  if (!autoplay || !pageFlip) return;
  autoplayTimer = window.setTimeout(flipAutoplayOnce, AUTOPLAY_MS);
}

function applyZoom() {
  const maxZoom = isPortraitLayout() ? 2.4 : 1.8;
  const minZoom = isPortraitLayout() ? 1 : 0.7;
  zoom = Math.min(maxZoom, Math.max(minZoom, zoom));
  els.bookWrap.style.setProperty("--zoom", String(zoom));
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  els.bookWrap.classList.toggle("zoomed", zoom > 1);
}

function preferPdfViewer() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Gagal memuat PDF.js"));
    document.head.appendChild(script);
  });
}

async function renderPdfPage(pdf, pageNumber, cssWidth) {
  const page = await pdf.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale: (cssWidth * dpr) / unscaled.width });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  await page.render({
    canvasContext: canvas.getContext("2d", { alpha: false }),
    viewport,
  }).promise;
  return canvas;
}

async function showPdfViewer() {
  document.body.classList.add("pdf-mode");
  els.pdfScroll.hidden = false;
  setProgress(0, 1, "Membuka PDF…");

  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument(PDF_SRC).promise;
  const cssWidth = Math.max(
    280,
    (els.pdfScroll.clientWidth || window.innerWidth) - 16
  );

  const first = Math.min(2, pdf.numPages);
  for (let i = 1; i <= first; i++) {
    els.pdfScroll.appendChild(await renderPdfPage(pdf, i, cssWidth));
    setProgress(i, pdf.numPages, `Memuat halaman ${i} / ${pdf.numPages}`);
  }
  els.loader.hidden = true;

  for (let i = first + 1; i <= pdf.numPages; i++) {
    els.pdfScroll.appendChild(await renderPdfPage(pdf, i, cssWidth));
  }
}

function isPortraitLayout() {
  const view = document.querySelector(".viewport").getBoundingClientRect();
  return view.width < 820 || view.width < view.height * 1.05;
}

function bookSize() {
  const view = document.querySelector(".viewport").getBoundingClientRect();
  if (isPortraitLayout()) {
    return Math.max(220, Math.floor(Math.min(view.width - 12, view.height - 8)));
  }
  const page = Math.min(view.width / 2, view.height) * 0.92;
  return Math.max(240, Math.floor(page));
}

function applyBookLayout() {
  const size = bookSize();
  const portrait = isPortraitLayout();
  els.book.style.width = `${portrait ? size : size * 2}px`;
  els.book.style.height = `${size}px`;
  els.bookWrap.style.setProperty("--book-w", `${portrait ? size : size * 2}px`);
  els.bookWrap.style.setProperty("--book-h", `${size}px`);
  document.body.classList.toggle("portrait-book", portrait);
  return size;
}

function destroyFlipbook() {
  if (!pageFlip) return;
  try {
    pageFlip.destroy();
  } catch (_) {
    /* ignore */
  }
  pageFlip = null;
  els.book.innerHTML = "";
}

function createFlipbook(images, startPage = 0) {
  destroyFlipbook();
  const size = applyBookLayout();
  pageFlip = new St.PageFlip(els.book, {
    width: size,
    height: size,
    size: "fixed",
    showCover: true,
    drawShadow: true,
    flippingTime: isPortraitLayout() ? 700 : 1400,
    usePortrait: true,
    autoSize: false,
    maxShadowOpacity: 0.45,
    mobileScrollSupport: false,
    useMouseEvents: true,
    swipeDistance: 24,
    startPage: Math.min(Math.max(0, startPage), images.length - 1),
  });

  pageFlip.loadFromImages(images);

  pageFlip.on("flip", (e) => {
    updateUi(e.data);
    if (autoplay) scheduleAutoplay();
  });
  pageFlip.on("changeState", () => {
    if (pageFlip) updateUi(pageFlip.getCurrentPageIndex());
  });

  updateUi(pageFlip.getCurrentPageIndex());
}

function buildThumbs(images) {
  images.forEach((src, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Halaman ${i + 1}`;
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      setAutoplay(false);
      pageFlip.turnToPage(i);
      updateUi(i);
      setThumbsOpen(false);
    });
    els.thumbsGrid.appendChild(btn);
  });
}

async function main() {
  if (preferPdfViewer()) {
    await showPdfViewer();
    return;
  }

  setProgress(0, 1, "Membaca daftar halaman…");
  const manifest = await fetch("./pages.json").then((res) => {
    if (!res.ok) throw new Error("pages.json belum ada");
    return res.json();
  });

  const images = manifest.pages;
  pageImages = images;
  pageCount = images.length;
  els.pageSlider.max = String(pageCount - 1);
  els.pageSlider.disabled = false;

  let loaded = 0;
  await Promise.all(
    images.map((src) =>
      preload(src).then(() => {
        loaded += 1;
        setProgress(loaded, pageCount, `Memuat halaman ${loaded} / ${pageCount}`);
      })
    )
  );

  setProgress(pageCount, pageCount, "Membuka buku…");
  createFlipbook(images);
  buildThumbs(images);
  els.loader.hidden = true;
}

els.btnPrev.addEventListener("click", () => {
  setAutoplay(false);
  pageFlip?.flipPrev();
});
els.btnNext.addEventListener("click", () => {
  setAutoplay(false);
  pageFlip?.flipNext();
});
els.pageSlider.addEventListener("input", (e) => {
  setAutoplay(false);
  const index = Number(e.target.value);
  pageFlip?.turnToPage(index);
  updateUi(index);
});
els.btnPlay.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  setAutoplay(!autoplay);
});

els.btnZoomIn.addEventListener("click", () => {
  zoom = +(zoom + 0.2).toFixed(1);
  applyZoom();
});
els.btnZoomOut.addEventListener("click", () => {
  zoom = +(zoom - 0.2).toFixed(1);
  applyZoom();
});

els.btnFullscreen.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

function setThumbsOpen(open) {
  els.thumbs.hidden = !open;
  els.btnThumbs.setAttribute("aria-pressed", String(open));
}

els.btnThumbs.addEventListener("click", () => {
  setThumbsOpen(els.thumbs.hidden);
});
els.btnCloseThumbs.addEventListener("click", () => setThumbsOpen(false));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    setThumbsOpen(false);
    return;
  }
  if (!pageFlip) return;
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    setAutoplay(!autoplay);
    return;
  }
  if (e.key === "ArrowRight") {
    setAutoplay(false);
    pageFlip.flipNext();
  }
  if (e.key === "ArrowLeft") {
    setAutoplay(false);
    pageFlip.flipPrev();
  }
});

let wheelLock = false;
document.querySelector(".viewport").addEventListener(
  "wheel",
  (e) => {
    if (!pageFlip) return;
    if (els.thumbs.contains(e.target)) return;
    const delta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 12) return;
    e.preventDefault();
    if (wheelLock) return;
    wheelLock = true;
    setAutoplay(false);
    if (delta > 0) pageFlip.flipNext();
    else pageFlip.flipPrev();
    window.setTimeout(() => {
      wheelLock = false;
    }, 700);
  },
  { passive: false }
);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  if (!pageFlip || !pageImages.length) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const index = pageFlip.getCurrentPageIndex();
    createFlipbook(pageImages, index);
    applyZoom();
  }, 180);
});

main().catch((err) => {
  els.progressText.textContent =
    "Gagal memuat halaman. Refresh halaman, atau buka lewat http://127.0.0.1:8765/";
  console.error(err);
});
