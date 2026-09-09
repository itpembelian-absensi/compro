from pathlib import Path
import json
import fitz

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "company-profile.pdf"
OUT = ROOT / "pages"
MANIFEST = ROOT / "pages.json"

OUT.mkdir(exist_ok=True)

doc = fitz.open(PDF)
# ~150 DPI: sharp enough for the book, much smaller than live PDF.js render
matrix = fitz.Matrix(150 / 72, 150 / 72)
files = []

for i, page in enumerate(doc, start=1):
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    name = f"page-{i:02d}.jpg"
    dest = OUT / name
    dest.write_bytes(pix.tobytes("jpeg", jpg_quality=78))
    files.append(f"pages/{name}")
    print(f"{i}/{doc.page_count} {dest.name} {dest.stat().st_size // 1024} KB", flush=True)

MANIFEST.write_text(json.dumps({"pages": files}, indent=2), encoding="utf-8")
print(f"done {len(files)} pages", flush=True)
