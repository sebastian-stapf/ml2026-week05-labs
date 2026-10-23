#!/usr/bin/env python3
"""Inline the shared CSS/JS into each lab page so every page is one self-contained HTML file.

Usage:
  python3 build.py                                  # cross-links point to the sibling .html files
  python3 build.py --kernels-url URL --svm-url URL --home-url "#top" --out hosted  # copies whose cross-links point to hosted pages
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

ap = argparse.ArgumentParser()
ap.add_argument("--kernels-url", default="kernels.html")
ap.add_argument("--svm-url", default="svm.html")
ap.add_argument("--home-url", default="./", help="where the header logo links to")
ap.add_argument("--out", default=".", help="output folder, relative to this script")
args = ap.parse_args()

css = (SRC / "lab.css").read_text()
js = (SRC / "lab.js").read_text()

pages = ("index",)  # the labs moved to ml2026-week05-kernels and ml2026-week05-svm
for name in pages:
    page = (SRC / f"{name}.src.html").read_text()
    page = page.replace("<!-- @inline lab.css -->", f"<style>\n{css}\n</style>")
    page = page.replace("<!-- @inline lab.js -->", f"<script>\n{js}\n</script>")
    page = page.replace("{{KERNELS_URL}}", args.kernels_url).replace("{{SVM_URL}}", args.svm_url).replace("{{HOME_URL}}", args.home_url)
    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.html").write_text(page)
    print(f"wrote {args.out}/{name}.html ({len(page) // 1024} KB)")
