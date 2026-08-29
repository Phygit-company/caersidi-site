(() => {
  "use strict";

  const pickResponsiveStyle = (styles = []) =>
    styles.find((entry) => !entry.media || window.matchMedia(entry.media).matches) || styles[0];

  const toSiteUrl = (value) => {
    if (!value?.startsWith("/") || value.startsWith("//")) return value;
    const siteBase = document.querySelector("base[data-caersidi-base]")?.href || `${location.origin}/`;
    return `${siteBase.replace(/\/$/, "")}${value}`;
  };

  const normalizePathname = (pathname) => pathname.replace(/\/+$/, "") || "/";

  const isCurrentPage = (url) =>
    url.origin === location.origin &&
    normalizePathname(url.pathname) === normalizePathname(location.pathname);

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

  const youtubeVideoId = (value) => {
    try {
      const url = new URL(value);
      if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
      if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/").filter(Boolean)[1];
      }
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  };

  const hydrateVideos = () => {
    document.querySelectorAll('[data-component="video"][data-hydrate]').forEach((element) => {
      try {
        const config = JSON.parse(element.dataset.hydrate || "{}");
        const videoId = youtubeVideoId(config.value?.url);
        if (!videoId || !/^[\w-]+$/.test(videoId)) return;

        const wrapper = document.createElement("div");
        wrapper.className = "placeholder-wrapper_1Zc";
        const iframe = document.createElement("iframe");
        iframe.className = "migration-video-frame";
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
        iframe.title = "Caer-Sidi E-Card — How it works";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        wrapper.append(iframe);
        element.replaceChildren(wrapper);
        element.classList.add("migration-video-player");
        element.setAttribute("aria-label", "Video");
        element.dataset.state = "loaded";
      } catch {
        // Keep the legacy preview if a video block has malformed data.
      }
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
        if (!isCurrentPage(targetUrl) || !scrollToAnchor(targetUrl.hash)) return;
        event.preventDefault();
        history.pushState(null, "", `${location.pathname}${targetUrl.search}${targetUrl.hash}`);
      });
    });

    document.querySelectorAll('a[href]:not([href*="#"])').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetUrl = new URL(link.href, location.href);
        if (!isCurrentPage(targetUrl)) return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        history.pushState(null, "", `${location.pathname}${targetUrl.search}`);
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

  const setupCollectionTabs = () => {
    document
      .querySelectorAll('[data-component="collection-tabs"]')
      .forEach((container, groupIndex) => {
        const navigation = container.querySelector('[data-collection-element="tabs-nav"]');
        const navItems = [
          ...(navigation?.querySelectorAll('[data-collection-element="nav-item"]') || []),
        ];
        const panelWrapper = container.querySelector(".tabs-items-wrapper");
        const panels = [...(panelWrapper?.children || [])].filter(
          (panel) => panel.dataset.collectionMode === "tabs",
        );
        if (!navItems.length || navItems.length !== panels.length) return;

        navigation.setAttribute("role", "tablist");
        const activate = (selectedIndex, focus = false) => {
          navItems.forEach((navItem, index) => {
            const active = index === selectedIndex;
            const tabId = `migration-tab-${groupIndex}-${index}`;
            const panelId = `migration-tab-panel-${groupIndex}-${index}`;
            navItem.id = tabId;
            navItem.dataset.active = String(active);
            navItem.setAttribute("role", "tab");
            navItem.setAttribute("aria-selected", String(active));
            navItem.setAttribute("aria-controls", panelId);
            navItem.tabIndex = active ? 0 : -1;
            panels[index].id = panelId;
            panels[index].dataset.hidden = String(!active);
            panels[index].hidden = !active;
            panels[index].setAttribute("role", "tabpanel");
            panels[index].setAttribute("aria-labelledby", tabId);
            if (active && focus) navItem.focus();
          });
        };

        navItems.forEach((navItem, index) => {
          navItem.addEventListener("click", () => activate(index));
          navItem.addEventListener("keydown", (event) => {
            let nextIndex = index;
            if (event.key === "ArrowRight") nextIndex = (index + 1) % navItems.length;
            else if (event.key === "ArrowLeft") {
              nextIndex = (index - 1 + navItems.length) % navItems.length;
            } else if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = navItems.length - 1;
            else if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            activate(nextIndex, true);
          });
        });

        const initialIndex = Math.max(
          0,
          navItems.findIndex((navItem) => navItem.dataset.active === "true"),
        );
        activate(initialIndex);
      });
  };

  const FORMS_API_BASE = "https://phygit-forms-api-612810179749.europe-central2.run.app";
  const CONTACT_FORM_KEY = "frm_r_7bpAtKdGghJXCzslvuEe5TN1_YuRXZ";
  const ORDER_FORM_KEY = "frm_0GxJCPtLoWu4ucyqND1hajoWqbfzQYoh";

  const contactMessages = {
    en: {
      sending: "Sending your message…",
      success: "Thanks — your message has been received.",
      failure: "We could not save your message. Please try again or email us.",
      fallback: "Email support@caersidi.net",
    },
    uk: {
      sending: "Надсилаємо ваше повідомлення…",
      success: "Дякуємо — ваше повідомлення отримано.",
      failure: "Не вдалося зберегти повідомлення. Спробуйте ще раз або напишіть нам.",
      fallback: "Написати на support@caersidi.net",
    },
    ru: {
      sending: "Отправляем ваше сообщение…",
      success: "Спасибо — ваше сообщение получено.",
      failure: "Не удалось сохранить сообщение. Попробуйте снова или напишите нам.",
      fallback: "Написать на support@caersidi.net",
    },
  };

  const currentContactMessages = () =>
    contactMessages[document.documentElement.lang] || contactMessages.en;

  const submissionKey = () =>
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `caersidi-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const formContext = () => {
    const params = new URLSearchParams(location.search);
    return {
      page_url: location.href,
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    };
  };

  const contactValues = (form) => {
    const textInputs = [...form.querySelectorAll('input[type="text"]:not(.honey-field)')];
    const howHeard = textInputs[1]?.value?.trim() || "";
    const message = form.querySelector("textarea")?.value?.trim() || "";
    return {
      name: textInputs[0]?.value?.trim() || "",
      phone: form.querySelector('input[type="tel"]')?.value?.trim() || "",
      email: form.querySelector('input[type="email"]')?.value?.trim() || "",
      howHeard,
      country: form.querySelector("select")?.value?.trim() || "",
      message: [message, howHeard && `How heard: ${howHeard}`].filter(Boolean).join("\n\n"),
      website: form.querySelector(".honey-field")?.value?.trim() || "",
    };
  };

  const contactMailto = (values) => {
    const body = [
      ["Name", values.name],
      ["Phone", values.phone],
      ["Email", values.email],
      ["Source", values.howHeard],
      ["Region", values.country],
      ["Message", values.message],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
    return `mailto:support@caersidi.net?subject=${encodeURIComponent(
      "Caer-Sidi website enquiry",
    )}&body=${encodeURIComponent(body)}`;
  };

  const formStatus = (form) => {
    let status = form.querySelector(".migration-form-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "migration-form-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.append(status);
    }
    return status;
  };

  const setupContactForms = () => {
    document.querySelectorAll("form").forEach((form) => {
      if (!form.querySelector('input[type="email"]')) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const values = contactValues(form);
        const messages = currentContactMessages();
        const status = formStatus(form);
        const submit = form.querySelector('[type="submit"]');
        const originalLabel = submit?.textContent || "";
        const idempotencyKey = form.dataset.idempotencyKey || submissionKey();
        form.dataset.idempotencyKey = idempotencyKey;

        status.className = "migration-form-status";
        status.textContent = messages.sending;
        if (submit) {
          submit.disabled = true;
          submit.setAttribute("aria-busy", "true");
        }

        try {
          const response = await fetch(
            `${FORMS_API_BASE}/v1/forms/${CONTACT_FORM_KEY}/submissions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
              },
              body: JSON.stringify({
                fields: {
                  name: values.name,
                  phone: values.phone,
                  email: values.email,
                  country: values.country,
                  message: values.message,
                  how_heard: values.howHeard,
                  privacy_consent: false,
                  website: values.website,
                },
                context: formContext(),
              }),
            },
          );
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.accepted) {
            throw new Error(result.error || "submission_failed");
          }

          form.reset();
          delete form.dataset.idempotencyKey;
          status.classList.add("is-success");
          status.textContent = messages.success;
        } catch (error) {
          console.error("caersidi_contact_submission_failed", error);
          status.classList.add("is-error");
          status.textContent = `${messages.failure} `;
          const fallback = document.createElement("a");
          fallback.href = contactMailto(values);
          fallback.textContent = messages.fallback;
          status.append(fallback);
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.removeAttribute("aria-busy");
            submit.textContent = originalLabel;
          }
        }
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
        openOrderDialog({ title, quantity, trigger: button });
      });
    });
  };

  const orderMailto = ({ title, quantity, name, email, phone, notes }) => {
    const body = [
      ["Product", title],
      ["Quantity", quantity],
      ["Name", name],
      ["Email", email],
      ["Phone", phone],
      ["Notes", notes],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
    return `mailto:support@caersidi.net?subject=${encodeURIComponent(
      `Order: ${title}`,
    )}&body=${encodeURIComponent(body)}`;
  };

  const openOrderDialog = ({ title, quantity, trigger }) => {
    document.querySelector(".migration-order-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "migration-order-overlay";
    const dialog = document.createElement("section");
    dialog.className = "migration-order-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "migration-order-title");
    dialog.innerHTML = `
      <button class="migration-order-close" type="button" aria-label="Close order form">×</button>
      <p class="migration-order-eyebrow">Caer Sidi™</p>
      <h2 id="migration-order-title">Complete your order enquiry</h2>
      <p class="migration-order-product"></p>
      <form class="migration-order-form">
        <label>
          <span>Name *</span>
          <input name="name" type="text" autocomplete="name" required />
        </label>
        <label>
          <span>Email *</span>
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <label>
          <span>Phone</span>
          <input name="phone" type="tel" autocomplete="tel" />
        </label>
        <label>
          <span>Comment</span>
          <textarea name="notes" rows="4" placeholder="Delivery country, preferred contact time, or other details"></textarea>
        </label>
        <input class="migration-order-honeypot" name="website" type="text" autocomplete="off" tabindex="-1" aria-hidden="true" />
        <div class="migration-order-actions">
          <button class="migration-order-submit" type="submit">Send order enquiry</button>
          <button class="migration-order-cancel" type="button">Cancel</button>
        </div>
        <p class="migration-form-status" role="status" aria-live="polite"></p>
      </form>
    `;
    dialog.querySelector(".migration-order-product").textContent = `${title} · quantity ${quantity}`;
    overlay.append(dialog);
    document.body.append(overlay);
    document.body.classList.add("migration-order-open");

    const form = dialog.querySelector("form");
    const close = () => {
      document.body.classList.remove("migration-order-open");
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    dialog.querySelector(".migration-order-close").addEventListener("click", close);
    dialog.querySelector(".migration-order-cancel").addEventListener("click", close);
    form.querySelector('input[name="name"]').focus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const values = {
        title,
        quantity,
        name: String(data.get("name") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        notes: String(data.get("notes") || "").trim(),
        website: String(data.get("website") || ""),
      };
      const status = form.querySelector(".migration-form-status");
      const submit = form.querySelector('[type="submit"]');
      const idempotencyKey = form.dataset.idempotencyKey || submissionKey();
      form.dataset.idempotencyKey = idempotencyKey;
      status.className = "migration-form-status";
      status.textContent = "Sending your order enquiry…";
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");

      const message = [
        "Product order enquiry",
        `Product: ${values.title}`,
        `Quantity: ${values.quantity}`,
        values.notes && `Notes: ${values.notes}`,
      ].filter(Boolean).join("\n");

      try {
        const response = await fetch(
          `${FORMS_API_BASE}/v1/forms/${ORDER_FORM_KEY}/submissions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              fields: {
                name: values.name,
                email: values.email,
                phone: values.phone,
                product: values.title,
                quantity: values.quantity,
                message,
                privacy_consent: false,
                website: values.website,
              },
              context: formContext(),
            }),
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.accepted) {
          throw new Error(result.error || "submission_failed");
        }

        form.reset();
        delete form.dataset.idempotencyKey;
        status.classList.add("is-success");
        status.textContent = "Thanks — your order enquiry has been received.";
      } catch (error) {
        console.error("caersidi_order_submission_failed", error);
        status.classList.add("is-error");
        status.textContent = "We could not save the enquiry. Please try again or ";
        const fallback = document.createElement("a");
        fallback.href = orderMailto(values);
        fallback.textContent = "email support@caersidi.net";
        status.append(fallback, ".");
      } finally {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
      }
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
    hydrateVideos();
    hydrateEmbeddedImages();
    revealAnimatedContent();
    setupAnchorNavigation();
    setupNavigation();
    setupCollectionTabs();
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
