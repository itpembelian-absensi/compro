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
  bookWrap: document.querySelector(".book-wrap"),
  pager: document.getElementById("pager"),
  pagerImg: document.getElementById("pagerImg"),
};

let pageFlip = null;
let pageImages = [];
let zoom = 1;
let pageCount = 0;
let autoplay = false;
let autoplayTimer = null;
const AUTOPLAY_MS = 8000;

let singlePageMode = false;
let currentIndex = 0;
let paging = false;

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
  if (!singlePageMode && isNativeFullscreen() && pageImages[index]) {
    els.pagerImg.src = pageImages[index];
    els.pagerImg.alt = `Halaman ${human}`;
  }
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

function getIndex() {
  if (singlePageMode) return currentIndex;
  return pageFlip ? pageFlip.getCurrentPageIndex() : 0;
}

function turnNext() {
  if (singlePageMode) showSinglePage(currentIndex + 1, 1);
  else pageFlip?.flipNext();
}

function turnPrev() {
  if (singlePageMode) showSinglePage(currentIndex - 1, -1);
  else pageFlip?.flipPrev();
}

function goTo(index) {
  const from = getIndex();
  index = Math.max(0, Math.min(pageCount - 1, index));
  if (singlePageMode) {
    showSinglePage(index, index >= from ? 1 : -1);
    return;
  }
  pageFlip?.turnToPage(index);
  updateUi(index);
}

function flipAutoplayOnce() {
  if (!autoplay) return;
  const index = getIndex();
  if (index >= pageCount - 1) {
    goTo(0);
  } else {
    turnNext();
  }
  if (singlePageMode) scheduleAutoplay();
}

function scheduleAutoplay() {
  stopAutoplayTimer();
  if (!autoplay) return;
  if (!singlePageMode && !pageFlip) return;
  autoplayTimer = window.setTimeout(flipAutoplayOnce, AUTOPLAY_MS);
}

function applyZoom() {
  if (singlePageMode) {
    zoom = Math.min(2.2, Math.max(1, zoom));
    els.pager.style.setProperty("--zoom", String(zoom));
    els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    return;
  }
  zoom = Math.min(1.8, Math.max(0.7, zoom));
  els.bookWrap.style.setProperty("--zoom", String(zoom));
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function isNativeFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function syncFsOverlay() {
  const on = isNativeFullscreen();
  document.body.classList.toggle("fs-page", on);
  els.btnFullscreen.setAttribute("aria-label", on ? "Keluar layar penuh" : "Layar penuh");
  if (singlePageMode) return;
  els.pager.hidden = !on;
  if (on && pageImages.length) {
    const i = getIndex();
    els.pagerImg.src = pageImages[i];
    els.pagerImg.alt = `Halaman ${i + 1}`;
  }
}

async function toggleFullscreen() {
  const root = document.querySelector(".stage");
  try {
    if (isNativeFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (root.requestFullscreen) await root.requestFullscreen();
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
  } catch (err) {
    console.error(err);
  }
}

els.btnFullscreen.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleFullscreen();
});
document.addEventListener("fullscreenchange", syncFsOverlay);
document.addEventListener("webkitfullscreenchange", syncFsOverlay);

function isMobileView() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function showSinglePage(index, dir = 1) {
  if (index < 0 || index >= pageCount) return;
  if (paging) return;
  const first = !els.pagerImg.getAttribute("src");
  if (!first && index === currentIndex) {
    updateUi(index);
    return;
  }

  currentIndex = index;
  updateUi(index);

  if (first) {
    els.pagerImg.src = pageImages[index];
    els.pagerImg.alt = `Halaman ${index + 1}`;
    return;
  }

  paging = true;
  const img = els.pagerImg;
  img.classList.remove("in-left", "in-right", "out-left", "out-right");
  img.classList.add(dir > 0 ? "out-left" : "out-right");
  window.setTimeout(() => {
    img.src = pageImages[index];
    img.alt = `Halaman ${index + 1}`;
    img.classList.remove("out-left", "out-right");
    img.classList.add(dir > 0 ? "in-right" : "in-left");
    window.setTimeout(() => {
      img.classList.remove("in-left", "in-right");
      paging = false;
    }, 360);
  }, 160);
}

function setupSinglePage(images, startPage = 0) {
  singlePageMode = true;
  document.body.classList.add("pager-mode");
  els.pager.hidden = false;
  pageImages = images;
  pageCount = images.length;
  currentIndex = startPage;
  zoom = 1;
  applyZoom();
  showSinglePage(startPage, 1);
}

function bindPagerSwipe() {
  let startX = 0;
  let startY = 0;
  els.pager.addEventListener(
    "touchstart",
    (e) => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    },
    { passive: true }
  );
  els.pager.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      setAutoplay(false);
      if (dx < 0) turnNext();
      else turnPrev();
    },
    { passive: true }
  );
}

function isPortraitLayout() {
  return false;
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
  if (pageFlip) {
    try {
      pageFlip.destroy();
    } catch (_) {
      /* ignore */
    }
    pageFlip = null;
  }
  const next = document.createElement("div");
  next.id = "book";
  els.book.replaceWith(next);
  els.book = next;
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

async function main() {
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
  if (isMobileView()) {
    setupSinglePage(images, 0);
    bindPagerSwipe();
  } else {
    createFlipbook(images);
  }
  els.loader.hidden = true;
}

els.btnPrev.addEventListener("click", () => {
  setAutoplay(false);
  turnPrev();
});
els.btnNext.addEventListener("click", () => {
  setAutoplay(false);
  turnNext();
});
els.pageSlider.addEventListener("input", (e) => {
  setAutoplay(false);
  goTo(Number(e.target.value));
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

document.addEventListener("keydown", (e) => {
  if (!pageFlip && !singlePageMode) return;
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    setAutoplay(!autoplay);
    return;
  }
  if (e.key === "ArrowRight") {
    setAutoplay(false);
    turnNext();
  }
  if (e.key === "ArrowLeft") {
    setAutoplay(false);
    turnPrev();
  }
});

let wheelLock = false;
document.querySelector(".viewport").addEventListener(
  "wheel",
  (e) => {
    if (!pageFlip && !singlePageMode) return;
    const delta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 12) return;
    e.preventDefault();
    if (wheelLock) return;
    wheelLock = true;
    setAutoplay(false);
    if (delta > 0) turnNext();
    else turnPrev();
    window.setTimeout(() => {
      wheelLock = false;
    }, 700);
  },
  { passive: false }
);

main().catch((err) => {
  els.progressText.textContent =
    "Gagal memuat halaman. Refresh halaman, atau buka lewat http://127.0.0.1:8765/";
  console.error(err);
});
