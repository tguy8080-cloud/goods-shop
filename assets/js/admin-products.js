const productAdminStatus = document.querySelector("#product-admin-status");
const productAdminContent = document.querySelector("#product-admin-content");
const productAdminList = document.querySelector("#product-admin-list");
const productForm = document.querySelector("#product-form");
const productEditor = document.querySelector("#product-editor");
const productAddButton = document.querySelector("#product-add-button");
const productFilter = document.querySelector("#product-filter");
let products = [];
let usedProductIds = new Set();
let editingProduct = null;
let imagePreviewUrl = null;

function renderImagePreview(file = null) {
  const preview = document.querySelector("#product-image-preview");
  if (!preview) return;
  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  imagePreviewUrl = file ? URL.createObjectURL(file) : null;
  preview.replaceChildren();
  const imageUrl = imagePreviewUrl || (editingProduct?.image_path ? goodsUi.imageUrl(editingProduct.image_path) : "");
  if (!imageUrl) {
    const note = document.createElement("p");
    note.className = "fine-print";
    note.textContent = "선택한 이미지 미리보기가 여기에 표시됩니다.";
    preview.append(note);
    return;
  }
  const image = document.createElement("img");
  image.className = "product-image-preview-photo";
  image.src = imageUrl;
  image.alt = file ? "선택한 상품 이미지 미리보기" : `${editingProduct.name} 현재 상품 이미지`;
  image.addEventListener("error", () => {
    const note = document.createElement("p");
    note.className = "fine-print";
    note.textContent = "이미지 미리보기를 불러오지 못했습니다.";
    preview.replaceChildren(note);
  }, { once: true });
  preview.append(image);
}

function setEditor(product = null) {
  editingProduct = product;
  productEditor.hidden = false;
  productAddButton.hidden = true;
  productForm.reset();
  productForm.elements.namedItem("is_active").checked = product ? product.is_active : true;
  productForm.elements.namedItem("art_key").value = product?.art_key || "sun";
  productForm.elements.namedItem("slug").value = product?.slug || "";
  productForm.elements.namedItem("name").value = product?.name || "";
  productForm.elements.namedItem("price_krw").value = product?.price_krw ?? "";
  productForm.elements.namedItem("description").value = product?.description || "";
  renderImagePreview();
  document.querySelector("#product-editor-heading").textContent = product ? "상품 수정" : "상품 추가";
  document.querySelector("#product-save-button").textContent = product ? "변경사항 저장" : "상품 추가";
  document.querySelector("#product-cancel-button").hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  editingProduct = null;
  productForm.reset();
  productEditor.hidden = true;
  productAddButton.hidden = false;
  document.querySelector("#product-editor-heading").textContent = "상품 추가";
  document.querySelector("#product-save-button").textContent = "상품 추가";
  document.querySelector("#product-cancel-button").hidden = true;
  renderImagePreview();
}

function makeProductCard(product) {
  const card = document.createElement("article");
  card.className = "admin-product-card";
  if (product.image_path) {
    const image = document.createElement("img");
    image.className = "admin-product-photo";
    image.src = goodsUi.imageUrl(product.image_path);
    image.alt = `${product.name} 상품 이미지`;
    card.append(image);
  } else {
    const art = document.createElement("div");
    art.className = `admin-product-art ${goodsUi.artClass(product.art_key)}`;
    art.textContent = product.name;
    card.append(art);
  }
  const info = document.createElement("div");
  info.className = "admin-product-info";
  const heading = document.createElement("h3");
  heading.textContent = product.name;
  const slug = document.createElement("p");
  slug.className = "fine-print";
  slug.textContent = product.slug;
  const price = document.createElement("p");
  price.className = "product-price";
  price.textContent = goodsUi.money(product.price_krw);
  const badge = document.createElement("span");
  badge.className = product.is_active ? "product-state is-active" : "product-state";
  badge.textContent = product.is_active ? "판매중" : "판매중지";
  const actions = document.createElement("div");
  actions.className = "button-row admin-product-actions";
  const edit = document.createElement("button");
  edit.className = "button button-light";
  edit.type = "button";
  edit.dataset.action = "edit";
  edit.dataset.productId = product.id;
  edit.textContent = "수정";
  actions.append(edit);
  const toggle = document.createElement("button");
  toggle.className = "button button-light";
  toggle.type = "button";
  toggle.dataset.action = "toggle";
  toggle.dataset.productId = product.id;
  toggle.textContent = product.is_active ? "판매중지" : "판매 재개";
  actions.append(toggle);
  if (!product.is_active && !usedProductIds.has(product.id)) {
    const remove = document.createElement("button");
    remove.className = "button button-light";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.productId = product.id;
    remove.textContent = "완전 삭제";
    actions.append(remove);
  }
  info.append(heading, slug, price, badge, actions);
  card.append(info);
  return card;
}

function renderProducts() {
  const filter = productFilter.value;
  const visible = products.filter((product) => filter === "all" || product.is_active === (filter === "active"));
  productAdminList.replaceChildren(...visible.map(makeProductCard));
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "notice";
    empty.textContent = "표시할 상품이 없습니다.";
    productAdminList.append(empty);
  }
}

async function loadProducts() {
  const [{ data, error }, usage] = await Promise.all([
    goodsShop.from("products").select("id,slug,name,description,price_krw,art_key,is_active,image_path").order("created_at", { ascending: false }),
    goodsShop.from("order_items").select("product_id")
  ]);
  if (error) throw error;
  if (usage.error) {
    usedProductIds = new Set((data || []).map((item) => item.id));
    goodsUi.message(productAdminStatus, "주문 이력을 확인하지 못해 상품 완전 삭제를 막았습니다. 판매중지나 수정을 이용해 주세요.", "error");
  } else {
    usedProductIds = new Set((usage.data || []).map((item) => item.product_id).filter(Boolean));
  }
  products = data || [];
  renderProducts();
}

async function uploadProductImage(productId, file) {
  if (!file) return null;
  const supported = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (!supported[file.type] || file.size > 5 * 1024 * 1024) {
    throw new Error("JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요.");
  }
  const path = `${productId}/${crypto.randomUUID()}.${supported[file.type]}`;
  const { error } = await goodsShop.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function removeImage(path) {
  if (!path) return true;
  try {
    const { error } = await goodsShop.storage.from("product-images").remove([path]);
    if (error) console.warn("A product image could not be removed.", error.message);
    return !error;
  } catch (error) {
    console.warn("A product image could not be removed.", error.message);
    return false;
  }
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const slug = form.elements.namedItem("slug").value.trim().toLowerCase();
  const name = form.elements.namedItem("name").value.trim();
  const price = Number(form.elements.namedItem("price_krw").value);
  if (!/^[a-z0-9-]+$/.test(slug) || !name || !Number.isInteger(price) || price < 1 || price > 100000000) {
    goodsUi.message(productAdminStatus, "상품 코드, 상품명, 1원 이상 가격을 확인해 주세요.", "error");
    return;
  }
  const file = form.elements.namedItem("image").files[0];
  const oldPath = editingProduct?.image_path || null;
  const wasEditing = Boolean(editingProduct);
  const values = {
    slug,
    name,
    description: form.elements.namedItem("description").value.trim(),
    price_krw: price,
    art_key: form.elements.namedItem("art_key").value,
    is_active: form.elements.namedItem("is_active").checked
  };
  const button = document.querySelector("#product-save-button");
  button.disabled = true;
  let uploadedPath = null;
  let imageCleanupFailed = false;
  let databaseSaved = false;
  try {
    const productId = editingProduct?.id || crypto.randomUUID();
    if (file) uploadedPath = await uploadProductImage(productId, file);
    const savedValues = uploadedPath ? { ...values, image_path: uploadedPath } : values;
    if (productId) {
      if (wasEditing) {
        const { error } = await goodsShop.from("products").update(savedValues).eq("id", productId);
        if (error) throw error;
      } else {
        const { error } = await goodsShop.from("products").insert({ id: productId, ...savedValues });
        if (error) throw error;
      }
      databaseSaved = true;
    }
    if (uploadedPath && oldPath) imageCleanupFailed = !(await removeImage(oldPath));
    resetEditor();
    await loadProducts();
    const savedMessage = wasEditing ? "상품 정보가 저장되었습니다." : "상품이 등록되었습니다.";
    goodsUi.message(productAdminStatus, imageCleanupFailed ? `${savedMessage} 다만 이전 이미지 파일을 정리하지 못했습니다.` : savedMessage, imageCleanupFailed ? "error" : "success");
  } catch (error) {
    const cleanupFailed = uploadedPath && !databaseSaved ? !(await removeImage(uploadedPath)) : false;
    const saveError = databaseSaved
      ? `상품은 저장했지만 목록을 새로 불러오지 못했습니다. ${error.message || "잠시 후 새로고침해 주세요."}`
      : `상품을 저장하지 못했습니다. ${error.message || "입력값과 권한을 확인해 주세요."}`;
    goodsUi.message(productAdminStatus, cleanupFailed ? `${saveError} 업로드한 임시 이미지 파일도 정리하지 못했습니다.` : saveError, "error");
  } finally {
    button.disabled = false;
  }
});

productAddButton.addEventListener("click", () => setEditor());
document.querySelector("#product-cancel-button").addEventListener("click", resetEditor);
document.querySelector("#product-image")?.addEventListener("change", (event) => renderImagePreview(event.currentTarget.files[0] || null));
productFilter.addEventListener("change", renderProducts);
productAdminList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.productId);
  if (!product) return;
  button.disabled = true;
  try {
    if (button.dataset.action === "edit") {
      setEditor(product);
      return;
    }
    if (button.dataset.action === "toggle") {
      const next = !product.is_active;
      const { error } = await goodsShop.from("products").update({ is_active: next }).eq("id", product.id);
      if (error) throw error;
      await loadProducts();
      goodsUi.message(productAdminStatus, next ? "상품 판매를 다시 시작했습니다." : "상품을 판매중지했습니다. 기존 주문 기록은 보존됩니다.", "success");
      return;
    }
    if (button.dataset.action === "delete") {
      if (usedProductIds.has(product.id)) {
        throw new Error("주문 이력이 있는 상품은 완전 삭제할 수 없습니다. 판매중지를 이용해 주세요.");
      }
      if (!window.confirm(`주문 이력이 없는 “${product.name}” 상품과 연결된 이미지를 완전히 삭제할까요?`)) return;
      const { error } = await goodsShop.from("products").delete().eq("id", product.id);
      if (error) throw error;
      const imageRemoved = await removeImage(product.image_path);
      await loadProducts();
      goodsUi.message(productAdminStatus, imageRemoved ? "상품과 연결된 이미지를 완전히 삭제했습니다." : "상품은 삭제했지만 연결된 이미지 파일 정리에 실패했습니다.", imageRemoved ? "success" : "error");
    }
  } catch (error) {
    goodsUi.message(productAdminStatus, error.message || "상품 변경을 완료하지 못했습니다.", "error");
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await goodsUi.currentUser();
    if (!user) {
      document.querySelector("#product-admin-login").hidden = false;
      goodsUi.message(productAdminStatus, "관리자로 로그인해 주세요.");
      return;
    }
    if (user.app_metadata?.role !== "admin") {
      goodsUi.message(productAdminStatus, "이 계정에는 관리자 권한이 없습니다.", "error");
      return;
    }
    productAdminContent.hidden = false;
    await loadProducts();
    if (!productAdminStatus.dataset.kind || productAdminStatus.dataset.kind !== "error") {
      goodsUi.message(productAdminStatus, "상품 목록을 표시하고 있습니다.");
    }
  } catch {
    goodsUi.message(productAdminStatus, "상품 관리 화면을 불러오지 못했습니다.", "error");
  }
});
