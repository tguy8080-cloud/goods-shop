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
    .select("id,status,amount_krw,created_at,paid_at,order_items(product_name,unit_price_krw,quantity,line_total_krw),payments(method,status,created_at),order_shipping_addresses(label,recipient_name,phone,postal_code,address1,address2,delivery_request)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) {
    goodsUi.message(ordersStatus, "주문 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    return;
  }
  if (!data?.length) {
    goodsUi.message(ordersStatus, "아직 주문이 없습니다.");
    return;
  }
  ordersStatus.hidden = true;
  const cards = data.map((order) => {
    const card = document.createElement("article");
    card.className = "order-card";
    const heading = document.createElement("h2");
    heading.textContent = order.order_items?.map((item) => `${item.product_name} × ${item.quantity}`).join(", ") || "주문 상품";
    const details = document.createElement("p");
    const date = new Date(order.created_at).toLocaleString("ko-KR");
    details.textContent = `${date} · ${order.status === "paid" ? "결제 완료" : "결제 대기"} · ${goodsUi.money(order.amount_krw)}`;
    card.append(heading, details);

    const shipping = Array.isArray(order.order_shipping_addresses)
      ? order.order_shipping_addresses[0]
      : order.order_shipping_addresses;
    if (shipping) {
      const shippingDetails = document.createElement("p");
      shippingDetails.className = "order-shipping";
      const place = document.createElement("span");
      place.textContent = `배송지: ${shipping.label} · (${shipping.postal_code}) ${shipping.address1}${shipping.address2 ? ` ${shipping.address2}` : ""}`;
      const person = document.createElement("span");
      const phoneDigits = shipping.phone.replace(/\D/g, "");
      const maskedPhone = phoneDigits.length >= 7
        ? `${phoneDigits.slice(0, 3)}-****-${phoneDigits.slice(-4)}`
        : shipping.phone;
      person.textContent = `받는 사람: ${shipping.recipient_name} · ${maskedPhone}`;
      shippingDetails.append(place, person);
      if (shipping.delivery_request) {
        const request = document.createElement("span");
        request.textContent = `배송 요청: ${shipping.delivery_request}`;
        shippingDetails.append(request);
      }
      card.append(shippingDetails);
    }

    if (order.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "button-row";
      const remove = document.createElement("button");
      remove.className = "button button-light";
      remove.type = "button";
      remove.textContent = "주문 삭제";
      remove.dataset.orderId = order.id;
      actions.append(remove);
      card.append(actions);
    }
    return card;
  });
  ordersList.replaceChildren(...cards);
}

ordersList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-order-id]");
  if (!button) return;
  if (!window.confirm("아직 결제되지 않은 주문입니다.\n이 주문을 삭제할까요?")) return;
  button.disabled = true;
  const { data, error } = await goodsShop.functions.invoke("delete-pending-order", {
    body: { orderId: button.dataset.orderId }
  });
  if (error || !data?.deleted) {
    button.disabled = false;
    goodsUi.message(ordersStatus, "미결제 주문을 삭제하지 못했습니다. 결제 상태를 확인하고 다시 시도해 주세요.", "error");
    return;
  }
  ordersStatus.hidden = false;
  goodsUi.message(ordersStatus, "미결제 주문을 삭제했습니다.", "success");
  await loadMyOrders();
});

loadMyOrders().catch(() => goodsUi.message(ordersStatus, "주문 내역을 불러오지 못했습니다.", "error"));

