# Contributing

Thanks for your interest in Anima.

1. Open an issue describing the change before large work.
2. Fork the repository and create a branch.
3. Keep logic that decides results in `assets/js/core.js` and add a case to `tests/cases.js`.
4. Run `node tests/run-node.js` and check the page in a WebGL2 browser.
5. Open a pull request. CI must pass.

Style: plain JavaScript, no dependencies, short functions, comments only where the reason is not obvious.
