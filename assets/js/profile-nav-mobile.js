(() => {
  "use strict";

  const MOBILE_QUERY = "(max-width: 900px)";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function setOpen(dropdown, toggle, open) {
    dropdown.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  function init() {
    const navLinks = document.getElementById("navLinks");
    const menuBtn = document.getElementById("menuBtn");
    const dropdown = document.querySelector(".nav-dropdown");
    const toggle = dropdown?.querySelector(".nav-dropdown-toggle");
    const menu = dropdown?.querySelector(".nav-dropdown-menu");

    if (!navLinks || !dropdown || !toggle || !menu) return;
    if (dropdown.dataset.mobileProfileBound === "1") return;

    dropdown.dataset.mobileProfileBound = "1";
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", (event) => {
      if (!isMobile()) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(dropdown, toggle, !dropdown.classList.contains("is-open"));
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(dropdown, toggle, false);
    });

    document.addEventListener("click", (event) => {
      if (isMobile() && !dropdown.contains(event.target)) {
        setOpen(dropdown, toggle, false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(dropdown, toggle, false);
    });

    window.addEventListener("resize", () => {
      if (!isMobile()) setOpen(dropdown, toggle, false);
    });

    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        requestAnimationFrame(() => {
          if (!navLinks.classList.contains("open")) {
            setOpen(dropdown, toggle, false);
          }
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
