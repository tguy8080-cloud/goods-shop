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
    setGreeting(user, displayName) {
      const greeting = document.querySelector("#user-greeting");
      if (!greeting || !user) return;
      const isAdmin = user.app_metadata?.role === "admin";
      greeting.href = "account.html";
      greeting.textContent = `안녕하세요, ${displayName}님${isAdmin ? " (관리자)" : ""}`;
      greeting.hidden = false;
    },
    artClass(key) {
      return ["sun", "blue", "green"].includes(key) ? `art-${key}` : "art-sun";
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".site-nav a[data-page]").forEach((link) => {
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
    });
    const accountLink = document.querySelector("#account-link");
    if (!accountLink) return;
    const greeting = document.querySelector("#user-greeting");
    try {
      const user = await window.goodsUi.currentUser();
      if (!user) return;
      if (greeting) {
        const displayName = await window.goodsUi.displayName(user);
        window.goodsUi.setGreeting(user, displayName);
      }
      accountLink.textContent = "로그아웃";
      accountLink.href = "#logout";
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

