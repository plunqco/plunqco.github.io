/* Plunq site behaviour — shared by the landing page and the integration pages.
   Every block is guarded, so a page that lacks a piece simply skips it. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nav = document.getElementById("nav");
  var hero = document.getElementById("top");
  var menuBtn = document.getElementById("menu-btn");
  var sheet = document.getElementById("sheet");
  var pastHero = false;
  
  function paintNav() {
    nav.classList.toggle("solid", pastHero || sheet.classList.contains("open"));
    // Inside the tall hero, copy scrolls under the bar, so it frosts over.
    nav.classList.toggle("frost", !pastHero && window.scrollY > 24);
  }
  window.addEventListener("scroll", paintNav, { passive: true });
  
  // Nav: transparent over the dark hero, solid once past it.
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting;
      paintNav();
    }, { rootMargin: "-72px 0px 0px 0px" }).observe(hero);
  } else {
    // No hero on this page: the header is solid from the start.
    pastHero = true;
    paintNav();
  }
  
  // Mobile menu.
  function setMenu(open) {
    sheet.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    paintNav();
  }
  menuBtn.addEventListener("click", function () { setMenu(!sheet.classList.contains("open")); });
  sheet.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sheet.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });
  
  // Line drawings (the pilot mark): each line draws itself in once.
  function playDrawing(svg) {
    svg.querySelectorAll(".ln:not(.dash)").forEach(function (el) {
      var len = Math.ceil(el.getTotalLength ? el.getTotalLength() : 0) + 1;
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
    });
    svg.classList.add("animate");
  }
  
  // Reveals, wires and the footer mark, fired once on scroll.
  document.querySelectorAll(".cols .col").forEach(function (col, i) { col.style.transitionDelay = i * 90 + "ms"; });
  var pilotMark = document.getElementById("pilot-mark");
  var watched = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (pilotMark && entry.target === pilotMark) { if (!reduce) playDrawing(pilotMark); }
        else entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    watched.forEach(function (el) { io.observe(el); });
    if (pilotMark) io.observe(pilotMark);
  } else {
    watched.forEach(function (el) { el.classList.add("in"); });
  }
  
  // Tabs (How it works, example runs): click or arrow keys.
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });
  
  
  /* ── booking ───────────────────────────────────────────────────
     One booking link per page, declared on [data-calendly]. The chat and
     the hero composer both route through these helpers. */
  var calRoot = document.querySelector("[data-calendly]");
  var calendlyUrl = calRoot ? calRoot.getAttribute("data-calendly") : "";
  var calendlyAsked = false;
  function loadCalendly() {
    // Only fetched once someone signals they want to book.
    if (calendlyAsked) return;
    calendlyAsked = true;
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    var js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js";
    js.async = true;
    document.head.appendChild(css);
    document.head.appendChild(js);
  }
  function calendlyLink(text) {
    if (!text) return calendlyUrl;
    return calendlyUrl + (calendlyUrl.indexOf("?") > -1 ? "&" : "?") + "a1=" + encodeURIComponent(text.slice(0, 200));
  }
  function openCalendly(text) {
    var url = calendlyLink(text);
    if (window.Calendly) window.Calendly.initPopupWidget({ url: url });
    else window.open(url, "_blank", "noopener");
  }

  /* Named funnel events for PostHog (assets/posthog.js). Autocapture already
     sees every click; these name the steps: asked to book, then booked. */
  function track(event, props) {
    if (window.posthog && window.posthog.capture) window.posthog.capture(event, props);
  }
  // Calendly's popup reports back by postMessage; a scheduled slot is the conversion.
  window.addEventListener("message", function (e) {
    if (e.origin === "https://calendly.com" && e.data && e.data.event === "calendly.event_scheduled") track("call_booked");
  });
  

  /* Anything marked [data-book] opens the calendar: the popup when
     Calendly's script is up, otherwise the link's own href in a new tab. */
  document.querySelectorAll("[data-book]").forEach(function (el) {
    el.addEventListener("mouseenter", loadCalendly, { once: true });
    el.addEventListener("focus", loadCalendly, { once: true });
    el.addEventListener("click", function (e) {
      track("book_call_clicked", { placement: el.closest(".nav") ? "nav" : (el.closest("section[id]") || { id: "page" }).id });
      if (!calendlyUrl) return;
      e.preventDefault();
      loadCalendly();
      openCalendly("");
    });
  });

  /* ── hero composer ────────────────────────────────────────────
     The placeholder is a ghost layer behind the textarea: "I want to"
     plus a rotating phrase drawn from the chips below it. A chip fills
     the line in; Enter or the send button opens the calendar. */
  var composer = document.getElementById("composer");
  if (composer) {
  var cInput = document.getElementById("composer-input");
  var cField = document.getElementById("composer-field");
  var rotator = document.getElementById("rotator");
  var PHRASES = ["stop chasing approvals", "keep site on the current drawing", "close defects on time", "prove what happened"];
  var phrase = 0;
  var chipUsed = null;
  
  function setFilled() {
    if (cInput.value.trim()) cField.setAttribute("data-filled", "");
    else cField.removeAttribute("data-filled");
  }
  if (!reduce) {
    setInterval(function () {
      if (document.activeElement === cInput || cInput.value.trim()) return;
      rotator.style.opacity = "0";
      setTimeout(function () {
        phrase = (phrase + 1) % PHRASES.length;
        rotator.textContent = PHRASES[phrase];
        rotator.style.opacity = "1";
      }, 260);
    }, 2900);
  }
  cInput.addEventListener("input", setFilled);
  cInput.addEventListener("focus", loadCalendly);
  cInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (composer.requestSubmit) composer.requestSubmit();
      else composer.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
  document.querySelectorAll(".suggest").forEach(function (chip) {
    chip.addEventListener("click", function () {
      cInput.value = "I want to " + chip.getAttribute("data-phrase");
      chipUsed = chip;
      setFilled();
      loadCalendly();
      cInput.focus();
      cInput.setSelectionRange(cInput.value.length, cInput.value.length);
    });
  });
  composer.addEventListener("submit", function (e) {
    e.preventDefault();
    // Which chip, or "custom" if they wrote their own. The text itself stays out of analytics.
    var chipText = chipUsed && "I want to " + chipUsed.getAttribute("data-phrase");
    track("composer_submitted", { intent: chipText && cInput.value.trim() === chipText ? chipUsed.getAttribute("data-intent") : "custom" });
    openCalendly(cInput.value.trim());
  });
  }

  // Access form (not yet wired to a backend).
  var form = document.getElementById("access-form");
  var status = document.getElementById("form-status");
  if (form && status) form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    status.textContent = "You're on the list. We'll be in touch within 24 hours.";
    form.reset();
  });
})();
