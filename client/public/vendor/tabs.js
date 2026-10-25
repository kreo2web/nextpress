/*
 * Tabs on published pages. Markup comes from shared/blocks/tabs-view.tsx:
 * [data-np-tabs] > [role=tablist] > [role=tab], and the panels each tab controls.
 * Clicking selects; Left/Right (wrapping), Home and End move focus and select (automatic activation).
 *
 * Code groups: a tab list with data-np-sync="<names joined by |>" keeps every list on the page with
 * the same value on the same tab name. With data-np-remember="true" the choice is also kept in
 * localStorage ({ [sync]: name }) and applied on the next page. Storage may be blocked: never throw.
 *
 * Deep links: a tab button with data-np-tab-slug="<name>" (Tabs and MDX <Tabs> that are linkable)
 * has its own link. Choosing it writes #<name> into the address with history.replaceState (no jump,
 * no history entry). Opening the page, or changing the hash, to a tab's name opens that tab (and the
 * tabs around it, for Tabs inside Tabs) and scrolls its Tabs block into view. Any other hash, such as
 * a heading anchor, is left alone. Code groups never take part. The names are unique inside each
 * Tabs when drawn; on load this script keeps them apart across the page (a repeat becomes -2, -3).
 */
(function () {
  if (window.__npTabsInstalled) return;
  window.__npTabsInstalled = true;

  function tabsOf(list) {
    return Array.prototype.filter.call(list.children, function (el) {
      return el.getAttribute("role") === "tab";
    });
  }

  var STORAGE_KEY = "np-tabs-choice";

  function readChoices() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function saveChoice(sync, name) {
    try {
      var choices = readChoices();
      choices[sync] = name;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
    } catch (error) {
      // Private window or blocked storage: the choice still applies on this page.
    }
  }

  function nameOf(tab) {
    return (tab.textContent || "").trim();
  }

  function syncedLists(sync) {
    return Array.prototype.filter.call(document.querySelectorAll("[role=tablist][data-np-sync]"), function (list) {
      return list.getAttribute("data-np-sync") === sync;
    });
  }

  function selectByName(list, name) {
    var match = tabsOf(list).filter(function (tab) {
      return nameOf(tab) === name;
    })[0];
    if (match) select(match, false);
  }

  /** After a reader's own choice: match the other groups and remember it. */
  function afterChoice(tab) {
    var list = tab.parentElement;
    var sync = list.getAttribute("data-np-sync");
    if (!sync) return;
    var name = nameOf(tab);
    syncedLists(sync).forEach(function (other) {
      if (other !== list) selectByName(other, name);
    });
    if (list.getAttribute("data-np-remember") === "true") saveChoice(sync, name);
  }

  function applySavedChoices() {
    var choices = readChoices();
    Array.prototype.forEach.call(document.querySelectorAll("[role=tablist][data-np-sync][data-np-remember=true]"), function (list) {
      var name = choices[list.getAttribute("data-np-sync")];
      if (typeof name === "string") selectByName(list, name);
    });
  }

  function select(tab, focus) {
    var list = tab.parentElement;
    tabsOf(list).forEach(function (other) {
      var on = other === tab;
      other.setAttribute("aria-selected", on ? "true" : "false");
      other.setAttribute("tabindex", on ? "0" : "-1");
      var panel = document.getElementById(other.getAttribute("aria-controls") || "");
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }

  function tabFrom(target) {
    var tab = target instanceof Element ? target.closest('[role="tab"]') : null;
    var list = tab && tab.parentElement;
    return list && list.getAttribute("role") === "tablist" && list.parentElement && list.parentElement.hasAttribute("data-np-tabs")
      ? tab
      : null;
  }

  /* ---- Deep links ---- */

  /** A code group is a preference that follows the reader, not a place to link to. */
  function inCodeGroup(tab) {
    var list = tab.parentElement;
    var box = list && list.parentElement;
    return !!(list && (list.hasAttribute("data-np-sync") || (box && box.classList.contains("np-code-group"))));
  }

  /** The tab's link name, or null when it has none or is in a code group. */
  function slugOf(tab) {
    return inCodeGroup(tab) ? null : tab.getAttribute("data-np-tab-slug") || null;
  }

  /** Every tab that can be linked to, in reading order. */
  function linkedTabs() {
    return Array.prototype.filter.call(document.querySelectorAll('[role="tab"][data-np-tab-slug]'), function (tab) {
      return slugOf(tab) !== null;
    });
  }

  /** The names repeat between Tabs blocks (two "npm" tabs): a repeat becomes name-2, name-3, in reading order. */
  function keepSlugsApart() {
    var taken = Object.create(null);
    linkedTabs().forEach(function (tab) {
      var base = slugOf(tab);
      var slug = base;
      for (var count = 2; taken[slug]; count++) slug = base + "-" + count;
      taken[slug] = true;
      if (slug !== base) tab.setAttribute("data-np-tab-slug", slug);
    });
  }

  /** The hash as text, without the #, or null when there is none. */
  function readHash() {
    var raw = window.location.hash;
    if (!raw || raw.length < 2) return null;
    try {
      return decodeURIComponent(raw.slice(1));
    } catch (error) {
      return raw.slice(1);
    }
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /** Opens the tab, and the tab holding its Tabs when that sits inside another Tabs panel. */
  function reveal(tab) {
    select(tab, false);
    var box = tab.parentElement && tab.parentElement.parentElement;
    var panel = box && box.parentElement && box.parentElement.closest('[role="tabpanel"]');
    var outer = panel && document.getElementById(panel.getAttribute("aria-labelledby") || "");
    if (outer && outer.getAttribute("role") === "tab") reveal(outer);
  }

  /** A link to a tab opens it. Under reduced motion the page jumps instead of gliding. */
  function openFromHash() {
    var slug = readHash();
    if (!slug) return;
    var tab = linkedTabs().filter(function (candidate) {
      return slugOf(candidate) === slug;
    })[0];
    if (!tab) return; // Not a tab name (a heading anchor, say): not ours to handle.
    reveal(tab);
    var box = tab.closest("[data-np-tabs]");
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  /** After a reader's own choice: put the tab's name in the address. replaceState: no jump, no extra history entry. */
  function writeLink(tab) {
    var slug = slugOf(tab);
    if (!slug || !window.history || !window.history.replaceState) return;
    try {
      window.history.replaceState(window.history.state, "", "#" + encodeURIComponent(slug));
    } catch (error) {
      // A sandboxed frame may refuse to change the address: the tab has switched all the same.
    }
  }

  document.addEventListener("click", function (event) {
    var tab = tabFrom(event.target);
    if (!tab) return;
    select(tab, false);
    afterChoice(tab);
    writeLink(tab);
  });

  document.addEventListener("keydown", function (event) {
    var tab = tabFrom(event.target);
    if (!tab) return;
    var tabs = tabsOf(tab.parentElement);
    var index = tabs.indexOf(tab);
    var next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[next], true);
    afterChoice(tabs[next]);
    writeLink(tabs[next]);
  });

  window.addEventListener("hashchange", openFromHash);

  function start() {
    keepSlugsApart();
    applySavedChoices();
    openFromHash();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
