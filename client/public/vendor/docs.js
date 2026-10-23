/*
 * The docs layout on published pages. Markup comes from shared/blocks/docs-layout-view.tsx:
 * [data-np-docs] holds the sidebar drawer, the Menu button, "On this page" and Copy page.
 *  - Phone drawer: Menu opens it and moves focus in; Esc, Close, the backdrop or following a link
 *    closes it (Esc and the buttons give focus back to Menu).
 *  - "On this page": the link of the heading being read gets aria-current="true". Clicking a link
 *    scrolls smoothly, except for visitors who asked for less motion (then the browser just jumps).
 *  - Copy page: fetches the page's markdown copy and puts it on the clipboard.
 */
(function () {
  if (window.__npDocsInstalled) return;
  window.__npDocsInstalled = true;

  var COPIED = "Copied";
  var FAILED = "Couldn't copy. Try again.";
  var RESET_MS = 2000;

  function rootOf(el) {
    return el instanceof Element ? el.closest("[data-np-docs]") : null;
  }

  function menuButton(root) {
    return root.querySelector("[data-np-docs-menu]");
  }

  function isOpen(root) {
    return root.getAttribute("data-menu-open") === "true";
  }

  function setOpen(root, open, giveFocusBack) {
    root.setAttribute("data-menu-open", open ? "true" : "false");
    var button = menuButton(root);
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var close = root.querySelector("[data-np-docs-close]");
      var first = root.querySelector("[data-np-docs-drawer] a, [data-np-docs-drawer] button");
      var target = close || first;
      if (target) target.focus();
    } else if (giveFocusBack && button) {
      button.focus();
    }
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function markReading(root, id) {
    Array.prototype.forEach.call(root.querySelectorAll('.np-docs__toc a[href^="#"], .np-docs__toc-fold a[href^="#"]'), function (link) {
      if (link.getAttribute("href") === "#" + id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  function watchHeadings(root) {
    var links = root.querySelectorAll('.np-docs__toc a[href^="#"]');
    var targets = [];
    Array.prototype.forEach.call(links, function (link) {
      var el = document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
      if (el) targets.push(el);
    });
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    var visible = {};
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting;
        });
        for (var i = 0; i < targets.length; i++) {
          if (visible[targets[i].id]) {
            markReading(root, targets[i].id);
            return;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px" }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  function copyPage(button) {
    var label = button.querySelector(".np-docs__action-label") || button;
    if (!button.hasAttribute("data-label")) button.setAttribute("data-label", label.textContent);
    var show = function (text) {
      label.textContent = text;
      clearTimeout(button.__npDocsTimer);
      button.__npDocsTimer = setTimeout(function () {
        label.textContent = button.getAttribute("data-label");
      }, RESET_MS);
    };
    fetch(button.getAttribute("data-markdown"), { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("status " + response.status);
        return response.text();
      })
      .then(function (text) {
        return navigator.clipboard.writeText(text);
      })
      .then(
        function () {
          show(COPIED);
        },
        function () {
          show(FAILED);
        }
      );
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var root = rootOf(target);
    if (!root) return;

    if (target.closest("[data-np-docs-menu]")) {
      setOpen(root, !isOpen(root), true);
      return;
    }
    if (target.closest("[data-np-docs-close]")) {
      setOpen(root, false, true);
      return;
    }
    if (target.closest("[data-np-docs-backdrop]")) {
      setOpen(root, false, true);
      return;
    }
    if (target.closest("[data-np-docs-drawer] a") && isOpen(root)) {
      setOpen(root, false, false);
      return;
    }

    var copy = target.closest("[data-np-docs-copy]");
    if (copy) {
      copyPage(copy);
      return;
    }

    var tocLink = target.closest('.np-docs__toc a[href^="#"], .np-docs__toc-fold a[href^="#"]');
    if (tocLink) {
      var id = decodeURIComponent(tocLink.getAttribute("href").slice(1));
      var heading = document.getElementById(id);
      markReading(root, id);
      var fold = tocLink.closest("details");
      if (fold) fold.open = false;
      if (heading && !reducedMotion()) {
        event.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        if (history.replaceState) history.replaceState(null, "", "#" + id);
      }
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var roots = document.querySelectorAll('[data-np-docs][data-menu-open="true"]');
    Array.prototype.forEach.call(roots, function (root) {
      setOpen(root, false, true);
    });
  });

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-np-docs]"), watchHeadings);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
