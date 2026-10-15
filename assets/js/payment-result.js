const paymentResultStatus = document.querySelector("#payment-result-status");
const params = new URLSearchParams(location.search);
const paymentKey = params.get("paymentKey");
const orderId = params.get("orderId");
const amount = Number(params.get("amount"));

async function confirmPayment() {
  if (!paymentKey || !orderId || !Number.isSafeInteger(amount) || amount < 1) {
    goodsUi.message(paymentResultStatus, "결제 정보를 확인할 수 없습니다. 내 주문에서 상태를 확인해 주세요.", "error");
    return;
  }
  goodsUi.message(paymentResultStatus, "테스트 결제를 확인하고 있습니다…");
  const { error } = await goodsShop.functions.invoke("confirm-payment", {
    body: { paymentKey, orderId, amount }
  });
  if (error) {
    goodsUi.message(paymentResultStatus, "결제 승인을 확인하지 못했습니다. 주문 내역을 확인하거나 다시 시도해 주세요.", "error");
    return;
  }
  goodsUi.message(paymentResultStatus, "테스트 결제가 승인되었습니다. 주문 내역에서 결과를 확인할 수 있습니다.", "success");
  document.querySelector("#payment-result-links").hidden = false;
}

confirmPayment().catch(() => goodsUi.message(paymentResultStatus, "결제를 확인하지 못했습니다. 주문 내역을 확인해 주세요.", "error"));
