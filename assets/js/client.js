(function () {
  const config = window.GOODS_CONFIG;
  if (!window.supabase || !config?.supabaseUrl || !config?.supabasePublishableKey) {
    console.error("Goods Shop public Supabase configuration is missing.");
    return;
  }

  window.goodsShop = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  const fieldFeedbackTimers = new WeakMap();
  const validationSummaryTimers = new WeakMap();

  function getValidationNodes(field, form = field.form) {
    if (!field || !form) return null;
    const label = field.closest("label");
    if (!label) return null;

    let wrapper = field.closest(".field-control-wrap");
    if (!wrapper) {
      wrapper = document.createElement("span");
      wrapper.className = "field-control-wrap";
      field.before(wrapper);
      wrapper.append(field);
    }

    let check = wrapper.querySelector(".field-check");
    if (!check) {
      check = document.createElement("span");
      check.className = "field-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      wrapper.append(check);
    }

    const feedbackId = `field-feedback-${form.id || "form"}-${field.name || field.id || "input"}`;
    let feedback = [...label.querySelectorAll(".field-feedback")].find((node) => node.id === feedbackId);
    if (!feedback) {
      feedback = document.createElement("span");
      feedback.className = "field-feedback";
      feedback.id = feedbackId;
      label.append(feedback);
    }
    const describedBy = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    describedBy.add(feedbackId);
    field.setAttribute("aria-describedby", [...describedBy].join(" "));
    return { wrapper, check, feedback };
  }

  function clearFieldTimer(field) {
    const timer = fieldFeedbackTimers.get(field);
    if (timer) clearTimeout(timer);
    fieldFeedbackTimers.delete(field);
  }

  function resetFieldState(field) {
    const nodes = getValidationNodes(field);
    if (!nodes) return;
    clearFieldTimer(field);
    field.dataset.fieldState = "neutral";
    field.removeAttribute("aria-invalid");
    nodes.wrapper.dataset.fieldState = "neutral";
    nodes.wrapper.classList.remove("field-error-pulse");
    nodes.feedback.className = "field-feedback";
    nodes.feedback.textContent = "";
    nodes.check.classList.remove("is-animated");
  }

  function showFieldError(field, message) {
    const nodes = getValidationNodes(field);
    if (!nodes) return;
    clearFieldTimer(field);
    const changed = field.dataset.fieldState !== "error";
    field.dataset.fieldState = "error";
    field.setAttribute("aria-invalid", "true");
    nodes.wrapper.dataset.fieldState = "error";
    nodes.check.classList.remove("is-animated");
    nodes.feedback.textContent = message;
    nodes.feedback.className = "field-feedback is-visible is-error";
    if (changed) {
      nodes.wrapper.classList.remove("field-error-pulse");
      requestAnimationFrame(() => nodes.wrapper.classList.add("field-error-pulse"));
    }
  }

  function clearFieldError(field) {
    const nodes = getValidationNodes(field);
    if (!nodes) return;
    clearFieldTimer(field);
    field.dataset.fieldState = "neutral";
    field.removeAttribute("aria-invalid");
    nodes.wrapper.dataset.fieldState = "neutral";
    nodes.wrapper.classList.remove("field-error-pulse");
    nodes.check.classList.remove("is-animated");
    nodes.feedback.classList.remove("is-visible");
    fieldFeedbackTimers.set(field, setTimeout(() => {
      nodes.feedback.textContent = "";
      nodes.feedback.className = "field-feedback";
      fieldFeedbackTimers.delete(field);
    }, 220));
  }

  function showFieldSuccess(field, { animate = true } = {}) {
    const nodes = getValidationNodes(field);
    if (!nodes) return;
    clearFieldTimer(field);
    const changed = field.dataset.fieldState !== "success";
    field.dataset.fieldState = "success";
    field.setAttribute("aria-invalid", "false");
    nodes.wrapper.dataset.fieldState = "success";
    nodes.wrapper.classList.remove("field-error-pulse");
    nodes.feedback.classList.remove("is-visible");
    nodes.check.classList.remove("is-animated");
    if (changed && animate) requestAnimationFrame(() => nodes.check.classList.add("is-animated"));
    fieldFeedbackTimers.set(field, setTimeout(() => {
      nodes.feedback.textContent = "";
      nodes.feedback.className = "field-feedback";
      fieldFeedbackTimers.delete(field);
    }, 220));
  }

  function showValidationSummary(node, message, duration) {
    if (!node) return;
    const previousTimer = validationSummaryTimers.get(node);
    if (previousTimer) {
      clearTimeout(previousTimer.hide);
      clearTimeout(previousTimer.remove);
    }
    window.goodsUi.message(node, message, "error");
    node.classList.add("validation-summary");
    node.classList.remove("is-dismissing");
    const hide = setTimeout(() => {
      if (node.textContent !== message) return;
      node.classList.add("is-dismissing");
      const remove = setTimeout(() => {
        if (node.textContent === message) window.goodsUi.message(node, "");
        node.classList.remove("validation-summary", "is-dismissing");
        validationSummaryTimers.delete(node);
      }, 260);
      validationSummaryTimers.set(node, { hide, remove });
    }, duration);
    validationSummaryTimers.set(node, { hide, remove: null });
  }

  function attachFieldValidation(form, rules, options = {}) {
    if (!form) return;
    form.noValidate = true;
    const fields = Object.entries(rules).map(([name, rule]) => ({
      field: form.elements.namedItem(name),
      rule
    })).filter(({ field }) => field);

    const validate = ({ field, rule }) => {
      if (field.disabled) return "";
      if (rule.when && !rule.when(form)) {
        resetFieldState(field);
        return "";
      }
      return rule.validate(field.value, field, form) || "";
    };

    for (const entry of fields) {
      getValidationNodes(entry.field, form);
      entry.field.addEventListener("input", () => {
        const message = validate(entry);
        const state = entry.field.dataset.fieldState || "neutral";
        if (message) {
          if (state !== "neutral" || entry.rule.validateWhileTyping) showFieldError(entry.field, message);
          return;
        }
        showFieldSuccess(entry.field);
      });
      entry.field.addEventListener("change", () => {
        const message = validate(entry);
        if (message) showFieldError(entry.field, message);
        else showFieldSuccess(entry.field);
      });
      entry.field.addEventListener("blur", () => {
        const message = validate(entry);
        if (message) showFieldError(entry.field, message);
      });
    }

    form.addEventListener("submit", (event) => {
      let firstInvalid = null;
      for (const entry of fields) {
        const message = validate(entry);
        if (message) {
          showFieldError(entry.field, message);
          firstInvalid ||= entry.field;
        }
      }
      if (firstInvalid) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showValidationSummary(options.summary, options.summaryText || "입력 항목을 확인해 주세요.", options.summaryDuration || 2500);
        firstInvalid.focus();
      }
    }, true);

    form.addEventListener("reset", () => queueMicrotask(() => fields.forEach(({ field }) => resetFieldState(field))));
  }

  window.goodsUi = {
    money(value) {
      return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
    },
    message(node, value, kind = "info") {
      if (!node) return;
      const summaryTimer = validationSummaryTimers.get(node);
      if (summaryTimer) {
        clearTimeout(summaryTimer.hide);
        clearTimeout(summaryTimer.remove);
        validationSummaryTimers.delete(node);
      }
      node.classList.remove("validation-summary", "is-dismissing");
      node.textContent = value;
      node.dataset.kind = kind;
      node.hidden = !value;
    },
    validation: {
      attach: attachFieldValidation,
      showFieldError,
      clearFieldError,
      showFieldSuccess,
      resetFieldState
    },
    async currentUser() {
      const { data, error } = await window.goodsShop.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    async displayName(user) {
      const metadata = user.user_metadata || {};
      let profileName = "";
      try {
        const { data, error } = await window.goodsShop
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (!error) profileName = data?.display_name?.trim() || "";
      } catch (error) {
        console.warn("Could not read the profile display name.", error.message);
      }
      return profileName || metadata.display_name?.trim() || metadata.name?.trim() || user.email?.split("@")[0] || "회원";
    },
    renderGlobalNavigation(user, displayName = "") {
      const ordersLink = document.querySelector("#orders-nav-link");
      const adminLink = document.querySelector("#admin-nav-link");
      const accountLink = document.querySelector("#account-link");
      const greeting = document.querySelector("#user-greeting");
      const loggedIn = Boolean(user);
      const isAdmin = user?.app_metadata?.role === "admin";

      if (ordersLink) ordersLink.hidden = !loggedIn;
      if (adminLink) adminLink.hidden = !isAdmin;
      if (accountLink && loggedIn) {
        accountLink.textContent = "로그아웃";
        accountLink.href = "#logout";
      }
      if (greeting) {
        greeting.hidden = !loggedIn;
        if (loggedIn && displayName) {
          greeting.href = "account.html";
          greeting.textContent = `안녕하세요, ${displayName}님`;
        }
      }
    },
    setGreeting(user, displayName) {
      this.renderGlobalNavigation(user, displayName);
    },
    artClass(key) {
      return ["sun", "blue", "green"].includes(key) ? `art-${key}` : "art-sun";
    },
    imageUrl(path) {
      if (!path) return "";
      const { data } = window.goodsShop.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    }
  };

  window.goodsAddressSearch = {
    open(onSelect, statusNode) {
      if (!window.kakao?.Postcode) {
        window.goodsUi.message(statusNode, "주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
        return;
      }
      window.goodsUi.message(statusNode, "");
      let dialog = document.querySelector("#address-search-dialog");
      if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "address-search-dialog";
        dialog.className = "address-search-dialog";
        dialog.setAttribute("aria-label", "주소 검색");
        const close = document.createElement("button");
        close.type = "button";
        close.className = "button button-light address-search-close";
        close.textContent = "닫기";
        close.addEventListener("click", () => dialog.close());
        const heading = document.createElement("h2");
        heading.textContent = "주소 검색";
        const host = document.createElement("div");
        host.id = "address-search-widget";
        host.className = "address-search-widget";
        dialog.append(heading, close, host);
        document.body.append(dialog);
      }
      const host = dialog.querySelector("#address-search-widget");
      host.replaceChildren();
      if (!dialog.open) dialog.showModal();
      new window.kakao.Postcode({
        oncomplete(result) {
          onSelect({ postalCode: result.zonecode, address: result.roadAddress || result.address });
          dialog.close();
        }
      }).embed(host);
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const page = location.pathname.split("/").pop() || "index.html";
    const productPages = ["index.html", "product.html", "checkout.html", "payment-success.html", "payment-fail.html"];
    const adminPages = ["admin.html", "admin-products.html"];
    const activePage = productPages.includes(page) ? "index.html" : adminPages.includes(page) ? "admin.html" : page;
    document.querySelectorAll(".site-nav a[data-page]").forEach((link) => {
      if (link.dataset.page === activePage) link.setAttribute("aria-current", "page");
    });
    const accountLink = document.querySelector("#account-link");
    if (!accountLink) return;
    try {
      const user = await window.goodsUi.currentUser();
      if (!user) {
        window.goodsUi.renderGlobalNavigation(null);
        return;
      }
      const displayName = await window.goodsUi.displayName(user);
      window.goodsUi.renderGlobalNavigation(user, displayName);
      accountLink.addEventListener("click", async (event) => {
        event.preventDefault();
        await window.goodsShop.auth.signOut();
        location.href = "index.html";
      });
    } catch (error) {
      console.error("Could not read the current session.", error.message);
    }
  });
})();
