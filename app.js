const els = {
  book: document.getElementById("book"),
  loader: document.getElementById("loader"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  pageSlider: document.getElementById("pageSlider"),
  pageSliderThumb: document.getElementById("pageSliderThumb"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  bookWrap: document.querySelector(".book-wrap"),
  pager: document.getElementById("pager"),
  pagerImg: document.getElementById("pagerImg"),
  pagerUnder: document.getElementById("pagerUnder"),
  pagerZoom: document.getElementById("pagerZoom"),
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
let desktopPagerIndex = 0;
let paging = false;
let panX = 0;
let panY = 0;
let pagerPinching = false;
const PAGER_MIN_ZOOM = 0.7;
const PAGER_MAX_ZOOM = 3.4;
const DESKTOP_MIN_ZOOM = 1;
const DESKTOP_MAX_ZOOM = 1.2;
const DESKTOP_ZOOM_STEP = 0.06;

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

function syncSliderThumb() {
  const el = els.pageSlider;
  const thumb = els.pageSliderThumb;
  if (!el || !thumb) return;
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 0;
  const val = Number(el.value) || 0;
  const pct = max <= min ? 0 : (val - min) / (max - min);
  const track = el.parentElement.clientWidth;
  const thumbW = thumb.offsetWidth || 48;
  const x = Math.max(0, (track - thumbW) * pct);
  thumb.style.transform = `translateX(${x}px)`;
}

function updateUi(index) {
  const human = index + 1;
  els.pageSlider.value = String(index);
  syncSliderThumb();
  els.btnPrev.disabled = index <= 0;
  els.btnNext.disabled = index >= pageCount - 1;
  if (!singlePageMode && isDesktopPager() && pageImages[index] && !paging) {
    els.pagerImg.src = pageImages[index];
    els.pagerImg.alt = `Halaman ${human}`;
    if (els.pagerUnder) {
      els.pagerUnder.src = pageImages[index];
      els.pagerUnder.alt = `Halaman ${human}`;
    }
  }
}

function setAutoplay(on) {
  autoplay = Boolean(on);
  stopAutoplayTimer();
  if (autoplay) scheduleAutoplay();
}

function stopAutoplayTimer() {
  if (autoplayTimer) {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

function isDesktopPager() {
  return !singlePageMode && (isNativeFullscreen() || zoom > 1.02);
}

function syncDesktopOverlay() {
  if (singlePageMode) return;
  const on = isDesktopPager();
  if (on && els.pager.hidden) {
    desktopPagerIndex = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
  }
  document.body.classList.toggle("page-zoom", zoom > 1.02);
  els.pager.hidden = !on;
  if (!on && els.pagerZoom) {
    els.pagerZoom.style.width = "";
    els.pagerZoom.style.height = "";
  }
  if (on && pageImages.length && !paging) {
    const i = getIndex();
    els.pagerImg.src = pageImages[i];
    els.pagerImg.alt = `Halaman ${i + 1}`;
    if (els.pagerUnder) {
      els.pagerUnder.src = pageImages[i];
      els.pagerUnder.alt = `Halaman ${i + 1}`;
    }
  }
  layoutDesktopZoomPage();
}

function layoutDesktopZoomPage() {
  if (singlePageMode || !els.pagerZoom || !isDesktopPager()) return;
  const view = document.querySelector(".viewport").getBoundingClientRect();
  const fit = Math.min(Math.max(200, view.width - 16), Math.max(200, view.height - 12));
  const ratio = Math.min(0.97, 0.9 + (zoom - 1) * 0.9);
  const side = Math.max(180, Math.floor(fit * ratio));
  els.pagerZoom.style.width = `${side}px`;
  els.pagerZoom.style.height = `${side}px`;
}

function getIndex() {
  if (singlePageMode) return currentIndex;
  if (isDesktopPager()) return desktopPagerIndex;
  return pageFlip ? pageFlip.getCurrentPageIndex() : 0;
}

function turnNext() {
  if (singlePageMode) {
    showSinglePage(currentIndex + 1, 1);
    return;
  }
  if (isDesktopPager()) {
    const i = getIndex();
    if (i >= pageCount - 1) return;
    flipPagerTo(i + 1, 1);
    desktopPagerIndex = i + 1;
    pageFlip?.turnToPage(desktopPagerIndex);
    return;
  }
  pageFlip?.flipNext();
}

function turnPrev() {
  if (singlePageMode) {
    showSinglePage(currentIndex - 1, -1);
    return;
  }
  if (isDesktopPager()) {
    const i = getIndex();
    if (i <= 0) return;
    flipPagerTo(i - 1, -1);
    desktopPagerIndex = i - 1;
    pageFlip?.turnToPage(desktopPagerIndex);
    return;
  }
  pageFlip?.flipPrev();
}

function goTo(index) {
  const from = getIndex();
  index = Math.max(0, Math.min(pageCount - 1, index));
  if (singlePageMode) {
    showSinglePage(index, index >= from ? 1 : -1);
    return;
  }
  if (isDesktopPager()) {
    flipPagerTo(index, index >= from ? 1 : -1);
    desktopPagerIndex = index;
    pageFlip?.turnToPage(index);
    updateUi(index);
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
  if (singlePageMode || isDesktopPager()) scheduleAutoplay();
}

function scheduleAutoplay() {
  stopAutoplayTimer();
  if (!autoplay) return;
  if (!singlePageMode && !pageFlip) return;
  autoplayTimer = window.setTimeout(flipAutoplayOnce, AUTOPLAY_MS);
}

function applyZoom() {
  if (singlePageMode) {
    zoom = Math.min(PAGER_MAX_ZOOM, Math.max(PAGER_MIN_ZOOM, zoom));
    if (!pagerPinching && Math.abs(zoom - 1) <= 0.03) {
      zoom = 1;
      panX = 0;
      panY = 0;
    }
    if (zoom <= 1.05) {
      panX = 0;
      panY = 0;
    } else {
      clampPagerPan();
    }
    const zoomRoot = els.pagerZoom || els.pager;
    zoomRoot.style.setProperty("--zoom", String(zoom));
    zoomRoot.style.setProperty("--pan-x", `${panX}px`);
    zoomRoot.style.setProperty("--pan-y", `${panY}px`);
    return;
  }
  zoom = Math.min(DESKTOP_MAX_ZOOM, Math.max(DESKTOP_MIN_ZOOM, zoom));
  if (zoom <= 1.02) zoom = 1;
  els.bookWrap.style.setProperty("--zoom", "1");
  fitBookInViewport();
  syncDesktopOverlay();
}

function resetPagerZoom() {
  zoom = 1;
  panX = 0;
  panY = 0;
  if (singlePageMode) applyZoom();
}

function isNativeFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function syncFsOverlay() {
  const on = isNativeFullscreen();
  document.body.classList.toggle("fs-page", on);
  els.btnFullscreen.setAttribute("aria-label", on ? "Keluar layar penuh" : "Layar penuh");
  if (singlePageMode) return;
  syncDesktopOverlay();
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

function flipPagerTo(index, dir = 1) {
  if (index < 0 || index >= pageCount) return;
  if (paging) return;
  const sheet = els.pagerImg;
  const under = els.pagerUnder;
  const first = !sheet.getAttribute("src");

  if (first) {
    sheet.src = pageImages[index];
    sheet.alt = `Halaman ${index + 1}`;
    if (under) under.src = pageImages[index];
    currentIndex = index;
    updateUi(index);
    return;
  }

  if (index === (singlePageMode ? currentIndex : getIndex()) && dir) {
    updateUi(index);
    return;
  }

  paging = true;
  if (under) {
    under.src = pageImages[index];
    under.alt = `Halaman ${index + 1}`;
  }
  sheet.classList.remove("flip-next", "flip-prev");
  void sheet.offsetWidth;
  sheet.classList.add(dir > 0 ? "flip-next" : "flip-prev");

  window.setTimeout(() => {
    sheet.src = pageImages[index];
    sheet.alt = `Halaman ${index + 1}`;
    sheet.classList.remove("flip-next", "flip-prev");
    if (singlePageMode) currentIndex = index;
    updateUi(index);
    paging = false;
  }, 680);
}

function showSinglePage(index, dir = 1) {
  if (index < 0 || index >= pageCount) return;
  if (paging) return;
  if (index === currentIndex && els.pagerImg.getAttribute("src")) {
    updateUi(index);
    return;
  }
  flipPagerTo(index, dir);
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

function clampPagerPan() {
  const view = els.pager.getBoundingClientRect();
  const extraX = Math.max(0, (view.width * (zoom - 1)) / 2);
  const extraY = Math.max(0, (view.height * (zoom - 1)) / 2);
  panX = Math.min(extraX, Math.max(-extraX, panX));
  panY = Math.min(extraY, Math.max(-extraY, panY));
}

function bindPagerSwipe() {
  let startX = 0;
  let startY = 0;
  let startZoom = 1;
  let startDist = 0;
  let startPanX = 0;
  let startPanY = 0;
  let panning = false;

  const pinchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const beginPinch = (touches) => {
    pagerPinching = true;
    panning = false;
    startZoom = zoom;
    startDist = Math.max(pinchDistance(touches), 1);
    setAutoplay(false);
  };

  els.pager.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length >= 2) {
        beginPinch(e.touches);
        return;
      }
      pagerPinching = false;
      panning = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startPanX = panX;
      startPanY = panY;
    },
    { passive: true }
  );

  els.pager.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        if (!pagerPinching || startDist < 8) beginPinch(e.touches);
        zoom = startZoom * (pinchDistance(e.touches) / startDist);
        applyZoom();
        return;
      }
      if (zoom > 1.05) {
        e.preventDefault();
        panning = true;
        panX = startPanX + (e.touches[0].clientX - startX);
        panY = startPanY + (e.touches[0].clientY - startY);
        applyZoom();
      }
    },
    { passive: false }
  );

  els.pager.addEventListener(
    "touchend",
    (e) => {
      if (pagerPinching) {
        if (e.touches.length < 2) {
          pagerPinching = false;
          applyZoom();
        }
        return;
      }
      if (panning || zoom > 1.05) {
        panning = false;
        return;
      }
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
  const availW = Math.max(200, view.width - 24);
  const availH = Math.max(200, view.height - 24);
  return Math.max(160, Math.floor(Math.min(availW / 2, availH)));
}

function fitBookInViewport() {
  if (singlePageMode || !els.bookWrap) return;
  const view = document.querySelector(".viewport").getBoundingClientRect();
  const w = els.book.offsetWidth || parseFloat(els.book.style.width) || 1;
  const h = els.book.offsetHeight || parseFloat(els.book.style.height) || 1;
  const scale = Math.max(0.25, Math.min(1, (view.width - 12) / w, (view.height - 12) / h));
  els.bookWrap.style.setProperty("--scale", String(scale));
}

function applyBookLayout() {
  const size = bookSize();
  els.book.style.width = `${size * 2}px`;
  els.book.style.height = `${size}px`;
  els.bookWrap.style.setProperty("--book-w", `${size * 2}px`);
  els.bookWrap.style.setProperty("--book-h", `${size}px`);
  document.body.classList.remove("portrait-book");
  fitBookInViewport();
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
    flippingTime: 1400,
    usePortrait: false,
    autoSize: false,
    maxShadowOpacity: 0.45,
    mobileScrollSupport: false,
    useMouseEvents: true,
    swipeDistance: 24,
    startPage: Math.min(Math.max(0, startPage), images.length - 1),
  });

  pageFlip.loadFromImages(images);
  fitBookInViewport();

  pageFlip.on("flip", (e) => {
    if (isDesktopPager()) {
      if (autoplay) scheduleAutoplay();
      return;
    }
    updateUi(e.data);
    if (autoplay) scheduleAutoplay();
  });
  pageFlip.on("changeState", () => {
    if (isDesktopPager()) return;
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
  syncSliderThumb();

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

window.addEventListener("resize", () => {
  syncSliderThumb();
  if (singlePageMode) return;
  fitBookInViewport();
  layoutDesktopZoomPage();
});

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
  syncSliderThumb();
  goTo(Number(e.target.value));
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
