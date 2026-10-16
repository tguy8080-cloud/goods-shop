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
    .select("id,user_id,status,amount_krw,created_at,profiles(display_name),order_items(product_name,quantity),payments(method,status),order_shipping_addresses(label,recipient_name,phone,postal_code,address1,address2,delivery_request)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) {
    goodsUi.message(adminStatus, "주문 정보를 읽을 수 없습니다. 관리자 조회 권한을 확인해 주세요.", "error");
    return;
  }
  const rows = data.map((order) => {
    const row = document.createElement("tr");
    const shipping = Array.isArray(order.order_shipping_addresses)
      ? order.order_shipping_addresses[0]
      : order.order_shipping_addresses;
    const shippingText = shipping
      ? [`받는 사람: ${shipping.recipient_name}`, `연락처: ${shipping.phone}`, `(${shipping.postal_code}) ${shipping.address1}`, shipping.address2 ? `상세주소: ${shipping.address2}` : "", shipping.delivery_request ? `요청: ${shipping.delivery_request}` : ""].filter(Boolean).join("\n")
      : "배송 정보 없음";
    const values = [
      new Date(order.created_at).toLocaleString("ko-KR"),
      order.profiles?.display_name || (order.user_id ? "이름 미설정" : "탈퇴 회원"),
      order.order_items?.map((item) => `${item.product_name} × ${item.quantity}`).join(", ") || "-",
      goodsUi.money(order.amount_krw),
      order.status === "paid" ? "결제 완료" : "결제 대기",
      order.payments?.[0]?.method || "-",
      shippingText
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
