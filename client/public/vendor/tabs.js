/*
 * Tabs on published pages. Markup comes from renderer/react/design/tabs.tsx:
 * [data-np-tabs] > [role=tablist] > [role=tab], and the panels each tab controls.
 * Clicking selects; Left/Right (wrapping), Home and End move focus and select (automatic activation).
 */
(function () {
  if (window.__npTabsInstalled) return;
  window.__npTabsInstalled = true;

  function tabsOf(list) {
    return Array.prototype.filter.call(list.children, function (el) {
      return el.getAttribute("role") === "tab";
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

  document.addEventListener("click", function (event) {
    var tab = tabFrom(event.target);
    if (tab) select(tab, false);
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
  });
})();
