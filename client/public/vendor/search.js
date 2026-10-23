/*
 * Site search for published pages, which run no React. Any `[data-np-search]` button (the Search
 * block) opens a search window, as does Ctrl/⌘ + K unless the reader is typing in a field. The
 * markup of the button comes from shared/blocks/search-view.tsx, the styles from search-css.ts.
 * Results come from GET /api/public/search; the server does the searching.
 */
(function () {
  if (window.__npSearch) return;
  window.__npSearch = true;

  var DEBOUNCE_MS = 200;
  var NO_MATCH = "No pages match that.";
  var BROKEN = "Search isn't working right now. Try again in a moment.";
  var dialog = null;
  var input = null;
  var list = null;
  var status = null;
  var results = [];
  var active = -1;
  var timer = 0;
  var controller = null;
  var requestNumber = 0;

  var isApple = /Mac|iPhone|iPad|iPod/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ""
  );

  function markShortcutHints() {
    if (!isApple) return;
    var hints = document.querySelectorAll("[data-np-search-kbd]");
    for (var i = 0; i < hints.length; i++) hints[i].textContent = "⌘K";
  }

  function make(tag, className, attributes) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    for (var name in attributes || {}) node.setAttribute(name, attributes[name]);
    return node;
  }

  function build() {
    dialog = make("dialog", "np-search-dialog", { "aria-label": "Search" });
    var bar = make("div", "np-search-dialog__bar");
    bar.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';
    input = make("input", "np-search-dialog__input", {
      type: "search",
      role: "combobox",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      "aria-label": "Search",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": "np-search-results",
    });
    var close = make("button", "np-search-dialog__close", { type: "button", "aria-label": "Close search" });
    close.textContent = "Esc";
    close.addEventListener("click", function () {
      dialog.close();
    });
    bar.appendChild(input);
    bar.appendChild(close);
    list = make("ul", "np-search-dialog__results", { id: "np-search-results", role: "listbox", "aria-label": "Search results" });
    status = make("p", "np-search-dialog__status", { role: "status", "aria-live": "polite" });
    dialog.appendChild(bar);
    dialog.appendChild(list);
    dialog.appendChild(status);
    document.body.appendChild(dialog);

    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(runSearch, DEBOUNCE_MS);
    });
    input.addEventListener("keydown", onInputKey);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      window.clearTimeout(timer);
      if (controller) controller.abort();
    });
  }

  function setActive(index) {
    var options = list.children;
    if (active >= 0 && options[active]) options[active].firstChild.setAttribute("aria-selected", "false");
    active = index;
    if (index < 0 || !options[index]) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    var link = options[index].firstChild;
    link.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", link.id);
    if (link.scrollIntoView) link.scrollIntoView({ block: "nearest" });
  }

  function onInputKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(active + 1 >= results.length ? 0 : active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(active - 1 < 0 ? results.length - 1 : active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      list.children[active >= 0 ? active : 0].firstChild.click();
    }
  }

  function show(message) {
    status.textContent = message;
  }

  function render(items) {
    results = items;
    list.textContent = "";
    input.setAttribute("aria-expanded", items.length ? "true" : "false");
    items.forEach(function (item, index) {
      var row = make("li", "", { role: "presentation" });
      var link = make("a", "np-search-dialog__result", {
        href: item.path,
        role: "option",
        id: "np-search-result-" + index,
        "aria-selected": "false",
        tabindex: "-1",
      });
      var title = make("span", "np-search-dialog__title");
      title.textContent = item.title;
      link.appendChild(title);
      if (item.snippet) {
        var snippet = make("span", "np-search-dialog__snippet");
        snippet.textContent = item.snippet;
        link.appendChild(snippet);
      }
      row.appendChild(link);
      list.appendChild(row);
    });
    active = -1;
    input.removeAttribute("aria-activedescendant");
    show(items.length ? "" : NO_MATCH);
  }

  function runSearch() {
    var query = input.value.trim();
    if (controller) controller.abort();
    if (!query) {
      render([]);
      show("");
      return;
    }
    var number = ++requestNumber;
    controller = typeof AbortController === "function" ? new AbortController() : null;
    var options = controller ? { signal: controller.signal, headers: { Accept: "application/json" } } : {};
    fetch("/api/public/search?q=" + encodeURIComponent(query), options)
      .then(function (response) {
        return response.json().then(
          function (body) {
            return { ok: response.ok, body: body };
          },
          function () {
            return { ok: false, body: null };
          }
        );
      })
      .then(function (answer) {
        if (number !== requestNumber) return;
        if (!answer.ok || !answer.body || !Array.isArray(answer.body.results)) {
          render([]);
          show(answer.body && typeof answer.body.message === "string" ? answer.body.message : BROKEN);
          return;
        }
        render(answer.body.results);
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") return;
        if (number !== requestNumber) return;
        render([]);
        show(BROKEN);
      });
  }

  function openSearch(placeholder) {
    if (!dialog) build();
    if (dialog.open) return;
    input.setAttribute("placeholder", placeholder || "Search this site");
    input.value = "";
    render([]);
    show("");
    dialog.showModal();
    input.focus();
  }

  function isTypingTarget(node) {
    if (!node || !node.tagName) return false;
    var tag = node.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || node.isContentEditable === true;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-np-search]") : null;
    if (!button) return;
    openSearch(button.getAttribute("data-placeholder"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "k" && event.key !== "K") return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    if (isTypingTarget(event.target)) return;
    var button = document.querySelector("[data-np-search]");
    if (!button) return;
    event.preventDefault();
    openSearch(button.getAttribute("data-placeholder"));
  });

  markShortcutHints();
})();
