
/* =========================================
   DISPLAY PRODUCTS - PAYSTACK + WHATSAPP
========================================= */

function renderProducts(list) {
  const grid = document.getElementById("product-grid");

  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = "<p>No products found.</p>";
    return;
  }

  grid.innerHTML = list.map(product => {
    const image = product.image_url
      ? escapeHTML(product.image_url)
      : "";

    const sellerNumber =
      product.profiles?.whatsapp_number || "";

    const whatsapp = makeWhatsAppLink(sellerNumber);

    return `
      <article class="product-card">

        ${
          image
            ? `<img src="${image}"
                alt="${escapeHTML(product.name)}"
                loading="lazy">`
            : `<div class="product-placeholder">No Image</div>`
        }

        <div class="product-details">

          <span class="product-category">
            ${escapeHTML(product.category || "General")}
          </span>

          <h3>${escapeHTML(product.name)}</h3>

          <p>${escapeHTML(product.description || "")}</p>

          <strong>${formatPrice(product.price)}</strong>

          <!-- PAYSTACK PAYMENT -->
          <button
            type="button"
            class="pay-now-button"
            data-product-id="${escapeHTML(product.id)}">
            PAY NOW
          </button>

          <!-- WHATSAPP ORDER -->
          <a
            class="contact-seller"
            href="${whatsapp || "#"}"
            ${whatsapp
              ? 'target="_blank" rel="noopener noreferrer"'
              : 'aria-disabled="true"'}
          >
            Contact Seller on WhatsApp
          </a>

          <!-- PRODUCT REVIEW -->
          <button
            type="button"
            class="review-product-button"
            data-product-id="${escapeHTML(product.id)}">
            Write a Review
          </button>

        </div>
      </article>
    `;
  }).join("");

  // PAYSTACK BUTTON EVENTS
  grid.querySelectorAll(".pay-now-button").forEach(button => {
    button.addEventListener("click", async () => {

      const productId = button.dataset.productId;

      button.disabled = true;
      button.textContent = "CONNECTING TO PAYSTACK...";

      try {
        await payWithPaystack(productId, 1);

      } finally {
        button.disabled = false;
        button.textContent = "PAY NOW";
      }
    });
  });

  // REVIEW BUTTON EVENTS
  grid.querySelectorAll(".review-product-button").forEach(button => {
    button.addEventListener("click", () => {

      selectedProductId = button.dataset.productId;

      document.getElementById("review-form")?.scrollIntoView({
        behavior: "smooth"
      });

      showReviewMessage(
        "Write your review for the selected product."
      );
    });
  });
}
