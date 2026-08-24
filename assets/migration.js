(() => {
  "use strict";

  const pickResponsiveStyle = (styles = []) =>
    styles.find((entry) => !entry.media || window.matchMedia(entry.media).matches) || styles[0];

  const toSiteUrl = (value) => {
    if (!value?.startsWith("/") || value.startsWith("//")) return value;
    const siteBase = document.querySelector("base[data-caersidi-base]")?.href || `${location.origin}/`;
    return `${siteBase.replace(/\/$/, "")}${value}`;
  };

  const hydrateBackgrounds = () => {
    document
      .querySelectorAll('[data-component="background"][data-type="image"][data-hydrate]')
      .forEach((element) => {
        try {
          const config = JSON.parse(element.dataset.hydrate || "{}");
          const selected = pickResponsiveStyle(config.style);
          const url = toSiteUrl(selected?.url || config.fallbackurl);
          if (!url) return;
          const target = element.querySelector(".parallax-inner, .background_2xT") || element;
          const background = selected?.background || "no-repeat 50% 50% / cover";
          target.style.background = `url("${url}") ${background}`;
        } catch {
          // Keep the color placeholder when a legacy block has malformed data.
        }
      });
  };

  const hydrateImages = () => {
    document.querySelectorAll("source[data-srcset]").forEach((source) => {
      source.srcset = source.dataset.srcset;
    });
    document.querySelectorAll("img[data-srcset]").forEach((image) => {
      image.srcset = image.dataset.srcset;
    });
    document.querySelectorAll("img[data-src]").forEach((image) => {
      image.src = image.dataset.src;
    });
    document.querySelectorAll("img[data-fallback-url]").forEach((image) => {
      if (!image.getAttribute("src")) image.src = toSiteUrl(image.dataset.fallbackUrl);
    });
  };

  const collectResourceRefs = (value, refs = []) => {
    if (!value || typeof value !== "object") return refs;
    if (typeof value.resourceRef === "string") refs.push(value.resourceRef);
    for (const child of Object.values(value)) collectResourceRefs(child, refs);
    return refs;
  };

  const hydrateEmbeddedImages = () => {
    const assetIndex = window.__CAERSIDI_ASSET_INDEX__ || {};
    document.querySelectorAll("[data-hydrate]").forEach((element) => {
      try {
        const config = JSON.parse(element.dataset.hydrate || "{}");
        const refs = collectResourceRefs(config);
        const images = [...element.querySelectorAll("img")].filter(
          (image) => !image.getAttribute("src") && !image.getAttribute("data-src"),
        );
        refs.forEach((resourceRef, index) => {
          const image = images[index];
          const source = toSiteUrl(assetIndex[resourceRef]);
          if (image && source) image.src = source;
        });
      } catch {
        // The block remains usable as text if its legacy data is malformed.
      }
    });
  };

  const revealAnimatedContent = () => {
    document.querySelectorAll(".hidden_3w8").forEach((element) => {
      element.classList.remove("hidden_3w8");
    });
  };

  const findAnchorTarget = (hash) => {
    if (!hash || hash === "#") return null;
    const anchor = decodeURIComponent(hash.slice(1));
    const legacyTarget = document.getElementById(anchor);
    return (
      legacyTarget?.closest("[data-anchor]") ||
      [...document.querySelectorAll("[data-anchor]")].find(
        (element) => element.dataset.anchor === anchor,
      ) ||
      legacyTarget
    );
  };

  const scrollToAnchor = (hash, behavior = "smooth") => {
    const target = findAnchorTarget(hash);
    if (!target) return false;
    target.scrollIntoView({ behavior, block: "start" });
    return true;
  };

  const setupAnchorNavigation = () => {
    document.querySelectorAll('a[href*="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetUrl = new URL(link.href, location.href);
        const isCurrentPage =
          targetUrl.origin === location.origin && targetUrl.pathname === location.pathname;
        if (!isCurrentPage || !scrollToAnchor(targetUrl.hash)) return;
        event.preventDefault();
        history.pushState(null, "", `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
      });
    });

    window.addEventListener("hashchange", () => scrollToAnchor(location.hash));
    if (location.hash) {
      requestAnimationFrame(() => scrollToAnchor(location.hash, "auto"));
      window.addEventListener(
        "load",
        () => {
          [0, 250, 800].forEach((delay) => {
            window.setTimeout(() => scrollToAnchor(location.hash, "auto"), delay);
          });
        },
        { once: true },
      );
    }
  };

  const setupNavigation = () => {
    document.querySelectorAll("[data-burger-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const headerBlock = button.closest("header");
        const mobileHeader =
          headerBlock?.querySelector('[data-toggle*="header--opened"]') ||
          document.querySelector('[data-toggle*="header--opened"]');
        if (!mobileHeader) return;
        const openClass = mobileHeader.dataset.toggle;
        const isOpen = mobileHeader.classList.toggle(openClass);
        headerBlock?.querySelectorAll("[data-burger-button]").forEach((headerButton) => {
          headerButton.setAttribute("aria-expanded", String(isOpen));
          headerButton.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu",
          );
        });
      });
    });

    document.querySelectorAll('a[href*="#"]').forEach((link) => {
      link.addEventListener("click", () => {
        const headerBlock = link.closest("header");
        const mobileHeader =
          headerBlock?.querySelector('[data-toggle*="header--opened"]') ||
          document.querySelector('[data-toggle*="header--opened"]');
        const openClass = mobileHeader?.dataset.toggle;
        if (mobileHeader && openClass) {
          mobileHeader.classList.remove(openClass);
          headerBlock?.querySelectorAll("[data-burger-button]").forEach((headerButton) => {
            headerButton.setAttribute("aria-expanded", "false");
            headerButton.setAttribute("aria-label", "Open navigation menu");
          });
        }
      });
    });
  };

  const valueByPlaceholder = (form, placeholder) =>
    form.querySelector(`[placeholder="${placeholder}"]`)?.value?.trim() || "";

  const selectedValue = (form) => form.querySelector("select")?.value?.trim() || "";

  const setupContactForms = () => {
    document.querySelectorAll("form").forEach((form) => {
      if (!form.querySelector('input[type="email"]')) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const fields = [
          ["Name", valueByPlaceholder(form, "Enter your full name*")],
          ["Phone", valueByPlaceholder(form, "Enter your phone number*")],
          ["Email", valueByPlaceholder(form, "Enter your email*")],
          ["Source", valueByPlaceholder(form, "How did you hear about us?")],
          ["Region", selectedValue(form)],
          ["Message", valueByPlaceholder(form, "Type your message")],
        ].filter(([, value]) => value);
        const body = fields.map(([label, value]) => `${label}: ${value}`).join("\n\n");
        const mailto = `mailto:support@caersidi.net?subject=${encodeURIComponent(
          "Caer-Sidi website enquiry",
        )}&body=${encodeURIComponent(body)}`;

        let status = form.querySelector(".migration-form-status");
        if (!status) {
          status = document.createElement("p");
          status.className = "migration-form-status";
          status.setAttribute("role", "status");
          form.append(status);
        }
        status.textContent = "Your email application will open to send this message.";
        window.location.href = mailto;
      });
    });
  };

  const setupProductOrdering = () => {
    const changeQuantity = (button, delta) => {
      const input = button
        .closest(".js-product-specs-quantity")
        ?.querySelector('input[aria-label="Product quantity"]');
      if (!input) return;
      input.value = String(Math.max(1, Number(input.value || 1) + delta));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    document.querySelectorAll('[aria-label="Increase quantity"]').forEach((button) => {
      button.addEventListener("click", () => changeQuantity(button, 1));
    });
    document.querySelectorAll('[aria-label="Decrease quantity"]').forEach((button) => {
      button.addEventListener("click", () => changeQuantity(button, -1));
    });
    document.querySelectorAll('[aria-label="Add to cart"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const title = document.querySelector('h1[aria-label^="Product:"]')?.textContent?.trim() ||
          document.title;
        const quantity = document.querySelector('input[aria-label="Product quantity"]')?.value || "1";
        const body = `Product: ${title}\nQuantity: ${quantity}\n\nPlease contact me to complete this order.`;
        window.location.href = `mailto:support@caersidi.net?subject=${encodeURIComponent(
          `Order: ${title}`,
        )}&body=${encodeURIComponent(body)}`;
      });
    });
  };

  const setupCookieBanner = () => {
    if (localStorage.getItem("caersidi-cookie-notice") === "accepted") return;
    const banner = document.createElement("aside");
    banner.className = "migration-cookie-banner";
    banner.setAttribute("aria-label", "Cookie notice");
    banner.innerHTML = `
      <p>This website uses cookies to provide you with the best user experience.
      For a complete overview, see our <a href="${toSiteUrl("/home/privacy-policy")}">Privacy Policy</a>.</p>
      <button type="button">I agree</button>
    `;
    banner.querySelector("button").addEventListener("click", () => {
      localStorage.setItem("caersidi-cookie-notice", "accepted");
      banner.remove();
    });
    document.body.append(banner);
  };

  const boot = () => {
    hydrateBackgrounds();
    hydrateImages();
    hydrateEmbeddedImages();
    revealAnimatedContent();
    setupAnchorNavigation();
    setupNavigation();
    setupContactForms();
    setupProductOrdering();
    setupCookieBanner();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
