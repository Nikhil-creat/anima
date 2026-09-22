# Anima — A GPU laboratory for artificial life

[![Test and deploy](https://github.com/Nikhil-creat/anima/actions/workflows/pages.yml/badge.svg)](https://github.com/Nikhil-creat/anima/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0B7F6E.svg)](LICENSE)
![WebGL2](https://img.shields.io/badge/WebGL-2.0-19C3B1)
![No dependencies](https://img.shields.io/badge/dependencies-none-0D3B6B)

**Live demo:** https://Nikhil-creat.github.io/anima/

## Designed and developed by 
# **★NIKHIL CHARY SRIRAMOJU★**
BTech CSE (Final Year)

- GitHub: [Nikhil-creat](https://github.com/Nikhil-creat)
- LinkedIn: [nikhil-chary-sriramoju](https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a)
- Email: sriramojunikhil66@gmail.com
- Instagram: [@nikhil__sriramoju](https://www.instagram.com/nikhil__sriramoju)
- Facebook: [Profile](https://www.facebook.com/profile.php?id=100079201124141)

Anima simulates continuous cellular automata ([Lenia](https://arxiv.org/abs/1812.05433)) on the GPU with WebGL2,
maps where self-organizing life exists in parameter space, and breeds new genomes with an evolutionary search.
Everything runs in the browser. There is no server, no framework and no build step.

![Anima screenshot](docs/screenshot.png)

## Highlights

| Capability | Detail |
|---|---|
| Real-time simulation | Fragment-shader kernel convolution in 32-bit float textures, up to 256 × 256 |
| Interactive dish | Paint or erase cells while the simulation runs |
| Phase map | Survey of 144 genomes, each classified as extinct, static, saturated or alive |
| Discover | Ten-generation mutation and selection loop that scores each genome on a full GPU trial |
| Genome library | Save, load, export and import genomes as JSON; share any genome by URL |
| Reproducibility | Seeded random number generator, experiment export to CSV |
| Benchmark | Measures steps per second and billions of kernel taps per second on your GPU |
| Quality | Dependency-free tested core, CI, automatic deployment |

## Quick start

Open `index.html` in a browser that supports WebGL2, or visit the live demo.
For local development serve the folder, for example `python3 -m http.server`.

## Tests

```bash
node tests/run-node.js        # runs in Node 18+, no dependencies
```

You can also open `tests/index.html` in a browser. Both use the same cases in `tests/cases.js`.

## Repository layout

```
index.html            the lab
assets/css/style.css  styling
assets/js/core.js     pure, tested logic (kernel, seeding, classifier)
assets/js/app.js      WebGL2 rendering and interface
tests/                unit tests for browser and CI
docs/                 architecture and methodology
.github/workflows/    test, then deploy to GitHub Pages
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Methodology and limits](docs/METHODOLOGY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Limitations

Anima builds on Lenia, which was created by Bert Wang-Chak Chan. This project's contribution is the interactive
GPU implementation, the survey and search tooling, and the engineering around it. The alive-or-not classifier is
a heuristic, and outcomes depend on the random seed and the number of trial steps.

## Roadmap

- Multi-channel state so several species can compete
- Kernel and growth-function editor
- Larger grids using tiled rendering
- A short study of how often each region of the phase map is alive across many seeds

## Citation

See [CITATION.cff](CITATION.cff). GitHub shows a "Cite this repository" button automatically.

## License

MIT. See [LICENSE](LICENSE).
