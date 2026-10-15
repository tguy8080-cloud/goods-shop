const checkoutStatus = document.querySelector("#checkout-status");
const checkoutForm = document.querySelector("#checkout-form");
const productIdForCheckout = new URLSearchParams(location.search).get("product_id");
let selectedProduct;

async function prepareCheckout() {
  const user = await goodsUi.currentUser();
  if (!user) {
    goodsUi.message(checkoutStatus, "먼저 로그인해 주세요.", "error");
    checkoutForm.hidden = true;
    document.querySelector("#checkout-login").hidden = false;
    return;
  }
  if (!productIdForCheckout) {
    goodsUi.message(checkoutStatus, "상품 목록에서 상품을 선택해 주세요.", "error");
    checkoutForm.hidden = true;
    return;
  }
  const { data, error } = await goodsShop.from("products").select("id,name,description,price_krw,art_key").eq("id", productIdForCheckout).eq("is_active", true).maybeSingle();
  if (error || !data) {
    goodsUi.message(checkoutStatus, "상품을 확인할 수 없습니다. 상품 목록으로 돌아가 주세요.", "error");
    checkoutForm.hidden = true;
    return;
  }
  selectedProduct = data;
  document.querySelector("#checkout-product").textContent = data.name;
  document.querySelector("#checkout-unit-price").textContent = goodsUi.money(data.price_krw);
  updateTotal();
  checkoutForm.hidden = false;
}

function updateTotal() {
  if (!selectedProduct) return;
  const quantity = Number(document.querySelector("#quantity").value);
  document.querySelector("#checkout-total").textContent = goodsUi.money(selectedProduct.price_krw * quantity);
}

document.querySelector("#quantity")?.addEventListener("change", updateTotal);
checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const clientKey = window.GOODS_CONFIG.tossTestClientKey.trim();
  if (!/^test_ck_[A-Za-z0-9]+$/.test(clientKey)) {
    goodsUi.message(checkoutStatus, "Toss 테스트 Client Key가 아직 설정되지 않았습니다. 아래 설정 안내를 확인해 주세요.", "error");
    document.querySelector("#toss-setup").hidden = false;
    return;
  }

  const button = checkoutForm.querySelector("button[type=submit]");
  button.disabled = true;
  goodsUi.message(checkoutStatus, "주문 금액을 확인하고 있습니다…");
  const { data: order, error } = await goodsShop.functions.invoke("create-order", {
    body: { productId: selectedProduct.id, quantity: Number(document.querySelector("#quantity").value) }
  });
  if (error || !order?.orderId || !Number.isInteger(order.amountKrw)) {
    button.disabled = false;
    goodsUi.message(checkoutStatus, "주문을 만들지 못했습니다. 로그인 상태와 함수 배포를 확인해 주세요.", "error");
    return;
  }

  try {
    const user = await goodsUi.currentUser();
    const toss = TossPayments(clientKey);
    const payment = toss.payment({ customerKey: user.id });
    await payment.requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: order.amountKrw },
      orderId: order.orderId,
      orderName: order.orderName,
      customerEmail: user.email,
      successUrl: new URL("payment-success.html", location.href).href,
      failUrl: new URL("payment-fail.html", location.href).href
    });
  } catch (error) {
    button.disabled = false;
    goodsUi.message(checkoutStatus, error.message || "결제 창을 열지 못했습니다.", "error");
  }
});

prepareCheckout().catch(() => {
  goodsUi.message(checkoutStatus, "주문 화면을 준비하지 못했습니다. 새로고침 후 다시 시도해 주세요.", "error");
});
