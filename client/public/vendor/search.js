/*
 * Site search for published pages, which run no React. Any `[data-np-search]` button (the Search
 * block) or `[data-np-search-open]` element opens a search window, as does Ctrl/⌘ + K unless the
 * reader is typing in a field. The markup of the button comes from shared/blocks/search-view.tsx,
 * the styles from search-css.ts.
 *
 * Search happens in the browser. The first time the window opens, this loads /vendor/minisearch.js
 * and the site's prebuilt index (GET /api/public/docs-index, made by the server whenever pages are
 * published); after that every keystroke is answered here, with no request to the server. The
 * settings for loading and searching the index arrive with it, nothing about them is written here.
 * Page text is only ever put on screen as text nodes, never as HTML.
 */
(function () {
  if (window.__npSearch) return;
  window.__npSearch = true;

  var INDEX_URL = "/api/public/docs-index";
  var LIBRARY_URL = "/vendor/minisearch.js";
  var INDEX_VERSION = 1;
  var MAX_RESULTS = 8;
  /* A search cannot be made slow by a very long query. */
  var MAX_QUERY_LENGTH = 100;
  var MAX_QUERY_SHOWN = 60;
  var OPENERS = "[data-np-search], [data-np-search-open]";
  var LOADING = "Loading search…";
  var BROKEN = "Search isn't available right now. Try again in a moment.";

  var dialog = null;
  var input = null;
  var list = null;
  var status = null;
  var results = [];
  var active = -1;
  var engine = null;
  var loading = null;
  var failed = false;

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

  function reportProblem(step, error) {
    if (window.console && console.error) console.error("NextPress search: " + step, error);
  }

  /* Loading: the search library and the index, once, on the first open. */

  function loadLibrary() {
    if (window.MiniSearch) return Promise.resolve(window.MiniSearch);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = LIBRARY_URL;
      script.async = true;
      script.onload = function () {
        if (window.MiniSearch) resolve(window.MiniSearch);
        else reject(new Error(LIBRARY_URL + " loaded but did not define MiniSearch"));
      };
      script.onerror = function () {
        script.remove();
        reject(new Error("Could not load " + LIBRARY_URL));
      };
      document.head.appendChild(script);
    });
  }

  function loadIndex() {
    return fetch(INDEX_URL, { headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("The index request answered " + response.status);
      return response.json();
    });
  }

  function prepare() {
    if (loading) return loading;
    loading = Promise.all([loadLibrary(), loadIndex()])
      .then(function (parts) {
        var MiniSearch = parts[0];
        var payload = parts[1];
        if (!payload || payload.version !== INDEX_VERSION || !payload.index || !payload.options) {
          throw new Error("The index came in a shape this page does not know");
        }
        // The async loader pauses between batches so a big index never freezes the page.
        return MiniSearch.loadJSAsync
          ? MiniSearch.loadJSAsync(payload.index, payload.options)
          : MiniSearch.loadJS(payload.index, payload.options);
      })
      .then(function (loaded) {
        engine = loaded;
        failed = false;
        return loaded;
      });
    loading.catch(function () {
      // Forget the failure so the next time the window opens it tries again.
      loading = null;
    });
    return loading;
  }

  /* Searching: one result per page, its best section. */

  function isSitePath(path) {
    return typeof path === "string" && /^\/(?![\/\\])/.test(path);
  }

  function onePerPage(found) {
    var seen = Object.create(null);
    var items = [];
    found.forEach(function (hit) {
      if (!isSitePath(hit.path)) return;
      var page = hit.path.split("#")[0];
      if (seen[page]) return;
      seen[page] = true;
      items.push(hit);
    });
    return items;
  }

  function find(query) {
    var found = engine.search(query);
    // Several words that never meet in one place: show pages that have any of them.
    if (!found.length && /\s/.test(query)) found = engine.search(query, { combineWith: "OR" });
    return onePerPage(found).slice(0, MAX_RESULTS);
  }

  /* Showing results. Text goes in as text nodes; matched words are wrapped in <mark>. */

  function makeWordPattern() {
    try {
      return new RegExp("[^\\n\\r\\p{Z}\\p{P}]+", "gu");
    } catch (error) {
      return /\S+/g;
    }
  }
  var WORD = makeWordPattern();

  function matchedWords(hit) {
    var words = Object.create(null);
    (hit.terms || []).forEach(function (term) {
      words[term] = true;
    });
    return words;
  }

  function appendMarked(parent, value, words) {
    var text = String(value);
    var last = 0;
    var match;
    WORD.lastIndex = 0;
    while ((match = WORD.exec(text)) !== null) {
      if (words[match[0].toLowerCase()] !== true) continue;
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      var mark = document.createElement("mark");
      mark.textContent = match[0];
      parent.appendChild(mark);
      last = match.index + match[0].length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function makeResult(hit, index) {
    var words = matchedWords(hit);
    var row = make("li", "", { role: "presentation" });
    var link = make("a", "np-search-dialog__result", {
      href: hit.path,
      role: "option",
      id: "np-search-result-" + index,
      "aria-selected": "false",
      tabindex: "-1",
    });
    var title = make("span", "np-search-dialog__title");
    appendMarked(title, hit.pageTitle || hit.path, words);
    var heading = typeof hit.heading === "string" ? hit.heading : "";
    if (heading && heading.toLowerCase() !== String(hit.pageTitle || "").toLowerCase()) {
      var section = make("span", "np-search-dialog__section");
      appendMarked(section, heading, words);
      title.appendChild(section);
    }
    link.appendChild(title);
    if (hit.excerpt) {
      var snippet = make("span", "np-search-dialog__snippet");
      appendMarked(snippet, hit.excerpt, words);
      link.appendChild(snippet);
    }
    // A link to a spot on the page being read must not leave the window covering it.
    link.addEventListener("click", function () {
      dialog.close();
    });
    row.appendChild(link);
    return row;
  }

  function show(message) {
    status.textContent = message;
  }

  function render(items) {
    results = items;
    list.textContent = "";
    input.setAttribute("aria-expanded", items.length ? "true" : "false");
    items.forEach(function (hit, index) {
      list.appendChild(makeResult(hit, index));
    });
    active = -1;
    input.removeAttribute("aria-activedescendant");
  }

  function noMatchMessage(query) {
    var shown = query.length > MAX_QUERY_SHOWN ? query.slice(0, MAX_QUERY_SHOWN) + "…" : query;
    return 'No pages match "' + shown + '". Try another word.';
  }

  function runSearch() {
    var query = input.value.trim();
    if (!engine) {
      render([]);
      show(failed ? BROKEN : LOADING);
      return;
    }
    if (!query) {
      render([]);
      show("");
      return;
    }
    var items = find(query);
    render(items);
    show(items.length ? "" : noMatchMessage(query));
  }

  function startLoading() {
    if (engine) return;
    failed = false;
    show(LOADING);
    prepare().then(
      function () {
        if (dialog.open) runSearch();
      },
      function (error) {
        failed = true;
        reportProblem("could not get the search ready", error);
        if (dialog.open) {
          render([]);
          show(BROKEN);
        }
      }
    );
  }

  /* The window. */

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
      maxlength: String(MAX_QUERY_LENGTH),
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

    input.addEventListener("input", runSearch);
    input.addEventListener("keydown", onInputKey);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
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
    startLoading();
  }

  function isTypingTarget(node) {
    if (!node || !node.tagName) return false;
    var tag = node.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || node.isContentEditable === true;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var opener = target && target.closest ? target.closest(OPENERS) : null;
    if (!opener) return;
    event.preventDefault();
    openSearch(opener.getAttribute("data-placeholder"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "k" && event.key !== "K") return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    if (isTypingTarget(event.target)) return;
    var opener = document.querySelector(OPENERS);
    if (!opener) return;
    event.preventDefault();
    openSearch(opener.getAttribute("data-placeholder"));
  });

  markShortcutHints();
})();
