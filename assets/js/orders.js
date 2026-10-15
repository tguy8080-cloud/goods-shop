const ordersStatus = document.querySelector("#orders-status");
const ordersList = document.querySelector("#orders-list");

async function loadMyOrders() {
  const user = await goodsUi.currentUser();
  if (!user) {
    goodsUi.message(ordersStatus, "내 주문을 보려면 먼저 로그인해 주세요.");
    document.querySelector("#orders-login").hidden = false;
    return;
  }
  const { data, error } = await goodsShop.from("orders")
    .select("id,status,amount_krw,created_at,paid_at,order_items(product_name,unit_price_krw,quantity,line_total_krw),payments(method,status,created_at)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) {
    goodsUi.message(ordersStatus, "주문 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    return;
  }
  if (!data.length) {
    goodsUi.message(ordersStatus, "아직 주문이 없습니다.");
    return;
  }
  const cards = data.map((order) => {
    const card = document.createElement("article");
    card.className = "order-card";
    const heading = document.createElement("h2");
    heading.textContent = order.order_items?.map((item) => `${item.product_name} × ${item.quantity}`).join(", ") || "주문 상품";
    const details = document.createElement("p");
    const date = new Date(order.created_at).toLocaleString("ko-KR");
    details.textContent = `${date} · ${order.status === "paid" ? "결제 완료" : "결제 대기"} · ${goodsUi.money(order.amount_krw)}`;
    card.append(heading, details);
    return card;
  });
  ordersList.replaceChildren(...cards);
}

loadMyOrders().catch(() => goodsUi.message(ordersStatus, "주문 내역을 불러오지 못했습니다.", "error"));
