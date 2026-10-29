const config = window.HEAVENS_MART_CONFIG;

let supabaseClient = null;
let products = [];
let currentUser = null;
let selectedCategory = "All";
let selectedRating = 5;

document.addEventListener("DOMContentLoaded", initializeStore);

async function initializeStore() {
  const grid = document.getElementById("product-grid");

  document.getElementById("year").textContent = new Date().getFullYear();

  if (!config || !config.url || !config.anonKey || !window.supabase) {
    showStatus("Database configuration is missing.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  setupNavigation();
  setupDashboard();
  setupSearchAndCategories();
  setupReviewForm();

  await loadProducts();
  await loadReviews();

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;

  await updateDashboard();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;

    setTimeout(() => {
      updateDashboard();
    }, 0);
  });
}

function showStatus(message) {
  const element = document.getElementById("database-status");
  if (element) element.textContent = message;
}

function setMessage(id, message, isError = false) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = message;
    element.classList.toggle("error", isError);
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function setupNavigation() {
  const dialog = document.getElementById("admin-dialog");
  const openButton = document.getElementById("open-admin");
  const closeButton = document.getElementById("close-admin");
  const menuButton = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");

  openButton?.addEventListener("click", () => dialog.showModal());

  closeButton?.addEventListener("click", () => dialog.close());

  menuButton?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  nav?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");

  grid.innerHTML = "<p>Loading products...</p>";

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select(`
        id,
        name,
        description,
        price,
        category,
        image_url,
        seller_id,
        profiles (
          display_name,
          whatsapp_number
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];
    renderProducts();
    populateReviewProducts();
  } catch (error) {
    console.error("Product loading error:", error);
    grid.innerHTML = "<p>Products could not load. Please check Supabase permissions.</p>";
  }
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("empty-products");
  const term = (document.getElementById("search-input")?.value || "")
    .trim()
    .toLowerCase();

  const filtered = products.filter(product => {
    const matchesCategory =
      selectedCategory === "All" ||
      (product.category || "").toLowerCase() === selectedCategory.toLowerCase();

    const matchesSearch = [
      product.name,
      product.description,
      product.category
    ].some(value => (value || "").toLowerCase().includes(term));

    return matchesCategory && matchesSearch;
  });

  empty.hidden = filtered.length !== 0;

  grid.innerHTML = filtered.map(product => {
    const phone = String(product.profiles?.whatsapp_number || "")
      .replace(/\D/g, "");

    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          onerror="this.style.display='none'">`
      : `<span class="product-emoji">${escapeHTML(product.emoji || "📦")}</span>`;

    const message = encodeURIComponent(
      `Hello! I'm interested in ${product.name}. Is it available?`
    );

    const whatsapp = phone
      ? `<a class="contact-product"
          href="https://wa.me/${phone}?text=${message}"
          target="_blank"
          rel="noopener noreferrer">WhatsApp seller ↗</a>`
      : `<span class="contact-product">Contact unavailable</span>`;

    return `
      <article class="product-card">
        <div class="product-visual">${image}</div>
        <div class="product-info">
          <p class="product-category">${escapeHTML(product.category || "General")}</p>
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-description">${escapeHTML(product.description || "")}</p>
          <p class="product-price">GH₵ ${Number(product.price).toFixed(2)}</p>
          <small class="seller-byline">
            Seller: ${escapeHTML(product.profiles?.display_name || "Heaven's Mart seller")}
          </small>
          ${whatsapp}
        </div>
      </article>
    `;
  }).join("");
}

function setupSearchAndCategories() {
  document.getElementById("search-input")
    ?.addEventListener("input", renderProducts);

  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;

      document.querySelectorAll("[data-category]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderProducts();
    });
  });
}

function setupDashboard() {
  const mode = document.getElementById("auth-mode");

  mode?.addEventListener("change", () => {
    const signup = mode.value === "signup";

    document.getElementById("seller-display-name-wrap").hidden = !signup;
    document.getElementById("seller-display-name").required = signup;

    document.getElementById("seller-password").autocomplete =
      signup ? "new-password" : "current-password";

    document.getElementById("seller-auth-submit").textContent =
      signup ? "Create seller account" : "Log in";
  });

  document.getElementById("seller-auth-form")
    ?.addEventListener("submit", handleAuthentication);

  document.getElementById("seller-logout")
    ?.addEventListener("click", async () => {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        setMessage("auth-message", error.message, true);
      } else {
        setMessage("auth-message", "You have logged out.");
      }
    });

  document.getElementById("seller-profile-form")
    ?.addEventListener("submit", saveSellerProfile);

  document.getElementById("product-form")
    ?.addEventListener("submit", addProduct);
}

async function handleAuthentication(event) {
  event.preventDefault();

  const mode = document.getElementById("auth-mode").value;
  const email = document.getElementById("seller-email").value.trim();
  const password = document.getElementById("seller-password").value;
  const displayName = document.getElementById("seller-display-name").value.trim();

  setMessage("auth-message", "Please wait...");

  try {
    if (mode === "signup") {
      if (!displayName) {
        throw new Error("Enter your store or seller name.");
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        await ensureSellerProfile(displayName);
        setMessage("auth-message", "Account created successfully.");
        await updateDashboard();
      } else {
        setMessage(
          "auth-message",
          "Account created. Check your email to confirm your account, then log in."
        );
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      await ensureSellerProfile(
        data.user.user_metadata?.display_name || "Seller"
      );

      setMessage("auth-message", "Login successful.");
      await updateDashboard();
    }
  } catch (error) {
    console.error("Authentication error:", error);
    setMessage("auth-message", error.message || "Authentication failed.", true);
  }
}

async function ensureSellerProfile(displayName) {
  if (!currentUser) throw new Error("Please log in first.");

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { error: insertError } = await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        display_name: displayName || "Seller",
        role: "seller"
      });

    if (insertError) throw insertError;
  }
}

async function updateDashboard() {
  const authSection = document.getElementById("seller-auth");
  const workspace = document.getElementById("seller-workspace");

  authSection.hidden = Boolean(currentUser);
  workspace.hidden = !currentUser;

  if (!currentUser) return;

  try {
    await ensureSellerProfile(
      currentUser.user_metadata?.display_name || "Seller"
    );

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("display_name, whatsapp_number")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    document.getElementById("seller-user-label").textContent =
      profile.display_name || currentUser.email;

    document.getElementById("seller-display-name-edit").value =
      profile.display_name || "";

    document.getElementById("seller-whatsapp").value =
      profile.whatsapp_number || "";

    await loadMyProducts();
  } catch (error) {
    console.error("Dashboard error:", error);
    setMessage("seller-profile-message", error.message, true);
  }
}

async function saveSellerProfile(event) {
  event.preventDefault();

  if (!currentUser) return;

  const displayName = document
    .getElementById("seller-display-name-edit").value.trim();

  const whatsapp = document
    .getElementById("seller-whatsapp").value.trim();

  if (!displayName) {
    setMessage("seller-profile-message", "Enter your store name.", true);
    return;
  }

  if (whatsapp && !/^233\d{9}$/.test(whatsapp)) {
    setMessage(
      "seller-profile-message",
      "Use the format 233XXXXXXXXX, with no spaces or symbols.",
      true
    );
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({
        display_name: displayName,
        whatsapp_number: whatsapp || null
      })
      .eq("id", currentUser.id);

    if (error) throw error;

    setMessage("seller-profile-message", "Seller profile saved.");
    await loadProducts();
  } catch (error) {
    setMessage("seller-profile-message", error.message, true);
  }
}

async function addProduct(event) {
  event.preventDefault();

  if (!currentUser) {
    setMessage("seller-product-message", "Please log in first.", true);
    return;
  }

  const name = document.getElementById("new-product-name").value.trim();
  const category = document.getElementById("new-product-category").value;
  const price = Number(document.getElementById("new-product-price").value);
  const description = document.getElementById("new-product-description").value.trim();
  const imageUrl = document.getElementById("new-product-image").value.trim();

  if (!name || !Number.isFinite(price) || price <= 0) {
    setMessage("seller-product-message", "Enter a product name and valid price.", true);
    return;
  }

  if (imageUrl) {
    try {
      const url = new URL(imageUrl);

      if (url.protocol !== "https:") {
        throw new Error("Use a secure image URL beginning with https://");
      }
    } catch {
      setMessage("seller-product-message", "Enter a valid HTTPS image URL.", true);
      return;
    }
  }

  setMessage("seller-product-message", "Publishing product...");

  try {
    await ensureSellerProfile(
      currentUser.user_metadata?.display_name || "Seller"
    );

    const { error } = await supabaseClient
      .from("products")
      .insert({
        seller_id: currentUser.id,
        name,
        category,
        price,
        description,
        image_url: imageUrl || null,
        is_active: true
      });

    if (error) throw error;

    setMessage("seller-product-message", "Product published successfully.");
    document.getElementById("product-form").reset();

    await loadProducts();
    await loadMyProducts();
  } catch (error) {
    console.error("Product publishing error:", error);
    setMessage("seller-product-message", error.message, true);
  }
}

async function loadMyProducts() {
  const list = document.getElementById("my-products");

  if (!currentUser) {
    list.innerHTML = "";
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name, price, is_active")
      .eq("seller_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    list.innerHTML = (data || []).map(product => `
      <div class="my-product-row">
        <div>
          <strong>${escapeHTML(product.name)}</strong>
          <small>GH₵ ${Number(product.price).toFixed(2)} ·
            ${product.is_active ? "Active" : "Hidden"}
          </small>
        </div>
        <button type="button" data-toggle-product="${escapeHTML(product.id)}">
          ${product.is_active ? "Hide" : "Publish"}
        </button>
        <button type="button" data-delete-product="${escapeHTML(product.id)}">
          Delete
        </button>
      </div>
    `).join("") || "<p>You haven't added any products yet.</p>";

    list.querySelectorAll("[data-toggle-product]").forEach(button => {
      button.addEventListener("click", () => toggleProduct(button.dataset.toggleProduct));
    });

    list.querySelectorAll("[data-delete-product]").forEach(button => {
      button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct));
    });
  } catch (error) {
    console.error("Loading seller products failed:", error);
    list.innerHTML = "<p>Could not load your listings.</p>";
  }
}

async function toggleProduct(id) {
  const product = products.find(item => item.id === id);

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("is_active")
      .eq("id", id)
      .eq("seller_id", currentUser.id)
      .single();

    if (error) throw error;

    const { error: updateError } = await supabaseClient
      .from("products")
      .update({ is_active: !data.is_active })
      .eq("id", id)
      .eq("seller_id", currentUser.id);

    if (updateError) throw updateError;

    await loadProducts();
    await loadMyProducts();
  } catch (error) {
    alert("Could not update product: " + error.message);
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;

  try {
    const { error } = await supabaseClient
      .from("products")
      .delete()
      .eq("id", id)
      .eq("seller_id", currentUser.id);

    if (error) throw error;

    await loadProducts();
    await loadMyProducts();
  } catch (error) {
    alert("Could not delete product: " + error.message);
  }
}

function populateReviewProducts() {
  const select = document.getElementById("review-product");
  if (!select) return;

  select.innerHTML = '<option value="">Select a product</option>' +
    products.map(product => `
      <option value="${escapeHTML(product.id)}">${escapeHTML(product.name)}</option>
    `).join("");
}

function setupReviewForm() {
  document.querySelectorAll("#star-picker button").forEach(button => {
    button.addEventListener("click", () => {
      selectedRating = Number(button.dataset.rating);
      document.getElementById("review-rating").value = selectedRating;

      document.querySelectorAll("#star-picker button").forEach(star => {
        star.classList.toggle(
          "selected",
          Number(star.dataset.rating) <= selectedRating
        );
      });
    });
  });

  document.getElementById("review-form")
    ?.addEventListener("submit", submitReview);
}

async function submitReview(event) {
  event.preventDefault();

  const productId = document.getElementById("review-product").value;
  const customerName = document.getElementById("review-name").value.trim();
  const comment = document.getElementById("review-comment").value.trim();

  if (!productId || !customerName || !comment) {
    setMessage("review-message", "Complete all review fields.", true);
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("reviews")
      .insert({
        product_id: productId,
        customer_name: customerName,
        rating: selectedRating,
        comment,
        status: "pending"
      });

    if (error) throw error;

    setMessage("review-message", "Thank you! Your review was sent for approval.");
    document.getElementById("review-form").reset();

    selectedRating = 5;
    document.getElementById("review-rating").value = 5;

    document.querySelectorAll("#star-picker button").forEach(star => {
      star.classList.toggle(Number(star.dataset.rating) <= 5);
    });
  } catch (error) {
    console.error("Review submission failed:", error);
    setMessage("review-message", error.message, true);
  }
}

async function loadReviews() {
  try {
    const { data, error } = await supabaseClient
      .from("reviews")
      .select("id, customer_name, rating, comment, created_at, products(name)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const list = document.getElementById("published-review-list");
    const empty = document.getElementById("empty-reviews");

    document.getElementById("approved-review-count").textContent =
      (data || []).length;

    empty.hidden = Boolean(data?.length);

    list.innerHTML = (data || []).map(review => `
      <article class="review-card">
        <div class="stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        <h3>${escapeHTML(review.products?.name || "Customer review")}</h3>
        <p>${escapeHTML(review.comment)}</p>
        <small class="review-meta">
          ${escapeHTML(review.customer_name)}
        </small>
      </article>
    `).join("");
  } catch (error) {
    console.error("Loading reviews failed:", error);
  }
}
