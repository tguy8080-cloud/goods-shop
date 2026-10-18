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
const productImageInput = document.querySelector("#product-image");
const productImageEditButton = document.querySelector("#product-image-edit");
const productImageChooseButton = document.querySelector("#product-image-choose");
const productCropDialog = document.querySelector("#product-crop-dialog");
const productCropCanvas = document.querySelector("#product-crop-canvas");
const productCropContext = productCropCanvas?.getContext("2d");
const productCropZoom = document.querySelector("#product-crop-zoom");
let cropSourceFile = null;
let cropSourceMode = null;
let cropSourceFileBeforeEditing = null;
let cropSourceModeBeforeEditing = null;
let cropBitmap = null;
let cropView = null;
let cropPending = false;
let cropFileBeforeEditing = null;
let appliedProductImageFile = null;
let reorderSaving = false;
let queuedProductOrder = null;
let lastSavedProductOrder = [];
let activeProductDrag = null;

goodsUi.validation.attach(productForm, {
  name: { validate: (value) => value.trim() ? "" : "상품명을 입력해 주세요." },
  price_krw: {
    validateWhileTyping: true,
    validate: (value) => {
      if (!value.trim()) return "가격을 입력해 주세요.";
      const price = Number(value);
      if (!Number.isInteger(price)) return "가격은 원 단위 정수로 입력해 주세요.";
      if (price < 1) return "가격은 1원 이상 입력해 주세요.";
      if (price > 100000000) return "가격은 100,000,000원 이하로 입력해 주세요.";
      return "";
    }
  }
}, {
  summary: productAdminStatus,
  summaryText: "입력 항목을 확인해 주세요."
});

function renderImagePreview(file = null) {
  const preview = document.querySelector("#product-image-preview");
  if (!preview) return;
  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  imagePreviewUrl = file ? URL.createObjectURL(file) : null;
  preview.replaceChildren();
  const imageUrl = imagePreviewUrl || (editingProduct?.image_path ? goodsUi.imageUrl(editingProduct.image_path) : "");
  productImageEditButton.hidden = !(file || editingProduct?.image_path);
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
  cropSourceFile = null;
  cropSourceMode = null;
  cropSourceFileBeforeEditing = null;
  cropSourceModeBeforeEditing = null;
  cropPending = false;
  appliedProductImageFile = null;
  if (productImageInput) productImageInput.value = "";
  editingProduct = product;
  productEditor.hidden = false;
  productAddButton.hidden = true;
  productForm.reset();
  productForm.elements.namedItem("is_active").checked = product ? product.is_active : true;
  productForm.elements.namedItem("art_key").value = product?.art_key || "sun";
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
  cropPending = false;
  cropSourceFile = null;
  cropSourceMode = null;
  cropSourceFileBeforeEditing = null;
  cropSourceModeBeforeEditing = null;
  cropFileBeforeEditing = null;
  appliedProductImageFile = null;
  if (cropBitmap?.close) cropBitmap.close();
  cropBitmap = null;
  if (productImageInput) productImageInput.value = "";
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
  card.dataset.productId = product.id;
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
  const titleRow = document.createElement("div");
  titleRow.className = "admin-product-title-row";
  const handle = document.createElement("button");
  handle.className = "product-drag-handle";
  handle.type = "button";
  handle.dataset.reorderHandle = "true";
  handle.setAttribute("aria-label", `상품 ${product.name} 순서 이동`);
  handle.title = "잡고 끌어 상품 순서를 바꾸세요";
  handle.textContent = "≡";
  handle.disabled = productFilter.value !== "all";
  const position = document.createElement("span");
  position.className = "product-order-number";
  position.textContent = String(products.findIndex((item) => item.id === product.id) + 1);
  heading.textContent = product.name;
  titleRow.append(handle, position, heading);
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
  const moveUp = document.createElement("button");
  moveUp.className = "button button-light product-order-button";
  moveUp.type = "button";
  moveUp.dataset.action = "move-up";
  moveUp.dataset.productId = product.id;
  moveUp.textContent = "위로";
  moveUp.disabled = productFilter.value !== "all" || products.findIndex((item) => item.id === product.id) === 0;
  actions.append(moveUp);
  const moveDown = document.createElement("button");
  moveDown.className = "button button-light product-order-button";
  moveDown.type = "button";
  moveDown.dataset.action = "move-down";
  moveDown.dataset.productId = product.id;
  moveDown.textContent = "아래로";
  moveDown.disabled = productFilter.value !== "all" || products.findIndex((item) => item.id === product.id) === products.length - 1;
  actions.append(moveDown);
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
  info.append(titleRow, price, badge, actions);
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
    goodsShop.from("products").select("id,slug,name,description,price_krw,art_key,is_active,image_path,sort_order,created_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true }),
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
  lastSavedProductOrder = products.map((product) => product.id);
  renderProducts();
}

async function saveProductOrder(order) {
  queuedProductOrder = order;
  if (reorderSaving) return;
  reorderSaving = true;
  while (queuedProductOrder) {
    const nextOrder = queuedProductOrder;
    queuedProductOrder = null;
    let error = null;
    try {
      ({ error } = await goodsShop.rpc("reorder_products", { p_product_ids: nextOrder }));
    } catch (requestError) {
      error = requestError;
    }
    if (error) {
      if (!queuedProductOrder) {
        products.sort((a, b) => lastSavedProductOrder.indexOf(a.id) - lastSavedProductOrder.indexOf(b.id));
        renderProducts();
        goodsUi.message(productAdminStatus, "상품 순서를 저장하지 못했습니다. 다시 시도해 주세요.", "error");
      }
      continue;
    }
    lastSavedProductOrder = nextOrder;
    if (!queuedProductOrder) goodsUi.message(productAdminStatus, "✓ 상품 순서가 저장되었습니다.", "success");
  }
  reorderSaving = false;
}

function moveProductBy(id, offset) {
  if (productFilter.value !== "all") return;
  const from = products.findIndex((item) => item.id === id);
  const to = Math.max(0, Math.min(products.length - 1, from + offset));
  if (from < 0 || from === to) return;
  const [item] = products.splice(from, 1);
  products.splice(to, 0, item);
  renderProducts();
  void saveProductOrder(products.map((product) => product.id));
}

productAdminList.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-reorder-handle]");
  const card = handle?.closest(".admin-product-card");
  if (!handle || handle.disabled || productFilter.value !== "all" || reorderSaving) return;
  activeProductDrag = { id: card.dataset.productId, pointerId: event.pointerId };
  card.classList.add("is-dragging");
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
});
productAdminList.addEventListener("pointermove", (event) => {
  if (!activeProductDrag || event.pointerId !== activeProductDrag.pointerId) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".admin-product-card");
  const source = productAdminList.querySelector(`[data-product-id="${CSS.escape(activeProductDrag.id)}"]`);
  if (!target || !source || target === source) return;
  target.classList.add("drop-target");
  const rect = target.getBoundingClientRect();
  if (event.clientY < rect.top + rect.height / 2) productAdminList.insertBefore(source, target);
  else productAdminList.insertBefore(source, target.nextSibling);
  productAdminList.querySelectorAll(".drop-target").forEach((node) => { if (node !== target) node.classList.remove("drop-target"); });
});
productAdminList.addEventListener("pointerup", (event) => {
  if (!activeProductDrag || event.pointerId !== activeProductDrag.pointerId) return;
  const id = activeProductDrag.id;
  activeProductDrag = null;
  productAdminList.querySelectorAll(".is-dragging, .drop-target").forEach((node) => node.classList.remove("is-dragging", "drop-target"));
  const order = [...productAdminList.querySelectorAll(".admin-product-card")].map((card) => card.dataset.productId);
  if (order.length === products.length && order.some((value, index) => value !== products[index].id)) {
    const byId = new Map(products.map((product) => [product.id, product]));
    products = order.map((productId) => byId.get(productId));
    renderProducts();
    void saveProductOrder(order);
  }
});
productAdminList.addEventListener("pointercancel", () => {
  activeProductDrag = null;
  productAdminList.querySelectorAll(".is-dragging, .drop-target").forEach((node) => node.classList.remove("is-dragging", "drop-target"));
  renderProducts();
});

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TARGET_BYTES = 4.5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decodeProductImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall back to an Image element for browsers that cannot decode this file as a bitmap.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
      element.src = objectUrl;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지 용량을 줄이지 못했습니다."));
    }, type, quality);
  });
}

function fileForOptimizedBlob(blob, originalFile) {
  const extensionByType = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
  const extension = extensionByType[blob.type];
  if (!extension) throw new Error("이미지 변환 결과를 확인할 수 없습니다.");
  const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "product-image";
  return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: Date.now() });
}

function formatProductImageSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function optimizeProductImage(file) {
  if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
    throw new Error("JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.");
  }
  if (file.size <= PRODUCT_IMAGE_MAX_BYTES) return file;

  let decoded;
  try {
    decoded = await decodeProductImage(file);
    if (!decoded.width || !decoded.height) throw new Error("이미지 크기를 확인할 수 없습니다.");

    let scale = Math.min(1, 4096 / Math.max(decoded.width, decoded.height));
    let quality = 0.88;
    let lastBlob = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지 편집 기능을 사용할 수 없습니다.");
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);

      let blob = await canvasToBlob(canvas, "image/webp", quality);
      if (blob.type !== "image/webp") {
        const fallbackType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
        blob = await canvasToBlob(canvas, fallbackType, fallbackType === "image/jpeg" ? quality : undefined);
      }
      lastBlob = blob;
      if (blob.size <= PRODUCT_IMAGE_TARGET_BYTES) return fileForOptimizedBlob(blob, file);

      const sizeScale = Math.sqrt(PRODUCT_IMAGE_TARGET_BYTES / blob.size) * 0.88;
      scale *= Math.min(0.85, sizeScale);
      if (blob.type !== "image/png") quality = Math.max(0.5, quality - 0.07);
    }

    if (lastBlob && lastBlob.size <= PRODUCT_IMAGE_MAX_BYTES) return fileForOptimizedBlob(lastBlob, file);
    throw new Error("이미지를 5MB 이하로 줄이지 못했습니다. 다른 이미지 파일을 사용해 주세요.");
  } catch (error) {
    if (error.message?.includes("이미지")) throw error;
    throw new Error("이미지를 자동으로 최적화하지 못했습니다. 다른 이미지 파일을 사용해 주세요.");
  } finally {
    decoded?.close();
  }
}

async function optimizeAndReportProductImage(file) {
  if (file.size <= PRODUCT_IMAGE_MAX_BYTES) return file;
  goodsUi.message(productAdminStatus, "이미지를 최적화하고 있습니다…");
  const optimizedFile = await optimizeProductImage(file);
  goodsUi.message(
    productAdminStatus,
    `${formatProductImageSize(file.size)} → ${formatProductImageSize(optimizedFile.size)}로 최적화되었습니다.`,
    "success"
  );
  return optimizedFile;
}

const PRODUCT_IMAGE_OUTPUT_SIZE = 1200;
const CROP_FRAME_SIZE = 420;
const CROP_FRAME_LEFT = 90;

function clampCropOffset() {
  if (!cropView) return;
  const drawWidth = cropView.width * cropView.scale;
  const drawHeight = cropView.height * cropView.scale;
  const maxOffsetX = Math.max(0, (drawWidth - CROP_FRAME_SIZE) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - CROP_FRAME_SIZE) / 2);
  cropView.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, cropView.offsetX));
  cropView.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, cropView.offsetY));
}

function drawProductCrop() {
  if (!cropBitmap || !cropView || !productCropContext) return;
  const { scale, offsetX, offsetY, width, height } = cropView;
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const left = CROP_FRAME_LEFT + (CROP_FRAME_SIZE - drawWidth) / 2 + offsetX;
  const top = (CROP_FRAME_SIZE - drawHeight) / 2 + offsetY;
  productCropContext.clearRect(0, 0, productCropCanvas.width, productCropCanvas.height);
  productCropContext.fillStyle = "#252724";
  productCropContext.fillRect(0, 0, productCropCanvas.width, productCropCanvas.height);
  productCropContext.drawImage(cropBitmap.image, left, top, drawWidth, drawHeight);
  productCropContext.fillStyle = "rgba(16, 18, 17, .58)";
  productCropContext.fillRect(0, 0, CROP_FRAME_LEFT, productCropCanvas.height);
  productCropContext.fillRect(CROP_FRAME_LEFT + CROP_FRAME_SIZE, 0, CROP_FRAME_LEFT, productCropCanvas.height);
  productCropContext.strokeStyle = "rgba(255,255,255,.96)";
  productCropContext.lineWidth = 2;
  productCropContext.strokeRect(CROP_FRAME_LEFT + 1, 1, CROP_FRAME_SIZE - 2, CROP_FRAME_SIZE - 2);
}

async function openProductCropEditor(file, mode = "new") {
  if (!PRODUCT_IMAGE_TYPES.has(file.type)) throw new Error("JPG, PNG, WebP 형식의 이미지만 사용할 수 있습니다.");
  if (cropBitmap?.close) cropBitmap.close();
  const decodedImage = await decodeProductImage(file);
  if (!decodedImage.width || !decodedImage.height) {
    decodedImage.close?.();
    throw new Error("이미지 크기를 확인할 수 없습니다.");
  }
  cropBitmap = decodedImage;
  cropFileBeforeEditing = appliedProductImageFile;
  cropSourceFileBeforeEditing = cropSourceFile;
  cropSourceModeBeforeEditing = cropSourceMode;
  cropSourceFile = file;
  cropSourceMode = mode;
  cropPending = true;
  const baseScale = Math.max(CROP_FRAME_SIZE / cropBitmap.width, CROP_FRAME_SIZE / cropBitmap.height);
  cropView = { width: cropBitmap.width, height: cropBitmap.height, baseScale, scale: baseScale, offsetX: 0, offsetY: 0, dragging: false };
  productCropZoom.value = "1";
  try {
    drawProductCrop();
    if (!productCropDialog.open) productCropDialog.showModal();
    document.querySelector("#product-crop-reset").focus({ preventScroll: true });
  } catch (error) {
    cropBitmap?.close?.();
    cropBitmap = null;
    cropView = null;
    cropSourceFile = cropSourceFileBeforeEditing;
    cropSourceMode = cropSourceModeBeforeEditing;
    cropFileBeforeEditing = null;
    cropSourceFileBeforeEditing = null;
    cropSourceModeBeforeEditing = null;
    cropPending = false;
    throw error;
  }
}

function finishProductCropEditor(applied) {
  if (!applied) {
    if (cropFileBeforeEditing) {
      const transfer = new DataTransfer();
      transfer.items.add(cropFileBeforeEditing);
      productImageInput.files = transfer.files;
      appliedProductImageFile = cropFileBeforeEditing;
      renderImagePreview(appliedProductImageFile);
    } else {
      productImageInput.value = "";
      renderImagePreview();
    }
    cropSourceFile = cropSourceFileBeforeEditing;
    cropSourceMode = cropSourceModeBeforeEditing;
    cropPending = false;
  } else {
    appliedProductImageFile = productImageInput.files[0] || appliedProductImageFile;
  }
  cropFileBeforeEditing = null;
  cropSourceFileBeforeEditing = null;
  cropSourceModeBeforeEditing = null;
  productCropDialog.close();
  if (cropBitmap?.close) cropBitmap.close();
  cropBitmap = null;
  cropView = null;
}

async function createProductCropFile() {
  if (!cropBitmap || !cropView || !cropSourceFile) throw new Error("먼저 상품 사진을 선택해 주세요.");
  const drawWidth = cropView.width * cropView.scale;
  const drawHeight = cropView.height * cropView.scale;
  const imageLeft = CROP_FRAME_LEFT + (CROP_FRAME_SIZE - drawWidth) / 2 + cropView.offsetX;
  const imageTop = (CROP_FRAME_SIZE - drawHeight) / 2 + cropView.offsetY;
  const sourceSize = CROP_FRAME_SIZE / cropView.scale;
  const sourceX = (CROP_FRAME_LEFT - imageLeft) / cropView.scale;
  const sourceY = -imageTop / cropView.scale;
  const canvas = document.createElement("canvas");
  canvas.width = PRODUCT_IMAGE_OUTPUT_SIZE;
  canvas.height = PRODUCT_IMAGE_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 편집 기능을 사용할 수 없습니다.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(cropBitmap.image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, PRODUCT_IMAGE_OUTPUT_SIZE, PRODUCT_IMAGE_OUTPUT_SIZE);

  let blob = null;
  for (const quality of [0.94, 0.88, 0.82, 0.76, 0.68, 0.60, 0.52]) {
    blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size <= PRODUCT_IMAGE_TARGET_BYTES) break;
  }
  if (!blob || !["image/webp", "image/jpeg", "image/png"].includes(blob.type)) {
    throw new Error("이 브라우저에서는 상품 이미지를 만들 수 없습니다.");
  }
  if (blob.size > PRODUCT_IMAGE_MAX_BYTES) throw new Error("사진 용량을 5MiB 이하로 줄이지 못했습니다. 다른 이미지를 선택해 주세요.");
  return fileForOptimizedBlob(blob, cropSourceFile);
}

productCropZoom.addEventListener("input", () => {
  if (!cropView) return;
  const nextScale = cropView.baseScale * Number(productCropZoom.value);
  const ratio = nextScale / cropView.scale;
  cropView.offsetX *= ratio;
  cropView.offsetY *= ratio;
  cropView.scale = nextScale;
  clampCropOffset();
  drawProductCrop();
});

productCropCanvas.addEventListener("pointerdown", (event) => {
  if (!cropView) return;
  cropView.dragging = true;
  cropView.lastX = event.clientX;
  cropView.lastY = event.clientY;
  productCropCanvas.setPointerCapture(event.pointerId);
});
productCropCanvas.addEventListener("pointermove", (event) => {
  if (!cropView?.dragging) return;
  const bounds = productCropCanvas.getBoundingClientRect();
  const factorX = productCropCanvas.width / bounds.width;
  const factorY = productCropCanvas.height / bounds.height;
  cropView.offsetX += (event.clientX - cropView.lastX) * factorX;
  cropView.offsetY += (event.clientY - cropView.lastY) * factorY;
  cropView.lastX = event.clientX;
  cropView.lastY = event.clientY;
  clampCropOffset();
  drawProductCrop();
});
productCropCanvas.addEventListener("pointerup", () => { if (cropView) cropView.dragging = false; });
productCropCanvas.addEventListener("pointercancel", () => { if (cropView) cropView.dragging = false; });
productCropCanvas.addEventListener("keydown", (event) => {
  if (!cropView || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const step = event.shiftKey ? 20 : 6;
  if (event.key === "ArrowLeft") cropView.offsetX += step;
  if (event.key === "ArrowRight") cropView.offsetX -= step;
  if (event.key === "ArrowUp") cropView.offsetY += step;
  if (event.key === "ArrowDown") cropView.offsetY -= step;
  clampCropOffset();
  drawProductCrop();
});
document.querySelector("#product-crop-reset").addEventListener("click", () => {
  if (!cropView) return;
  cropView.scale = cropView.baseScale;
  cropView.offsetX = 0;
  cropView.offsetY = 0;
  productCropZoom.value = "1";
  drawProductCrop();
});
document.querySelector("#product-crop-cancel").addEventListener("click", () => finishProductCropEditor(false));
document.querySelector("#product-crop-close").addEventListener("click", () => finishProductCropEditor(false));
productCropDialog.addEventListener("cancel", (event) => { event.preventDefault(); finishProductCropEditor(false); });
document.querySelector("#product-crop-apply").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  goodsUi.message(productAdminStatus, "사진을 맞추고 최적화하고 있습니다…");
  try {
    const file = await createProductCropFile();
    const transfer = new DataTransfer();
    transfer.items.add(file);
    productImageInput.files = transfer.files;
    appliedProductImageFile = file;
    cropPending = false;
    cropSourceMode = "applied";
    renderImagePreview(file);
    goodsUi.message(productAdminStatus, "✓ 사진 맞춤이 완료되었습니다.", "success");
    finishProductCropEditor(true);
  } catch (error) {
    goodsUi.message(productAdminStatus, error.message || "사진을 편집하지 못했습니다.", "error");
  } finally {
    button.disabled = false;
  }
});

productImageChooseButton.addEventListener("click", () => productImageInput.click());
productImageEditButton.addEventListener("click", async () => {
  try {
    if (cropSourceFile) {
      await openProductCropEditor(cropSourceFile, "same");
      return;
    }
    if (!editingProduct?.image_path) return;
    const response = await fetch(goodsUi.imageUrl(editingProduct.image_path));
    if (!response.ok) throw new Error("저장된 사진을 불러오지 못했습니다.");
    const blob = await response.blob();
    const file = new File([blob], `product-${editingProduct.id}.${blob.type.split("/")[1] || "webp"}`, { type: blob.type });
    await openProductCropEditor(file, "existing");
  } catch (error) {
    goodsUi.message(productAdminStatus, error.message || "사진 편집기를 열지 못했습니다.", "error");
  }
});
productImageInput.addEventListener("change", async () => {
  const file = productImageInput.files[0] || null;
  if (!file) return;
  productImageInput.value = "";
  try {
    await openProductCropEditor(file, "new");
  } catch (error) {
    goodsUi.message(productAdminStatus, error.message || "이미지를 열지 못했습니다.", "error");
  }
});

async function uploadProductImage(productId, file) {
  if (!file) return null;
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) throw new Error("상품 사진은 5MiB 이하만 업로드할 수 있습니다.");
  const dimensions = await decodeProductImage(file);
  try {
    if (dimensions.width !== PRODUCT_IMAGE_OUTPUT_SIZE || dimensions.height !== PRODUCT_IMAGE_OUTPUT_SIZE) {
      throw new Error("상품 사진 맞추기를 완료해 주세요.");
    }
  } finally {
    dimensions.close?.();
  }
  const extensionByType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const path = `${productId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
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
    if (error) console.warn("A product image could not be removed.", { code: error?.statusCode || error?.code || "unknown" });
    return !error;
  } catch (error) {
    console.warn("A product image could not be removed.", { code: error?.statusCode || error?.code || "unknown" });
    return false;
  }
}

function createProductSlug() {
  return `prd-${crypto.randomUUID()}`;
}

function isProductSlugConflict(error) {
  return error?.code === "23505" && [error.message, error.details, error.hint]
    .filter(Boolean)
    .some((value) => String(value).includes("products_slug_key"));
}

async function insertProductWithUniqueSlug(productId, values) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await goodsShop.from("products").insert({
      id: productId,
      slug: createProductSlug(),
      ...values
    });
    if (!error) return;
    if (attempt === 0 && isProductSlugConflict(error)) continue;
    throw error;
  }
  throw new Error("상품을 저장하지 못했습니다.");
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.namedItem("name").value.trim();
  const price = Number(form.elements.namedItem("price_krw").value);
  if (!name || !Number.isInteger(price) || price < 1 || price > 100000000) {
    goodsUi.message(productAdminStatus, "상품명과 1원 이상 가격을 확인해 주세요.", "error");
    return;
  }
  if (cropPending) {
    goodsUi.message(productAdminStatus, "상품 사진 맞추기를 완료해 주세요.", "error");
    return;
  }
  const file = form.elements.namedItem("image").files[0];
  const oldPath = editingProduct?.image_path || null;
  const wasEditing = Boolean(editingProduct);
  const values = {
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
        const { data, error } = await goodsShop.from("products").update({ ...savedValues, slug: editingProduct.slug }).eq("id", productId).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("상품 정보를 수정하지 못했습니다.");
      } else {
        await insertProductWithUniqueSlug(productId, savedValues);
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
      ? "상품은 저장됐지만 목록을 다시 불러오지 못했습니다. 페이지를 새로고침해 주세요."
      : "상품을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    console.error("Product save failed.", { code: error?.code || "unknown", cleanupFailed: Boolean(cleanupFailed) });
    goodsUi.message(productAdminStatus, cleanupFailed ? `${saveError} 업로드한 임시 이미지 파일도 정리하지 못했습니다.` : saveError, "error");
  } finally {
    button.disabled = false;
  }
});

productAddButton.addEventListener("click", () => setEditor());
document.querySelector("#product-cancel-button").addEventListener("click", resetEditor);
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
    if (button.dataset.action === "move-up") {
      moveProductBy(product.id, -1);
      return;
    }
    if (button.dataset.action === "move-down") {
      moveProductBy(product.id, 1);
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
      const { data, error } = await goodsShop.from("products").delete().eq("id", product.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("상품을 삭제하지 못했습니다.");
      const imageRemoved = await removeImage(product.image_path);
      await loadProducts();
      goodsUi.message(productAdminStatus, imageRemoved ? "상품과 연결된 이미지를 완전히 삭제했습니다." : "상품은 삭제했지만 연결된 이미지 파일 정리에 실패했습니다.", imageRemoved ? "success" : "error");
    }
  } catch (error) {
    console.error("Product action failed.", { action: button.dataset.action, code: error?.code || "unknown" });
    const userMessage = error?.message === "주문 이력이 있는 상품은 완전 삭제할 수 없습니다. 판매중지를 이용해 주세요."
      ? error.message
      : "상품 변경을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    goodsUi.message(productAdminStatus, userMessage, "error");
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
