const productStatus = document.querySelector("#product-status");
const productDetails = document.querySelector("#product-details");
const query = new URLSearchParams(location.search);
const productId = query.get("id");

async function loadProduct() {
  if (!productId) {
    goodsUi.message(productStatus, "상품 목록에서 상품을 선택해 주세요.", "error");
    return;
  }
  const { data, error } = await goodsShop.from("products").select("id,name,description,price_krw,art_key,image_path").eq("id", productId).eq("is_active", true).maybeSingle();
  if (error || !data) {
    goodsUi.message(productStatus, "상품을 찾을 수 없습니다.", "error");
    return;
  }
  const art = productDetails.querySelector(".product-art");
  if (data.image_path) {
    art.classList.add("has-product-image");
    art.querySelector(".art-label").remove();
    const image = document.createElement("img");
    image.src = goodsUi.imageUrl(data.image_path);
    image.alt = `${data.name} 상품 이미지`;
    art.append(image);
    art.removeAttribute("aria-hidden");
  } else {
    art.classList.add(goodsUi.artClass(data.art_key));
    art.querySelector(".art-label").textContent = data.name;
  }
  productDetails.querySelector("h1").textContent = data.name;
  productDetails.querySelector(".product-description").textContent = data.description;
  productDetails.querySelector(".product-price").textContent = goodsUi.money(data.price_krw);
  productDetails.querySelector("#buy-link").href = `checkout.html?product_id=${encodeURIComponent(data.id)}`;
  productDetails.hidden = false;
}

loadProduct();
