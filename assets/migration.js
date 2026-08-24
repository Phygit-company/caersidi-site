(() => {
  "use strict";

  const pickResponsiveStyle = (styles = []) =>
    styles.find((entry) => !entry.media || window.matchMedia(entry.media).matches) || styles[0];

  const hydrateBackgrounds = () => {
    document
      .querySelectorAll('[data-component="background"][data-type="image"][data-hydrate]')
      .forEach((element) => {
        try {
          const config = JSON.parse(element.dataset.hydrate || "{}");
          const selected = pickResponsiveStyle(config.style);
          const url = selected?.url || config.fallbackurl;
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
          const source = assetIndex[resourceRef];
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
    document.querySelectorAll('[aria-label="Increase quantity"]').forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement?.querySelector('input[aria-label="Product quantity"]');
        if (input) input.value = String(Math.max(1, Number(input.value || 1) + 1));
      });
    });
    document.querySelectorAll('[aria-label="Decrease quantity"]').forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement?.querySelector('input[aria-label="Product quantity"]');
        if (input) input.value = String(Math.max(1, Number(input.value || 1) - 1));
      });
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
      For a complete overview, see our <a href="/home/privacy-policy">Privacy Policy</a>.</p>
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
