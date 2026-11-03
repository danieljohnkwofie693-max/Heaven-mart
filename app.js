
function renderProducts(list) {
  const container = document.getElementById("product-grid");

  if (!container) {
    console.error("Product container #product-grid was not found.");
    return;
  }

  if (!list || list.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        No products found. Please check again later.
      </p>
    `;
    return;
  }

  container.innerHTML = list.map((product) => {
    const image = product.image_url
      ? `
        <img
          src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
      `
      : `
        <div class="product-placeholder" aria-hidden="true">
          🛍️
        </div>
      `;

    return `
      <article class="product-card">
        <div class="product-image">
          ${image}
        </div>

        <div class="product-info">
          <span class="product-category">
            ${escapeHTML(product.category || "Other")}
          </span>

          <h3>${escapeHTML(product.name)}</h3>

          <p class="product-description">
            ${escapeHTML(product.description || "")}
          </p>

          <strong class="product-price">
            ${formatPrice(product.price)}
          </strong>

          <button
            type="button"
            class="button button-primary whatsapp-order"
            data-product-id="${escapeHTML(product.id)}">
            Contact seller on WhatsApp
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll(".whatsapp-order").forEach((button) => {
    button.addEventListener("click", () => {
      contactSeller(button.dataset.productId);
    });
  });
}
