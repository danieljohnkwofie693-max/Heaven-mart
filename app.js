
/* =====================================================
   HEAVEN'S MART
   SECURE PAYSTACK CHECKOUT & PRODUCT DISPLAY
===================================================== */

/* -----------------------------
   PAYMENT CONFIGURATION
----------------------------- */

let paymentVerificationRunning = false;


/* -----------------------------
   START PAYSTACK CHECKOUT
----------------------------- */

async function startPaystackCheckout(cartItems) {

  if (!currentUser) {
    alert("Please sign in before making payment.");
    return;
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  try {

    const items = cartItems.map(item => ({
      product_id: item.product_id ?? item.id,
      quantity: Number(item.quantity)
    }));

    if (items.some(item =>
      !item.product_id ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )) {
      throw new Error("Invalid product or quantity.");
    }

    const { data, error } =
      await supabaseClient.functions.invoke(
        "initialize-payment",
        {
          body: { items }
        }
      );

    if (error) throw error;

    if (
      !data ||
      data.success !== true ||
      !data.checkout_url
    ) {
      throw new Error(
        data?.error || "Unable to initialize payment."
      );
    }

    const checkoutURL = new URL(data.checkout_url);

    if (
      checkoutURL.protocol !== "https:" ||
      checkoutURL.hostname !== "checkout.paystack.com"
    ) {
      throw new Error("Invalid Paystack checkout URL.");
    }

    window.location.assign(checkoutURL.href);

  } catch (error) {

    console.error("Paystack checkout error:", error);

    alert(
      error.message || "Payment could not be started."
    );

  }
}


/* -----------------------------
   PAY FOR ONE PRODUCT
----------------------------- */

async function payWithPaystack(productId, quantity = 1) {

  if (!productId) {
    alert("Product information is missing.");
    return;
  }

  await startPaystackCheckout([
    {
      product_id: productId,
      quantity: quantity
    }
  ]);

}


/* -----------------------------
   VERIFY PAYMENT RETURN
----------------------------- */

async function handlePaymentReturn() {

  const url = new URL(window.location.href);

  const paymentStatus =
    url.searchParams.get("payment");

  if (paymentStatus !== "verify") return;

  const reference =
    url.searchParams.get("reference");

  if (!reference) {
    alert("Payment reference was not found.");
    return;
  }

  if (paymentVerificationRunning) return;

  if (!currentUser) {
    alert(
      "Please sign in with the account used for this order to verify payment."
    );
    return;
  }

  paymentVerificationRunning = true;

  try {

    const { data, error } =
      await supabaseClient.functions.invoke(
        "verify-payment",
        {
          body: { reference }
        }
      );

    if (error) throw error;

    if (data?.success && data?.verified) {

      alert(
        "Payment successful! Your Heaven's Mart order is confirmed."
      );

      if (typeof loadOrders === "function") {
        await loadOrders();
      }

    } else {

      alert(
        data?.message ||
        "Payment has not been confirmed. Please check your order."
      );

    }

    // Remove URL parameters only after verification response.
    url.searchParams.delete("payment");
    url.searchParams.delete("reference");

    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );

  } catch (error) {

    console.error("Payment verification error:", error);

    alert(
      "We could not verify your payment. Please try again or check your orders."
    );

  } finally {

    paymentVerificationRunning = false;

  }

}


/* =====================================================
   PRODUCT DISPLAY
===================================================== */

function renderProducts(list) {

  const grid = document.getElementById("product-grid");

  if (!grid) return;

  if (!Array.isArray(list) || list.length === 0) {

    grid.innerHTML = `
      <div class="empty-products">
        <h3>No products available</h3>
        <p>Please check again later.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = list.map(product => {

    const image = product.image_url
      ? escapeHTML(product.image_url)
      : "";

    const sellerNumber =
      product.profiles?.whatsapp_number || "";

    const whatsapp =
      makeWhatsAppLink(sellerNumber);

    return `

      <article class="product-card">

        <div class="product-image">

          ${
            image
              ? `
                <img
                  src="${image}"
                  alt="${escapeHTML(product.name)}"
                  loading="lazy"
                >
              `
              : `
                <div class="product-placeholder">
                  No Image Available
                </div>
              `
          }

        </div>

        <div class="product-details">

          <span class="product-category">
            ${escapeHTML(product.category || "General")}
          </span>

          <h3>
            ${escapeHTML(product.name)}
          </h3>

          <p>
            ${escapeHTML(product.description || "")}
          </p>

          <strong class="product-price">
            ${formatPrice(product.price)}
          </strong>

          <button
            type="button"
            class="pay-now-button"
            data-product-id="${escapeHTML(product.id)}"
          >
            PAY NOW
          </button>

          <a
            class="contact-seller"
            href="${whatsapp || "#"}"
            ${
              whatsapp
                ? 'target="_blank" rel="noopener noreferrer"'
                : 'aria-disabled="true"'
            }
          >
            Contact Seller on WhatsApp
          </a>

          <button
            type="button"
            class="review-product-button"
            data-product-id="${escapeHTML(product.id)}"
          >
            Write a Review
          </button>

        </div>

      </article>

    `;

  }).join("");


  /* -----------------------------
     PAYSTACK BUTTON EVENTS
  ----------------------------- */

  grid.querySelectorAll(".pay-now-button")
    .forEach(button => {

      button.addEventListener("click", async () => {

        const productId = button.dataset.productId;

        button.disabled = true;
        button.textContent = "PLEASE WAIT...";

        try {

          await payWithPaystack(productId, 1);

        } finally {

          button.disabled = false;
          button.textContent = "PAY NOW";

        }

      });

    });


  /* -----------------------------
     REVIEW BUTTON EVENTS
  ----------------------------- */

  grid.querySelectorAll(".review-product-button")
    .forEach(button => {

      button.addEventListener("click", () => {

        selectedProductId = button.dataset.productId;

        document.getElementById("review-form")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

        if (typeof showReviewMessage === "function") {

          showReviewMessage(
            "Write your review for the selected product."
          );

        }

      });

    });

}


/* =====================================================
   END OF HEAVEN'S MART PAYMENT SECTION
===================================================== */
