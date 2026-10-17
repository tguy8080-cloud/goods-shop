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

  window.goodsUi = {
    money(value) {
      return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
    },
    message(node, value, kind = "info") {
      if (!node) return;
      node.textContent = value;
      node.dataset.kind = kind;
      node.hidden = !value;
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
