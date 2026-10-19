# Machine Learning 2026 · Week 05 interactive labs

Interactive companions to the Week 05 lecture notes (Chapter 5 Kernel Methods, Chapter 6 Support Vector Machines).

- `index.html`: landing page
- `kernels.html`: feature maps, the kernel trick, kernels as similarity, valid kernels, cost
- `svm.html`: margins, optimal margin classifier, duality and KKT, soft margin, kernel SVMs, SMO

The published pages are built from `src/`. Edit the sources, then rebuild:

```sh
python3 build.py
```

`build.py` inlines `src/lab.css` and `src/lab.js` so every page is a single self-contained HTML file. GitHub Pages serves the repository root.
