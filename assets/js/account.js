const accountStatus = document.querySelector("#account-status");
const accountContent = document.querySelector("#account-content");
const profileForm = document.querySelector("#profile-form");
const profileName = document.querySelector("#profile-display-name");
const profileEditButton = document.querySelector("#profile-edit-button");
const profileSaveButton = document.querySelector("#profile-save-button");
const profileCancelButton = document.querySelector("#profile-cancel-button");
const addressForm = document.querySelector("#address-form");
const addressAddButton = document.querySelector("#address-add-button");
const addressList = document.querySelector("#address-list");
const addressStatus = document.querySelector("#addresses-status");
const addressType = document.querySelector("#address-type");
const customLabelWrap = document.querySelector("#address-custom-label-wrap");
const customLabel = document.querySelector("#address-custom-label");
let accountUser;
let originalDisplayName = "";
let savedAddresses = [];

function setProfileEditing(editing) {
  profileName.disabled = !editing;
  profileEditButton.hidden = editing;
  profileSaveButton.hidden = !editing;
  profileCancelButton.hidden = !editing;
  if (editing) profileName.focus();
}

function selectedAddressLabel() {
  return addressType.value === "기타" ? customLabel.value.trim() : addressType.value;
}

function showAddressForm(address = null) {
  addressForm.reset();
  addressForm.hidden = false;
  addressAddButton.hidden = true;
  addressForm.dataset.addressId = address?.id || "";
  document.querySelector("#address-form-heading").textContent = address ? "배송지 수정" : "새 배송지 추가";
  addressForm.querySelector("button[type=submit]").textContent = address ? "수정 저장" : "배송지 저장";
  const knownLabel = ["집", "직장"].includes(address?.label) ? address.label : "기타";
  addressType.value = address ? knownLabel : "집";
  customLabel.value = knownLabel === "기타" ? (address?.label || "") : "";
  customLabelWrap.hidden = knownLabel !== "기타";
  for (const [name, value] of Object.entries({
    recipient_name: address?.recipient_name || "",
    phone: address?.phone || "",
    postal_code: address?.postal_code || "",
    address1: address?.address1 || "",
    address2: address?.address2 || ""
  })) addressForm.elements.namedItem(name).value = value;
  addressForm.elements.namedItem("is_default").checked = Boolean(address?.is_default);
  addressForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeAddressForm() {
  addressForm.hidden = true;
  addressForm.reset();
  delete addressForm.dataset.addressId;
  document.querySelector("#address-form-heading").textContent = "새 배송지 추가";
  addressForm.querySelector("button[type=submit]").textContent = "배송지 저장";
  addressAddButton.hidden = false;
}

async function loadAddresses() {
  const { data, error } = await goodsShop.from("addresses")
    .select("id,label,recipient_name,phone,postal_code,address1,address2,is_default,created_at,updated_at")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    goodsUi.message(addressStatus, "배송지 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    return;
  }
  savedAddresses = data || [];
  if (!savedAddresses.length) {
    goodsUi.message(addressStatus, "저장된 배송지가 없습니다. 집, 직장 또는 다른 배송지를 필요할 때 추가할 수 있습니다.");
    addressList.replaceChildren();
    return;
  }
  goodsUi.message(addressStatus, "");
  addressList.replaceChildren(...savedAddresses.map((address) => {
    const card = document.createElement("article");
    card.className = "address-card";
    const heading = document.createElement("h3");
    heading.textContent = address.label;
    if (address.is_default) {
      const badge = document.createElement("span");
      badge.className = "default-badge";
      badge.textContent = "기본 배송지";
      heading.append(" ", badge);
    }
    const recipient = document.createElement("p");
    recipient.textContent = `${address.recipient_name} · ${address.phone}`;
    const location = document.createElement("p");
    location.textContent = `(${address.postal_code}) ${address.address1}${address.address2 ? ` ${address.address2}` : ""}`;
    const actions = document.createElement("div");
    actions.className = "button-row address-actions";
    const editButton = document.createElement("button");
    editButton.className = "button button-light";
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.addressId = address.id;
    editButton.textContent = "수정";
    actions.append(editButton);
    if (!address.is_default) {
      const defaultButton = document.createElement("button");
      defaultButton.className = "button button-light";
      defaultButton.type = "button";
      defaultButton.dataset.action = "default";
      defaultButton.dataset.addressId = address.id;
      defaultButton.textContent = "기본 배송지로 설정";
      actions.append(defaultButton);
    }
    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-light";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.addressId = address.id;
    deleteButton.textContent = "삭제";
    actions.append(deleteButton);
    card.append(heading, recipient, location, actions);
    return card;
  }));
}

profileEditButton?.addEventListener("click", () => setProfileEditing(true));
profileCancelButton?.addEventListener("click", () => {
  profileName.value = originalDisplayName;
  setProfileEditing(false);
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const displayName = profileName.value.trim();
  if (!displayName || displayName.length > 80) {
    goodsUi.message(accountStatus, "이름을 1~80자 사이로 입력해 주세요.", "error");
    return;
  }
  const button = profileSaveButton;
  button.disabled = true;
  const { data, error } = await goodsShop.from("profiles")
    .update({ display_name: displayName })
    .eq("id", accountUser.id)
    .select("display_name")
    .single();
  button.disabled = false;
  if (error || !data) {
    goodsUi.message(accountStatus, "이름을 저장하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.", "error");
    return;
  }
  originalDisplayName = data.display_name;
  profileName.value = originalDisplayName;
  setProfileEditing(false);
  goodsUi.setGreeting(accountUser, originalDisplayName);
  goodsUi.message(accountStatus, "이름이 저장되었습니다.", "success");
});

document.querySelector("#password-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = form.elements.namedItem("password").value;
  const confirmation = form.elements.namedItem("password_confirm").value;
  if (password.length < 8) {
    goodsUi.message(accountStatus, "새 비밀번호를 8자 이상 입력해 주세요.", "error");
    return;
  }
  if (password !== confirmation) {
    goodsUi.message(accountStatus, "새 비밀번호와 확인 내용이 서로 다릅니다.", "error");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  const { error } = await goodsShop.auth.updateUser({ password });
  button.disabled = false;
  if (error) {
    goodsUi.message(accountStatus, "비밀번호를 변경하지 못했습니다. 새 비밀번호가 8자 이상인지 확인한 뒤 다시 시도해 주세요.", "error");
    return;
  }
  form.reset();
  goodsUi.message(accountStatus, "비밀번호가 변경되었습니다.", "success");
});

addressAddButton?.addEventListener("click", () => showAddressForm());
document.querySelector("#account-address-search")?.addEventListener("click", () => {
  goodsAddressSearch.open(({ postalCode, address }) => {
    addressForm.elements.namedItem("postal_code").value = postalCode || "";
    addressForm.elements.namedItem("address1").value = address || "";
    addressForm.elements.namedItem("address2").focus();
    goodsUi.message(document.querySelector("#account-address-search-status"), "주소를 선택했습니다. 상세주소를 입력해 주세요.", "success");
  }, document.querySelector("#account-address-search-status"));
});
document.querySelector("#address-cancel-button")?.addEventListener("click", () => {
  closeAddressForm();
});
addressType?.addEventListener("change", () => {
  customLabelWrap.hidden = addressType.value !== "기타";
  if (addressType.value === "기타") customLabel.focus();
});

addressForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const label = selectedAddressLabel();
  if (!label || label.length > 60) {
    goodsUi.message(addressStatus, "배송지 이름을 1~60자 사이로 입력해 주세요.", "error");
    return;
  }
  const address = {
    user_id: accountUser.id,
    label,
    recipient_name: form.elements.namedItem("recipient_name").value.trim(),
    phone: form.elements.namedItem("phone").value.trim(),
    postal_code: form.elements.namedItem("postal_code").value.trim(),
    address1: form.elements.namedItem("address1").value.trim(),
    address2: form.elements.namedItem("address2").value.trim(),
    is_default: form.elements.namedItem("is_default").checked
  };
  const addressId = form.dataset.addressId;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  const request = addressId
    ? goodsShop.from("addresses").update(address).eq("id", addressId).select("id").single()
    : goodsShop.from("addresses").insert(address).select("id").single();
  const { data, error } = await request;
  button.disabled = false;
  if (error || !data) {
    goodsUi.message(addressStatus, "배송지를 저장하지 못했습니다. 주소와 연락처를 확인해 주세요.", "error");
    return;
  }
  const wasEditing = Boolean(addressId);
  closeAddressForm();
  await loadAddresses();
  goodsUi.message(addressStatus, wasEditing ? "배송지가 수정되었습니다." : "배송지가 저장되었습니다.", "success");
});

addressList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const address = savedAddresses.find((item) => item.id === button.dataset.addressId);
  if (!address) return;
  button.disabled = true;
  if (button.dataset.action === "edit") {
    showAddressForm(address);
    button.disabled = false;
    return;
  }
  if (button.dataset.action === "default") {
    const { error } = await goodsShop.from("addresses")
      .update({ is_default: true }).eq("id", address.id);
    button.disabled = false;
    if (error) {
      goodsUi.message(addressStatus, "기본 배송지를 바꾸지 못했습니다. 다시 시도해 주세요.", "error");
      return;
    }
    await loadAddresses();
    goodsUi.message(addressStatus, "기본 배송지가 변경되었습니다.", "success");
    return;
  }
  if (button.dataset.action === "delete") {
    button.disabled = false;
    if (!window.confirm("이 배송지를 삭제할까요? 이미 만든 주문의 배송 정보는 그대로 보관됩니다.")) return;
    button.disabled = true;
    const { data, error } = await goodsShop.from("addresses").delete().eq("id", address.id).select("id");
    button.disabled = false;
    if (error || !data?.length) {
      goodsUi.message(addressStatus, "배송지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      return;
    }
    await loadAddresses();
    goodsUi.message(addressStatus, "배송지가 삭제되었습니다.", "success");
  }
});

document.querySelector("#delete-account-start")?.addEventListener("click", () => {
  document.querySelector("#delete-account-panel").hidden = false;
  document.querySelector("#delete-account-confirmation").focus();
});
document.querySelector("#delete-account-cancel")?.addEventListener("click", () => {
  document.querySelector("#delete-account-panel").hidden = true;
  document.querySelector("#delete-account-confirmation").value = "";
  document.querySelector("#delete-account-button").disabled = true;
});
document.querySelector("#delete-account-confirmation")?.addEventListener("input", (event) => {
  document.querySelector("#delete-account-button").disabled = event.target.value !== "탈퇴";
});
document.querySelector("#delete-account-button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (document.querySelector("#delete-account-confirmation").value !== "탈퇴") return;
  if (!window.confirm("정말 탈퇴하시겠습니까?")) return;
  button.disabled = true;
  goodsUi.message(accountStatus, "계정을 안전하게 정리하고 있습니다…");
  const { error } = await goodsShop.functions.invoke("delete-account", { body: {} });
  if (error) {
    button.disabled = false;
    goodsUi.message(accountStatus, "회원 탈퇴를 완료하지 못했습니다. 로그인을 확인한 뒤 다시 시도해 주세요.", "error");
    return;
  }
  await goodsShop.auth.signOut({ scope: "local" }).catch(() => {});
  location.href = "index.html";
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    accountUser = await goodsUi.currentUser();
    if (!accountUser) {
      document.querySelector("#account-login").hidden = false;
      return;
    }
    const { data: profile, error } = await goodsShop.from("profiles")
      .select("display_name").eq("id", accountUser.id).maybeSingle();
    if (error) throw error;
    originalDisplayName = profile?.display_name?.trim() || await goodsUi.displayName(accountUser);
    profileName.value = originalDisplayName;
    document.querySelector("#profile-email").value = accountUser.email || "";
    accountContent.hidden = false;
    await loadAddresses();
  } catch {
    goodsUi.message(accountStatus, "계정 정보를 불러오지 못했습니다. 새로고침 후 다시 로그인해 주세요.", "error");
  }
});
