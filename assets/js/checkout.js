const checkoutStatus = document.querySelector("#checkout-status");
const checkoutForm = document.querySelector("#checkout-form");
const productIdForCheckout = new URLSearchParams(location.search).get("product_id");
const choiceList = document.querySelector("#shipping-choice-list");
const newAddressFields = document.querySelector("#new-shipping-fields");
let selectedProduct;
let savedAddresses = [];

function addShippingChoice(value, title, details, isDefault = false) {
  const label = document.createElement("label");
  label.className = "shipping-choice";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "shipping-address-choice";
  radio.value = value;
  radio.checked = isDefault;
  const body = document.createElement("span");
  const heading = document.createElement("strong");
  heading.textContent = `${title}${isDefault && value !== "other" ? " · 기본 배송지" : ""}`;
  const description = document.createElement("small");
  description.textContent = details;
  body.append(heading, description);
  label.append(radio, body);
  choiceList.append(label);
}

function syncShippingForm() {
  const selected = choiceList.querySelector('input[name="shipping-address-choice"]:checked')?.value;
  newAddressFields.hidden = selected !== "other";
  document.querySelector("#shipping-new-default-wrap").hidden =
    selected !== "other" || !document.querySelector("#shipping-save-address").checked;
}

async function loadShippingAddresses() {
  const note = document.querySelector("#shipping-load-note");
  const { data, error } = await goodsShop.from("addresses")
    .select("id,label,recipient_name,phone,postal_code,address1,address2,is_default")
    .order("is_default", { ascending: false }).order("updated_at", { ascending: false });
  if (error) {
    note.hidden = false;
    note.textContent = "저장된 배송지를 불러오지 못했습니다. 주소를 직접 입력해 주세요.";
  } else {
    savedAddresses = data || [];
  }
  for (const address of savedAddresses) {
    const location = `(${address.postal_code}) ${address.address1}${address.address2 ? ` ${address.address2}` : ""}`;
    addShippingChoice(address.id, address.label, `${address.recipient_name} / ${address.phone} · ${location}`, address.is_default);
  }
  addShippingChoice("other", "다른 배송지", "이번 주문에 사용할 주소를 입력합니다.", savedAddresses.length === 0);
  syncShippingForm();
}

function shippingRequestValue() {
  const choice = document.querySelector("#delivery-request-choice").value;
  return choice === "직접 입력" ? document.querySelector("#delivery-request-custom").value.trim() : choice;
}

function getShippingPayload() {
  const selectedAddressId = choiceList.querySelector('input[name="shipping-address-choice"]:checked')?.value;
  if (!selectedAddressId) throw new Error("배송지를 선택해 주세요.");
  if (selectedAddressId !== "other") {
    return { addressId: selectedAddressId, newAddress: null, saveAddress: false, newAddressIsDefault: false, newAddressLabel: null };
  }
  const form = document.querySelector("#new-shipping-fields");
  const newAddress = {
    recipientName: form.querySelector("#shipping-recipient").value.trim(),
    phone: form.querySelector("#shipping-phone").value.trim(),
    postalCode: form.querySelector("#shipping-postal-code").value.trim(),
    address1: form.querySelector("#shipping-address1").value.trim(),
    address2: form.querySelector("#shipping-address2").value.trim()
  };
  if (!newAddress.recipientName || !newAddress.phone || !newAddress.postalCode || !newAddress.address1) {
    throw new Error("받는 사람, 연락처, 우편번호, 기본주소를 입력해 주세요.");
  }
  const saveAddress = document.querySelector("#shipping-save-address").checked;
  const labelChoice = document.querySelector("#shipping-new-label").value;
  const customLabel = document.querySelector("#shipping-custom-label").value.trim();
  if (saveAddress && labelChoice === "기타" && !customLabel) throw new Error("저장할 배송지 이름을 입력해 주세요.");
  return {
    addressId: null,
    newAddress,
    saveAddress,
    newAddressIsDefault: document.querySelector("#shipping-new-default").checked,
    newAddressLabel: labelChoice === "기타" ? customLabel : labelChoice
  };
}

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
  const [{ data, error }] = await Promise.all([
    goodsShop.from("products").select("id,name,description,price_krw,art_key").eq("id", productIdForCheckout).eq("is_active", true).maybeSingle(),
    loadShippingAddresses()
  ]);
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

choiceList?.addEventListener("change", syncShippingForm);
document.querySelector("#shipping-save-address")?.addEventListener("change", syncShippingForm);
document.querySelector("#checkout-address-search")?.addEventListener("click", () => {
  goodsAddressSearch.open(({ postalCode, address }) => {
    document.querySelector("#shipping-postal-code").value = postalCode || "";
    document.querySelector("#shipping-address1").value = address || "";
    document.querySelector("#shipping-address2").focus();
    goodsUi.message(document.querySelector("#checkout-address-search-status"), "주소를 선택했습니다. 상세주소를 입력해 주세요.", "success");
  }, document.querySelector("#checkout-address-search-status"));
});
document.querySelector("#shipping-new-label")?.addEventListener("change", (event) => {
  const custom = document.querySelector("#shipping-custom-label-wrap");
  custom.hidden = event.target.value !== "기타";
});
document.querySelector("#delivery-request-choice")?.addEventListener("change", (event) => {
  document.querySelector("#delivery-request-custom-wrap").hidden = event.target.value !== "직접 입력";
});
document.querySelector("#quantity")?.addEventListener("change", updateTotal);
checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const clientKey = window.GOODS_CONFIG.tossTestClientKey.trim();
  if (!/^test_ck_[A-Za-z0-9]+$/.test(clientKey)) {
    goodsUi.message(checkoutStatus, "Toss 테스트 Client Key가 아직 설정되지 않았습니다. 아래 설정 안내를 확인해 주세요.", "error");
    document.querySelector("#toss-setup").hidden = false;
    return;
  }
  let shipping;
  try {
    shipping = getShippingPayload();
  } catch (error) {
    goodsUi.message(checkoutStatus, error.message, "error");
    return;
  }

  const button = checkoutForm.querySelector("button[type=submit]");
  button.disabled = true;
  goodsUi.message(checkoutStatus, "주문 금액과 배송 정보를 확인하고 있습니다.");
  const { data: order, error } = await goodsShop.functions.invoke("create-order", {
    body: {
      productId: selectedProduct.id,
      quantity: Number(document.querySelector("#quantity").value),
      ...shipping,
      deliveryRequest: shippingRequestValue()
    }
  });
  if (error || !order?.orderId || !Number.isInteger(order.amountKrw)) {
    button.disabled = false;
    goodsUi.message(checkoutStatus, "주문을 만들지 못했습니다. 배송 정보와 로그인 상태를 확인해 주세요.", "error");
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
