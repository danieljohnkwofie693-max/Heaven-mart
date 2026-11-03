
/* =========================================
   HEAVEN'S MART - COMPLETE APP.JS
   Ghana Marketplace
========================================= */

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let products = [];
let reviews = [];
let customerAuthMode = "login";
let sellerAuthMode = "login";
let selectedRating = 5;
let selectedProductId = null;

/* =========================================
   START THE WEBSITE
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  setCurrentYear();

  setupCustomerAuth();
  setupSearchAndCategories();
  setupSellerDashboard();
  setupReviewForm();
  setupMobileMenu();

  const config = window.HEAVENS_MART_CONFIG;

  if (!config || !config.url || !config.anonKey) {
    console.error("Supabase configuration is missing.");
    showCustomerMessage("Database configuration is missing. Check config.js.", true);
    return;
  }

  if (!window.supabase) {
    console.error("Supabase library did not load.");
    showCustomerMessage("Database library failed to load. Refresh the page.", true);
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      config.url,
      config.anonKey
    );

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    await updateAccessGate();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;

      setTimeout(() => {
        updateAccessGate();
      }, 0);
    });

    console.log("Heaven's Mart is ready.");

  } catch (error) {
    console.error("Website initialization error:", error);
    showCustomerMessage(error.message, true);
  }
});

/* =========================================
   CURRENT YEAR
========================================= */

function setCurrentYear() {
  const year = document.getElementById("year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }
}

/* =========================================
   CUSTOMER LOGIN AND REGISTRATION
========================================= */

function setupCustomerAuth() {
  const form = document.getElementById("customer-auth-form");
  const switchButton = document.getElementById("switch-auth-mode");
  const forgotButton = document.getElementById("forgot-password");

  if (form) {
    form.addEventListener("submit", handleCustomerAuth);
  }

  if (switchButton) {
    switchButton.addEventListener("click", () => {
      customerAuthMode =
        customerAuthMode === "login" ? "signup" : "login";

      updateCustomerAuthForm();
    });
  }

  if (forgotButton) {
    forgotButton.addEventListener("click", resetCustomerPassword);
  }

  updateCustomerAuthForm();
}

function updateCustomerAuthForm() {
  const signup = customerAuthMode === "signup";

  const heading = document.getElementById("login-heading");
  const description = document.getElementById("login-description");
  const nameWrap = document.getElementById("customer-name-wrap");
  const nameInput = document.getElementById("customer-name");
  const submitButton = document.getElementById("customer-auth-submit");
  const prompt = document.getElementById("account-prompt");
  const switchButton = document.getElementById("switch-auth-mode");
  const forgotButton = document.getElementById("forgot-password");

  if (heading) {
    heading.textContent = signup ? "Create Your Account" : "Welcome Back!";
  }

  if (description) {
    description.textContent = signup
      ? "Register to start shopping at Heaven's Mart."
      : "Sign in to access your marketplace.";
  }

  if (nameWrap) nameWrap.hidden = !signup;
  if (nameInput) nameInput.required = signup;

  if (submitButton) {
    submitButton.textContent = signup ? "CREATE ACCOUNT" : "LOGIN";
  }

  if (prompt) {
    prompt.textContent = signup
      ? "Already have an account?"
      : "New to Heaven's Mart?";
  }

  if (switchButton) {
    switchButton.textContent = signup
      ? "Login here"
      : "Create an account";
  }

  if (forgotButton) {
    forgotButton.hidden = signup;
  }

  showCustomerMessage("");
}

async function handleCustomerAuth(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showCustomerMessage("Database is not connected.", true);
    return;
  }

  const button = document.getElementById("customer-auth-submit");
  const email = document.getElementById("customer-email")?.value.trim();
  const password = document.getElementById("customer-password")?.value;
  const name = document.getElementById("customer-name")?.value.trim();

  if (!email || !password) {
    showCustomerMessage("Enter your email and password.", true);
    return;
  }

  if (customerAuthMode === "signup" && !name) {
    showCustomerMessage("Enter your full name.", true);
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "PLEASE WAIT...";
  }

  try {
    if (customerAuthMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            account_type: "customer"
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      if (data.session) {
        showCustomerMessage("Account created successfully.");
      } else {
        showCustomerMessage(
          "Registration successful! Check your email to confirm your account."
        );
      }

    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showCustomerMessage("Login successful.");
    }

  } catch (error) {
    console.error("Customer authentication error:", error);
    showCustomerMessage(error.message || "Authentication failed.", true);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        customerAuthMode === "signup" ? "CREATE ACCOUNT" : "LOGIN";
    }
  }
}

async function resetCustomerPassword() {
  const email = document.getElementById("customer-email")?.value.trim();

  if (!email) {
    showCustomerMessage("Enter your email address first.", true);
    return;
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin }
    );

    if (error) throw error;

    showCustomerMessage("Password reset instructions have been sent to your email.");

  } catch (error) {
    showCustomerMessage(error.message, true);
  }
}

async function handleCustomerLogout() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error(error);
    alert(error.message);
  }
}

/* =========================================
   LOGIN SCREEN / MARKETPLACE ACCESS
========================================= */

async function updateAccessGate() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");

  if (!currentUser) {
    currentProfile = null;

    if (loginScreen) loginScreen.hidden = false;
    if (appShell) appShell.hidden = true;

    return;
  }

  try {
    await loadCurrentProfile();

    if (loginScreen) loginScreen.hidden = true;
    if (appShell) appShell.hidden = false;

    await loadProducts();
    await loadReviews();
    await loadSellerProducts();

  } catch (error) {
    console.error("Access setup error:", error);
  }
}

async function loadCurrentProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  currentProfile = data;
}

/* =========================================
   SEARCH AND CATEGORY FILTERS
========================================= */

function setupSearchAndCategories() {
  const searchInput = document.getElementById("product-search");
  const categoryFilter = document.getElementById("category-filter");
  const topSearch = document.getElementById("top-search-input");
  const searchForm = document.getElementById("search-form");

  if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", filterProducts);
  }

  if (topSearch) {
    topSearch.addEventListener("input", () => {
      if (searchInput) {
        searchInput.value = topSearch.value;
        filterProducts();
      }
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (searchInput && topSearch) {
        searchInput.value = topSearch.value;
        filterProducts();
      }

      document.getElementById("products")?.scrollIntoView({
        behavior: "smooth"
      });
    });
  }
}

function filterProducts() {
  const search = (
    document.getElementById("product-search")?.value || ""
  ).toLowerCase();

  const category =
    document.getElementById("category-filter")?.value || "all";

  const filtered = products.filter(product => {
    const matchesSearch =
      (product.name || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search);

    const matchesCategory =
      category === "all" || product.category === category;

    return matchesSearch && matchesCategory;
  });

  renderProducts(filtered);
}

/* =========================================
   LOAD PRODUCTS
========================================= */

async function loadProducts() {
  const grid = document.getElementById("product-grid");

  if (!grid || !supabaseClient) return;

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
          whatsapp_number
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];
    renderProducts(products);

    const status = document.getElementById("database-status");

    if (status) {
      status.textContent = "Connected to Heaven's Mart database.";
    }

  } catch (error) {
    console.error("Product loading error:", error);
    grid.innerHTML = "<p>Unable to load products. Please refresh.</p>";
  }
}

/* =========================================
   DISPLAY PRODUCTS
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
            ? `<img src="${image}" alt="${escapeHTML(product.name)}" loading="lazy">`
            : `<div class="product-placeholder">No Image</div>`
        }

        <div class="product-details">
          <span class="product-category">
            ${escapeHTML(product.category || "General")}
          </span>

          <h3>${escapeHTML(product.name)}</h3>

          <p>${escapeHTML(product.description || "")}</p>

          <strong>${formatPrice(product.price)}</strong>

          <a
            class="contact-seller"
            href="${whatsapp ? whatsapp : "#"}"
            ${whatsapp ? 'target="_blank" rel="noopener noreferrer"' : ""}
            ${whatsapp ? "" : 'aria-disabled="true"'}
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

  grid.querySelectorAll(".review-product-button").forEach(button => {
    button.addEventListener("click", () => {
      selectedProductId = button.dataset.productId;

      document.getElementById("review-form")?.scrollIntoView({
        behavior: "smooth"
      });

      showReviewMessage("Write your review for the selected product.");
    });
  });
}

/* =========================================
   SELLER WHATSAPP
========================================= */

function makeWhatsAppLink(number) {
  if (!number) return "";

  let clean = String(number).replace(/\D/g, "");

  if (clean.startsWith("0")) {
    clean = "233" + clean.substring(1);
  }

  if (!clean.startsWith("233")) {
    return "";
  }

  return "https://wa.me/" + clean;
}

/* =========================================
   SELLER DASHBOARD
========================================= */

function setupSellerDashboard() {
  const authForm = document.getElementById("seller-auth-form");
  const productForm = document.getElementById("product-form");
  const profileForm = document.getElementById("seller-profile-form");
  const logoutButton = document.getElementById("seller-logout");

  if (authForm) {
    authForm.addEventListener("submit", handleSellerLogin);
  }

  if (productForm) {
    productForm.addEventListener("submit", addProduct);
  }

  if (profileForm) {
    profileForm.addEventListener("submit", updateSellerProfile);
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleCustomerLogout);
  }

  const modeButton = document.getElementById("auth-mode");

  if (modeButton) {
    modeButton.addEventListener("click", () => {
      sellerAuthMode =
        sellerAuthMode === "login" ? "signup" : "login";

      showSellerMessage(
        "Seller accounts must be approved and created by the administrator."
      );
    });
  }
}

async function handleSellerLogin(event) {
  event.preventDefault();

  const email = document.getElementById("seller-email")?.value.trim();
  const password = document.getElementById("seller-password")?.value;
  const button = document.getElementById("seller-auth-submit");

  if (!email || !password) {
    showSellerMessage("Enter your email and password.", true);
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "PLEASE WAIT...";
  }

  try {
    const { data: loginData, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    const sellerUserId = loginData.user.id;

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", sellerUserId)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== "seller") {
      await supabaseClient.auth.signOut();
      throw new Error("This account is not an approved seller account.");
    }

    currentUser = loginData.user;
    currentProfile = profile;

    showSellerMessage("Seller login successful.");

    await updateAccessGate();

  } catch (error) {
    console.error("Seller login error:", error);
    showSellerMessage(error.message || "Seller login failed.", true);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "LOGIN";
    }
  }
}

/* =========================================
   UPDATE SELLER PROFILE
========================================= */

async function updateSellerProfile(event) {
  event.preventDefault();

  if (!currentUser || !currentProfile ||
      currentProfile.role !== "seller") {
    showSellerMessage("Please log in with an approved seller account.", true);
    return;
  }

  const name =
    document.getElementById("seller-display-name-edit")?.value.trim();

  const whatsapp =
    document.getElementById("seller-whatsapp")?.value.trim();

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({
        display_name: name,
        whatsapp_number: whatsapp
      })
      .eq("id", currentUser.id);

    if (error) throw error;

    showSellerMessage("Seller profile updated successfully.");

    await loadCurrentProfile();
    await loadProducts();

  } catch (error) {
    console.error(error);
    showSellerMessage(error.message, true);
  }
}

/* =========================================
   ADD NEW PRODUCT
========================================= */

async function addProduct(event) {
  event.preventDefault();

  if (!currentUser || currentProfile?.role !== "seller") {
    showSellerProductMessage("Only approved sellers can add products.", true);
    return;
  }

  const name = document.getElementById("new-product-name")?.value.trim();
  const category = document.getElementById("new-product-category")?.value;
  const price = Number(document.getElementById("new-product-price")?.value);
  const description =
    document.getElementById("new-product-description")?.value.trim();

  const imageUrl =
    document.getElementById("new-product-image")?.value.trim();

  if (!name || !category || !price || price <= 0) {
    showSellerProductMessage("Enter a valid product name, category and price.", true);
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("products")
      .insert({
        name,
        category,
        price,
        description,
        image_url: imageUrl || null,
        seller_id: currentUser.id,
        is_active: true
      });

    if (error) throw error;

    showSellerProductMessage("Product added successfully.");

    document.getElementById("product-form").reset();

    await loadProducts();
    await loadSellerProducts();

  } catch (error) {
    console.error("Add product error:", error);
    showSellerProductMessage(error.message, true);
  }
}

/* =========================================
   LOAD SELLER'S PRODUCTS
========================================= */

async function loadSellerProducts() {
  const container = document.getElementById("my-products");

  if (!container || !currentUser ||
      currentProfile?.role !== "seller") return;

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("seller_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      container.innerHTML = "<p>You have not added any products yet.</p>";
      return;
    }

    container.innerHTML = data.map(product => `
      <div class="seller-product">
        <h4>${escapeHTML(product.name)}</h4>
        <p>${formatPrice(product.price)}</p>
        <p>${escapeHTML(product.category || "")}</p>

        <button
          type="button"
          class="delete-product-button"
          data-id="${escapeHTML(product.id)}"
        >
          Delete Product
        </button>
      </div>
    `).join("");

    container.querySelectorAll(".delete-product-button").forEach(button => {
      button.addEventListener("click", () => {
        deleteProduct(button.dataset.id);
      });
    });

  } catch (error) {
    console.error("Seller products error:", error);
    container.innerHTML = "<p>Unable to load your products.</p>";
  }
}

/* =========================================
   DELETE PRODUCT
========================================= */

async function deleteProduct(productId) {
  if (!currentUser || currentProfile?.role !== "seller") return;

  const confirmed = confirm("Are you sure you want to delete this product?");

  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("seller_id", currentUser.id);

    if (error) throw error;

    showSellerProductMessage("Product deleted.");

    await loadProducts();
    await loadSellerProducts();

  } catch (error) {
    console.error(error);
    showSellerProductMessage(error.message, true);
  }
}

/* =========================================
   CUSTOMER REVIEWS
========================================= */

function setupReviewForm() {
  const form = document.getElementById("review-form");

  if (form) {
    form.addEventListener("submit", submitReview);
  }

  document.querySelectorAll("[data-rating]").forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = Number(star.dataset.rating);
      updateRatingDisplay();
    });
  });
}

function updateRatingDisplay() {
  document.querySelectorAll("[data-rating]").forEach(star => {
    const rating = Number(star.dataset.rating);

    star.classList.toggle("active", rating <= selectedRating);
  });
}

async function submitReview(event) {
  event.preventDefault();

  if (!currentUser) {
    showReviewMessage("Please log in before submitting a review.", true);
    return;
  }

  if (!selectedProductId) {
    showReviewMessage("Select a product before writing a review.", true);
    return;
  }

  const name = document.getElementById("review-name")?.value.trim();
  const comment = document.getElementById("review-comment")?.value.trim();

  if (!comment) {
    showReviewMessage("Please enter your review.", true);
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("reviews")
      .insert({
        product_id: selectedProductId,
        user_id: currentUser.id,
        customer_name: name || "Customer",
        rating: selectedRating,
        comment,
        status: "pending"
      });

    if (error) throw error;

    showReviewMessage("Thank you! Your review has been submitted for approval.");

    document.getElementById("review-form").reset();

    selectedRating = 5;
    selectedProductId = null;
    updateRatingDisplay();

  } catch (error) {
    console.error("Review submission error:", error);
    showReviewMessage(error.message, true);
  }
}

/* =========================================
   LOAD APPROVED REVIEWS
========================================= */

async function loadReviews() {
  const container = document.getElementById("reviews-list");

  if (!container || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("reviews")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    reviews = data || [];

    if (!reviews.length) {
      container.innerHTML = "<p>No approved reviews yet.</p>";
      return;
    }

    container.innerHTML = reviews.map(review => `
      <article class="review-card">
        <h4>${escapeHTML(review.customer_name || "Customer")}</h4>
        <p>${"★".repeat(Number(review.rating) || 0)}</p>
        <p>${escapeHTML(review.comment || "")}</p>
      </article>
    `).join("");

  } catch (error) {
    console.error("Review loading error:", error);
    container.innerHTML = "<p>Unable to load reviews.</p>";
  }
}

/* =========================================
   MOBILE MENU
========================================= */

function setupMobileMenu() {
  const menuButton = document.getElementById("menu-toggle");
  const overlay = document.getElementById("menu-overlay");
  const navigation = document.getElementById("main-nav");

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      navigation?.classList.toggle("active");
      overlay?.classList.toggle("active");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      navigation?.classList.remove("active");
      overlay.classList.remove("active");
    });
  }

  navigation?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navigation.classList.remove("active");
      overlay?.classList.remove("active");
    });
  });
}

/* =========================================
   MESSAGE HELPERS
========================================= */

function showCustomerMessage(message, isError = false) {
  const element = document.getElementById("customer-auth-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#c62828" : "#176b50";
}

function showSellerMessage(message, isError = false) {
  const element = document.getElementById("auth-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#c62828" : "#176b50";
}

function showSellerProductMessage(message, isError = false) {
  const element = document.getElementById("seller-product-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#c62828" : "#176b50";
}

function showReviewMessage(message, isError = false) {
  const element = document.getElementById("review-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#c62828" : "#176b50";
}

/* =========================================
   FORMAT GHANA CURRENCY
========================================= */

function formatPrice(price) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS"
  }).format(Number(price) || 0);
}

/* =========================================
   PREVENT HTML INJECTION
========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

/* =========================================
   END OF HEAVEN'S MART APP.JS
========================================= */
