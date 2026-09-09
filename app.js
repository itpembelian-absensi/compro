const els = {
  book: document.getElementById("book"),
  loader: document.getElementById("loader"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  pageLabel: document.getElementById("pageLabel"),
  pageSlider: document.getElementById("pageSlider"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),
  zoomLabel: document.getElementById("zoomLabel"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  btnThumbs: document.getElementById("btnThumbs"),
  thumbs: document.getElementById("thumbs"),
  thumbsGrid: document.getElementById("thumbsGrid"),
  btnCloseThumbs: document.getElementById("btnCloseThumbs"),
  bookWrap: document.querySelector(".book-wrap"),
};

let pageFlip = null;
let zoom = 1;
let pageCount = 0;

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

function applyZoom() {
  els.bookWrap.style.setProperty("--zoom", String(zoom));
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function bookSize() {
  const view = document.querySelector(".viewport").getBoundingClientRect();
  const page = Math.min(view.width / 2, view.height) * 0.9;
  return Math.max(240, Math.floor(page));
}

function applyBookLayout() {
  const size = bookSize();
  els.book.style.width = `${size * 2}px`;
  els.book.style.height = `${size}px`;
  return size;
}

function createFlipbook(images) {
  const size = applyBookLayout();
  pageFlip = new St.PageFlip(els.book, {
    width: size,
    height: size,
    size: "fixed",
    showCover: true,
    drawShadow: true,
    flippingTime: 900,
    usePortrait: true,
    autoSize: false,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
    useMouseEvents: true,
    swipeDistance: 28,
    startPage: 0,
  });

  pageFlip.loadFromImages(images);

  pageFlip.on("flip", (e) => updateUi(e.data));
  pageFlip.on("changeState", () => {
    if (pageFlip) updateUi(pageFlip.getCurrentPageIndex());
  });

  updateUi(0);
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
      pageFlip.turnToPage(i);
      updateUi(i);
      setThumbsOpen(false);
    });
    els.thumbsGrid.appendChild(btn);
  });
}

async function main() {
  setProgress(0, 1, "Membaca daftar halaman…");
  const manifest = await fetch("./pages.json").then((res) => {
    if (!res.ok) throw new Error("pages.json belum ada");
    return res.json();
  });

  const images = manifest.pages;
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

els.btnPrev.addEventListener("click", () => pageFlip?.flipPrev());
els.btnNext.addEventListener("click", () => pageFlip?.flipNext());
els.pageSlider.addEventListener("input", (e) => {
  const index = Number(e.target.value);
  pageFlip?.turnToPage(index);
  updateUi(index);
});

els.btnZoomIn.addEventListener("click", () => {
  zoom = Math.min(1.8, +(zoom + 0.1).toFixed(1));
  applyZoom();
});
els.btnZoomOut.addEventListener("click", () => {
  zoom = Math.max(0.7, +(zoom - 0.1).toFixed(1));
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
  if (e.key === "ArrowRight") pageFlip.flipNext();
  if (e.key === "ArrowLeft") pageFlip.flipPrev();
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
    if (delta > 0) pageFlip.flipNext();
    else pageFlip.flipPrev();
    window.setTimeout(() => {
      wheelLock = false;
    }, 700);
  },
  { passive: false }
);

window.addEventListener("resize", () => {
  if (!pageFlip) return;
  updateUi(pageFlip.getCurrentPageIndex());
});

main().catch((err) => {
  els.progressText.textContent =
    "Gagal memuat halaman. Refresh halaman, atau buka lewat http://127.0.0.1:8765/";
  console.error(err);
});
