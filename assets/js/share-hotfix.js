(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  let currentShare = { title: "", text: "", url: "" };
  let lastFocusedHash = "";

  function text(value) {
    return String(value ?? "").trim();
  }

  function slugify(value) {
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "item";
  }

  function shareIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.8 2.8 0 0 0 0-1.39l7.05-4.12A2.99 2.99 0 1 0 15 5c0 .23.03.46.08.67L8.03 9.79a3 3 0 1 0 0 4.42l7.12 4.16c-.04.2-.07.41-.07.63A2.92 2.92 0 1 0 18 16.08Z"/>
      </svg>`;
  }

  function buildUrl(targetId) {
    return `${location.origin}${location.pathname}#${encodeURIComponent(targetId)}`;
  }

  function ensureShareSheet() {
    if ($("#mjhkShareSheet")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="mjhk-share-sheet" id="mjhkShareSheet" aria-hidden="true">
        <div class="mjhk-share-backdrop" data-share-close></div>
        <div class="mjhk-share-card" role="dialog" aria-modal="true" aria-labelledby="mjhkShareTitle">
          <div class="mjhk-share-head">
            <div>
              <span class="mjhk-share-label">Bagikan</span>
              <h3 id="mjhkShareTitle">Bagikan informasi</h3>
            </div>
            <button type="button" class="mjhk-share-close" data-share-close aria-label="Tutup">×</button>
          </div>

          <p class="mjhk-share-copy" id="mjhkShareCopy"></p>

          <div class="mjhk-share-actions">
            <button type="button" class="mjhk-share-option whatsapp" id="mjhkShareWhatsapp">WhatsApp</button>
            <button type="button" class="mjhk-share-option" id="mjhkShareNative">Bagikan lainnya</button>
            <button type="button" class="mjhk-share-option" id="mjhkShareLink">Salin Link</button>
          </div>

          <p class="mjhk-share-status" id="mjhkShareStatus" aria-live="polite"></p>
        </div>
      </div>
    `);

    $$("[data-share-close]").forEach(el => {
      el.addEventListener("click", closeShareSheet);
    });

    $("#mjhkShareWhatsapp")?.addEventListener("click", () => {
      const message = `${currentShare.text}\n\n${currentShare.url}`;
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });

    $("#mjhkShareNative")?.addEventListener("click", async () => {
      const status = $("#mjhkShareStatus");

      if (!navigator.share) {
        if (status) status.textContent = "Browser ini belum mendukung menu bagikan.";
        return;
      }

      try {
        await navigator.share(currentShare);
        closeShareSheet();
      } catch (error) {
        if (error?.name !== "AbortError" && status) {
          status.textContent = "Menu bagikan belum dapat dibuka.";
        }
      }
    });

    $("#mjhkShareLink")?.addEventListener("click", async () => {
      const status = $("#mjhkShareStatus");

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(currentShare.url);
        } else {
          const input = document.createElement("textarea");
          input.value = currentShare.url;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }

        if (status) status.textContent = "Link berhasil disalin.";
      } catch {
        if (status) status.textContent = "Gagal menyalin link.";
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeShareSheet();
    });
  }

  function openShareSheet(payload) {
    ensureShareSheet();
    currentShare = payload;

    const sheet = $("#mjhkShareSheet");
    const copy = $("#mjhkShareCopy");
    const status = $("#mjhkShareStatus");

    if (copy) copy.textContent = payload.text;
    if (status) status.textContent = "";

    if (sheet) {
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
    }
  }

  function closeShareSheet() {
    const sheet = $("#mjhkShareSheet");
    if (!sheet) return;

    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
  }

  function payloadFromExistingButton(button) {
    return {
      title: button.dataset.shareTitle || "Masjid Jami' Harapan Kita",
      text: button.dataset.shareText || "",
      url: buildUrl(button.dataset.shareTarget || "")
    };
  }

  function bindExistingButton(button) {
    if (!button || button.dataset.mjhkShareBridge === "1") return;

    button.dataset.mjhkShareBridge = "1";

    /*
      Capture phase intentionally overrides the older app.js handler.
      app.js creates the original button correctly, but its old share modal
      markup is no longer present in index.html.
    */
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      openShareSheet(payloadFromExistingButton(button));
    }, true);
  }

  function makeFallbackButton(targetId, title, shareText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mjhk-share-btn";
    button.dataset.mjhkFallbackShare = "1";
    button.innerHTML = `${shareIcon()}<span>Bagikan</span>`;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      openShareSheet({
        title,
        text: shareText,
        url: buildUrl(targetId)
      });
    });

    return button;
  }

  function fixKajianCards() {
    const grid = $("#kajianGrid");
    if (!grid) return;

    $$(".kajian-card", grid).forEach((card, index) => {
      const originalButton = $(".share-btn[data-share]", card);

      if (originalButton) {
        $$(".mjhk-share-btn", card).forEach(btn => btn.remove());
        bindExistingButton(originalButton);
        return;
      }

      if ($(".mjhk-share-btn", card)) return;

      const title = text($("h3", card)?.textContent) || "Kajian";
      const theme = text($(".card-pad > p", card)?.textContent);
      const meta = $$(".meta span", card)
        .map(el => text(el.textContent))
        .filter(Boolean);

      const targetId =
        card.id ||
        `kajian-${slugify([title, ...meta].join("-"))}-${index + 1}`;

      card.id = targetId;

      let actions = $(".card-actions", card);

      if (!actions) {
        actions = document.createElement("div");
        actions.className = "card-actions mjhk-share-actions";
        $(".card-pad", card)?.appendChild(actions);
      }

      actions.appendChild(
        makeFallbackButton(
          targetId,
          `${title} | MJHK`,
          [title, theme, ...meta, "Masjid Jami' Harapan Kita"]
            .filter(Boolean)
            .join("\n")
        )
      );
    });
  }

  function fixFinanceCards() {
    const latest = $("#financeLatest");

    if (latest) {
      $$(".finance-feature", latest).forEach((card, index) => {
        const originalButton = $(".share-btn[data-share]", card);

        if (originalButton) {
          $$(".mjhk-share-btn", card).forEach(btn => btn.remove());
          bindExistingButton(originalButton);
          return;
        }

        if ($(".mjhk-share-btn", card)) return;

        const period =
          text($(".finance-caption strong", card)?.textContent) ||
          "Laporan Keuangan";

        const targetId =
          card.id || `keuangan-${slugify(period)}-${index + 1}`;

        card.id = targetId;

        const caption = $(".finance-caption", card);
        if (!caption) return;

        const actions = document.createElement("div");
        actions.className = "finance-actions mjhk-share-actions";

        actions.appendChild(
          makeFallbackButton(
            targetId,
            "Laporan Keuangan MJHK",
            `Laporan Keuangan Pekanan\nPeriode ${period}\nMasjid Jami' Harapan Kita`
          )
        );

        caption.appendChild(actions);
      });
    }

    const history = $("#financeHistory");

    if (history) {
      $$(".history-card", history).forEach((card, index) => {
        const originalButton = $(".share-btn[data-share]", card);

        if (originalButton) {
          $$(".mjhk-share-btn", card).forEach(btn => btn.remove());
          bindExistingButton(originalButton);
          return;
        }

        if ($(".mjhk-share-btn", card)) return;

        const period =
          text($("strong", card)?.textContent) || "Laporan Keuangan";

        const targetId =
          card.id || `keuangan-${slugify(period)}-${index + 1}`;

        card.id = targetId;

        const body = $("div", card);
        if (!body) return;

        const actions = document.createElement("div");
        actions.className = "finance-actions mjhk-share-actions";

        actions.appendChild(
          makeFallbackButton(
            targetId,
            "Laporan Keuangan MJHK",
            `Laporan Keuangan Pekanan\nPeriode ${period}\nMasjid Jami' Harapan Kita`
          )
        );

        body.appendChild(actions);
      });
    }
  }

  function focusSharedTarget() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));

    if (!hash || hash === lastFocusedHash) return;

    const target = document.getElementById(hash);
    if (!target) return;

    lastFocusedHash = hash;

    setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("mjhk-shared-target");

      setTimeout(() => {
        target.classList.remove("mjhk-shared-target");
      }, 2300);
    }, 100);
  }

  function refresh() {
    fixKajianCards();
    fixFinanceCards();
    focusSharedTarget();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureShareSheet();
    refresh();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(refresh);
    });

    ["kajianGrid", "financeLatest", "financeHistory"].forEach(id => {
      const element = document.getElementById(id);

      if (element) {
        observer.observe(element, {
          childList: true,
          subtree: true
        });
      }
    });
  });

  window.addEventListener("hashchange", () => {
    lastFocusedHash = "";
    focusSharedTarget();
  });
})();
