
// ========================================
// HEAVEN'S MART - PAYSTACK CHECKOUT
// ========================================

async function startPaystackCheckout(cartItems) {
  try {
    if (!currentUser) {
      alert("Please sign in before making payment.");
      return;
    }

    const items = cartItems.map((item) => ({
      product_id: item.product_id ?? item.id,
      quantity: Number(item.quantity),
    }));

    const { data, error } =
      await supabaseClient.functions.invoke(
        "initialize-payment",
        {
          body: { items },
        }
      );

    if (error) {
      throw error;
    }

    if (!data?.success || !data.checkout_url) {
      throw new Error(
        data?.error || "Unable to start payment."
      );
    }

    // Redirect customer to Paystack
    window.location.href = data.checkout_url;

  } catch (error) {
    console.error("Checkout error:", error);
    alert(error.message || "Payment could not start.");
  }
}


// ========================================
// VERIFY PAYMENT AFTER PAYSTACK REDIRECT
// ========================================

async function handlePaymentReturn() {
  const url = new URL(window.location.href);

  if (url.searchParams.get("payment") !== "verify") {
    return;
  }

  const reference = url.searchParams.get("reference");

  if (!reference) {
    alert("Payment reference was not found.");
    return;
  }

  try {
    if (!currentUser) {
      alert("Please sign in to verify your payment.");
      return;
    }

    const { data, error } =
      await supabaseClient.functions.invoke(
        "verify-payment",
        {
          body: { reference },
        }
      );

    if (error) {
      throw error;
    }

    if (data?.success && data?.verified) {
      alert("Payment successful! Your order is confirmed.");

      // Refresh your orders/products if needed.
      if (typeof loadOrders === "function") {
        await loadOrders();
      }

    } else {
      alert(
        data?.message || "Payment has not been confirmed."
      );
    }

  } catch (error) {
    console.error("Verification error:", error);

    alert(
      "We could not verify your payment. Please check your orders."
    );

  } finally {
    // Remove payment parameters from the address bar.
    url.searchParams.delete("payment");
    url.searchParams.delete("reference");

    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );
  }
}

// ========================================
// HEAVEN'S MART - PAYSTACK CHECKOUT
// ========================================

async function startPaystackCheckout(cartItems) {
  try {
    if (!currentUser) {
      alert("Please sign in before making payment.");
      return;
    }

    const items = cartItems.map((item) => ({
      product_id: item.product_id ?? item.id,
      quantity: Number(item.quantity),
    }));

    const { data, error } =
      await supabaseClient.functions.invoke(
        "initialize-payment",
        {
          body: { items },
        }
      );

    if (error) {
      throw error;
    }

    if (!data?.success || !data.checkout_url) {
      throw new Error(
        data?.error || "Unable to start payment."
      );
    }

    // Redirect customer to Paystack
    window.location.href = data.checkout_url;

  } catch (error) {
    console.error("Checkout error:", error);
    alert(error.message || "Payment could not start.");
  }
}


// ========================================
// VERIFY PAYMENT AFTER PAYSTACK REDIRECT
// ========================================

async function handlePaymentReturn() {
  const url = new URL(window.location.href);

  if (url.searchParams.get("payment") !== "verify") {
    return;
  }

  const reference = url.searchParams.get("reference");

  if (!reference) {
    alert("Payment reference was not found.");
    return;
  }

  try {
    if (!currentUser) {
      alert("Please sign in to verify your payment.");
      return;
    }

    const { data, error } =
      await supabaseClient.functions.invoke(
        "verify-payment",
        {
          body: { reference },
        }
      );

    if (error) {
      throw error;
    }

    if (data?.success && data?.verified) {
      alert("Payment successful! Your order is confirmed.");

      // Refresh your orders/products if needed.
      if (typeof loadOrders === "function") {
        await loadOrders();
      }

    } else {
      alert(
        data?.message || "Payment has not been confirmed."
      );
    }

  } catch (error) {
    console.error("Verification error:", error);

    alert(
      "We could not verify your payment. Please check your orders."
    );

  } finally {
    // Remove payment parameters from the address bar.
    url.searchParams.delete("payment");
    url.searchParams.delete("reference");

    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );
  }
}


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
