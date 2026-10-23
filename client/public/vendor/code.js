/*
 * Copy buttons on code blocks for published pages, which run no React: any `[data-np-copy]` button
 * copies the code in its `.np-code` block. The markup comes from shared/markdown/code-view.tsx.
 */
(function () {
  if (window.__npCodeCopy) return;
  window.__npCodeCopy = true;

  var RESET_MS = 1500;

  function show(button, words) {
    button.textContent = words;
    window.clearTimeout(button.__npReset);
    button.__npReset = window.setTimeout(function () {
      button.textContent = "Copy";
    }, RESET_MS);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-np-copy]") : null;
    if (!button) return;
    var block = button.closest(".np-code");
    var code = block ? block.querySelector("pre code") : null;
    if (!code) return;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      show(button, "Select and copy");
      return;
    }
    navigator.clipboard.writeText(code.textContent || "").then(
      function () {
        show(button, "Copied");
      },
      function () {
        show(button, "Select and copy");
      }
    );
  });
})();
