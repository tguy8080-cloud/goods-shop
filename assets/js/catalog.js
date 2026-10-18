const productsGrid = document.querySelector("#product-grid");
const catalogStatus = document.querySelector("#catalog-status");

function makeProductCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";
  const link = document.createElement("a");
  link.className = `product-art ${goodsUi.artClass(product.art_key)}`;
  link.href = `product.html?id=${encodeURIComponent(product.id)}`;
  link.setAttribute("aria-label", `${product.name} 상품 보기`);
  const artwork = document.createElement("span");
  artwork.textContent = product.name;
  if (product.image_path) {
    link.classList.add("has-product-image");
    const image = document.createElement("img");
    image.src = goodsUi.imageUrl(product.image_path);
    image.alt = "";
    link.append(image);
  } else {
    link.append(artwork);
  }
  const info = document.createElement("div");
  info.className = "product-info";
  const tag = document.createElement("p");
  tag.className = "product-category";
  tag.textContent = "학습용 샘플 굿즈";
  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = link.href;
  titleLink.textContent = product.name;
  title.append(titleLink);
  const price = document.createElement("p");
  price.className = "product-price";
  price.textContent = goodsUi.money(product.price_krw);
  info.append(tag, title, price);
  article.append(link, info);
  return article;
}

async function loadProducts() {
  const { data, error } = await goodsShop.from("products").select("id,slug,name,description,price_krw,art_key,image_path,sort_order,created_at").eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) {
    goodsUi.message(catalogStatus, "상품을 불러오지 못했습니다. 연결 상태를 확인한 뒤 새로고침해 주세요.", "error");
    return;
  }
  productsGrid.replaceChildren(...data.map(makeProductCard));
  goodsUi.message(catalogStatus, data.length ? "" : "현재 판매 중인 상품이 없습니다.");
}

loadProducts();
