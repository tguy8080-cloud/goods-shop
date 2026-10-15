const adminStatus = document.querySelector("#admin-status");
const adminTable = document.querySelector("#admin-table");

async function loadAdminOrders() {
  const user = await goodsUi.currentUser();
  if (!user) {
    goodsUi.message(adminStatus, "관리자로 로그인해 주세요.");
    document.querySelector("#admin-login").hidden = false;
    return;
  }
  if (user.app_metadata?.role !== "admin") {
    goodsUi.message(adminStatus, "이 계정에는 관리자 권한이 없습니다.", "error");
    return;
  }
  const { data, error } = await goodsShop.from("orders")
    .select("id,user_id,status,amount_krw,created_at,profiles(display_name),order_items(product_name,quantity),payments(method,status)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) {
    goodsUi.message(adminStatus, "주문 정보를 읽을 수 없습니다. RLS 관리자 정책을 확인해 주세요.", "error");
    return;
  }
  const rows = data.map((order) => {
    const row = document.createElement("tr");
    const values = [
      new Date(order.created_at).toLocaleString("ko-KR"),
      order.profiles?.display_name || order.user_id,
      order.order_items?.map((item) => `${item.product_name} × ${item.quantity}`).join(", ") || "-",
      goodsUi.money(order.amount_krw),
      order.status === "paid" ? "결제 완료" : "결제 대기",
      order.payments?.[0]?.method || "-"
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  });
  adminTable.querySelector("tbody").replaceChildren(...rows);
  goodsUi.message(adminStatus, data.length ? "최근 주문을 표시하고 있습니다." : "아직 주문이 없습니다.");
}

loadAdminOrders().catch(() => goodsUi.message(adminStatus, "관리자 화면을 불러오지 못했습니다.", "error"));
