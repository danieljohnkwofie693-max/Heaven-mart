
/* =========================================
   HEAVEN'S MART
   Ghana Marketplace
   Supabase Application
========================================= */

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let products = [];
let reviews = [];
let customerAuthMode = "login";

/* =========================================
   INITIALIZE APPLICATION
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  setCurrentYear();
  setupCustomerAuth();
  setupSearchAndCategories();
  setupSellerDashboard();
  setupReviewForm();

  const config = window.HEAVENS_MART_CONFIG;

  if (
    !config ||
    !config.url ||
    !config.anonKey ||
    !window.supabase
  ) {
    showCustomerMessage(
      "Supabase configuration is missing. Check config.js.",
      true
    );
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showCustomerMessage(error.message, true);
    return;
  }

  currentUser = data.session?.user || null;

  await updateAccessGate();

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {
      currentUser = session?.user || null;

      // Refresh access after login, logout or token changes.
      await updateAccessGate();
    }
  );
});


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

  document.getElementById("login-heading").textContent =
    signup ? "Create Your Account" : "Welcome Back!";

  document.getElementById("login-description").textContent =
    signup
      ? "Register to start shopping at Heaven's Mart."
      : "Sign in to access your marketplace.";

  document.getElementById("customer-name-wrap").hidden = !signup;

  document.getElementById("customer-name").required = signup;

  document.getElementById("customer-auth-submit").textContent =
    signup ? "CREATE ACCOUNT" : "LOGIN";

  document.getElementById("account-prompt").textContent =
    signup ? "Already have an account?" : "New to Heaven's Mart?";

  document.getElementById("switch-auth-mode").textContent =
    signup ? "Login here" : "Create an account";

  document.getElementById("forgot-password").hidden = signup;

  showCustomerMessage("");
}


async function handleCustomerAuth(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showCustomerMessage("The database is not connected.", true);
    return;
  }

  const email = document
    .getElementById("customer-email")
    .value.trim();

  const password = document
    .getElementById("customer-password")
    .value;

  const name = document
    .getElementById("customer-name")
    .value.trim();

  const button = document.getElementById("customer-auth-submit");

  button.disabled = true;
  button.textContent = "Please wait...";

  try {
    if (customerAuthMode === "signup") {
      if (!name) {
        throw new Error("Please enter your full name.");
      }

      const { data, error } =
        await supabaseClient.auth.signUp({
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
          "Account created. Please check your email to confirm your account."
        );
      }

    } else {
      const { error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      showCustomerMessage("Login successful.");
    }

  } catch (error) {
    showCustomerMessage(error.message, true);

  } finally {
    button.disabled = false;

    button.textContent =
      customerAuthMode === "signup"
        ? "CREATE ACCOUNT"
        : "LOGIN";
  }
}


/* =========================================
   CUSTOMER PASSWORD RESET
========================================= */

async function resetCustomerPassword() {
  if (!supabaseClient) return;

  const email = document
    .getElementById("customer-email")
    .value.trim();

  if (!email) {
    showCustomerMessage(
      "Enter your email address first.",
      true
    );
    return;
  }

  try {
    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

    if (error) throw error;

    showCustomerMessage(
      "If the account exists, a password reset email will be sent."
    );

  } catch (error) {
    showCustomerMessage(error.message, true);
  }
}


/* =========================================
   CUSTOMER LOGOUT
========================================= */

async function handleCustomerLogout() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert(error.message);
  }
}


/* =========================================
   MARKETPLACE ACCESS CONTROL
========================================= */

async function updateAccessGate() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");

  if (!currentUser) {
    currentProfile = null;

    loginScreen.hidden = false;
    appShell.hidden = true;

    return;
  }

  loginScreen.hidden = true;
  appShell.hidden = false;

  await loadProducts();
  await loadReviews();
  await updateDashboard();
}


/* =========================================
   PRODUCT SEARCH AND CATEGORIES
========================================= */

function setupSearchAndCategories() {
  const search = document.getElementById("product-search");
  const category = document.getElementById("category-filter");

  if (search) {
    search.addEventListener("input", filterProducts);
  }

  if (category) {
    category.addEventListener("change", filterProducts);
  }
}


function filterProducts() {
  const searchTerm = document
    .getElementById("product-search")
    .value.toLowerCase()
    .trim();

  const selectedCategory = document
    .getElementById("category-filter")
    .value;

  const filtered = products.filter(product => {
    const matchesSearch =
      (product.name || "").toLowerCase().includes(searchTerm) ||
      (product.description || "").toLowerCase().includes(searchTerm) ||
      (product.category || "").toLowerCase().includes(searchTerm);

    const matchesCategory =
      !selectedCategory ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  renderProducts(filtered);
}


function populateCategories() {
  const select = document.getElementById("category-filter");

  if (!select) return;

  const selected = select.value;

  const categories = [
    ...new Set(
      products
        .map(product => product.category)
        .filter(Boolean)
    )
  ];

  select.innerHTML =
    '<option value="">All categories</option>';

  categories.forEach(category => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    select.appendChild(option);
  });

  select.value = categories.includes(selected) ? selected : "";
}


/* =========================================
   LOAD PRODUCTS
========================================= */

async function loadProducts() {
  if (!supabaseClient || !currentUser) return;

  const grid = document.getElementById("product-grid");
  const status = document.getElementById("database-status");

  grid.innerHTML = "<p>Loading products...</p>";

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

  if (error) {
    grid.innerHTML = "<p>Unable to load products.</p>";

    if (status) status.textContent = error.message;

    console.error("Product loading error:", error);
    return;
  }

  products = data || [];

  if (status) {
    status.textContent =
      products.length + " products available";
  }

  populateCategories();
  renderProducts(products);
}


/* =========================================
   DISPLAY PRODUCTS
========================================= */

function renderProducts(items) {
  const grid = document.getElementById("product-grid");

  if (!grid) return;

  if (!items.length) {
    grid.innerHTML =
      '<p class="empty-state">No products found.</p>';
    return;
  }

  grid.innerHTML = items.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
           alt="${escapeHTML(product.name)}"
           loading="lazy"
           onerror="this.style.display='none'">`
      : '<div class="product-placeholder">🛍️</div>';

    return `
      <article class="product-card">

        <div class="product-image">
          ${image}
        </div>

        <span class="product-category">
          ${escapeHTML(product.category || "General")}
        </span>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="product-description">
          ${escapeHTML(product.description || "")}
        </p>

        <strong class="product-price">
          ${formatPrice(product.price)}
        </strong>

        <button
          class="button button-primary whatsapp-order"
          data-product-id="${escapeHTML(product.id)}">
          Contact Seller
        </button>

      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-product-id]").forEach(button => {
    button.addEventListener("click", () => {
      contactSeller(button.dataset.productId);
    });
  });
}


/* =========================================
   CONTACT SELLER ON WHATSAPP
========================================= */

async function contactSeller(productId) {
  const product = products.find(
    item => String(item.id) === String(productId)
  );

  if (!product) return;

  const number = product.profiles?.whatsapp_number;

  if (!number) {
    alert("The seller has not added a WhatsApp number yet.");
    return;
  }

  const whatsappNumber = normalizeWhatsAppNumber(number);

  if (!whatsappNumber) {
    alert("The seller's WhatsApp number is invalid.");
    return;
  }

  const message = encodeURIComponent(
    `Hello, I am interested in ${product.name} on Heaven's Mart.`
  );

  const url =
    `https://wa.me/${whatsappNumber}?text=${message}`;

  window.open(url, "_blank", "noopener,noreferrer");
}


function normalizeWhatsAppNumber(number) {
  let value = String(number).replace(/\D/g, "");

  if (value.startsWith("0")) {
    value = "233" + value.slice(1);
  }

  if (value.startsWith("233")) {
    return value;
  }

  return "";
}


/* =========================================
   SELLER DASHBOARD
========================================= */

function setupSellerDashboard() {
  const authForm = document.getElementById("seller-auth-form");
  const mode = document.getElementById("auth-mode");

  if (authForm) {
    authForm.addEventListener("submit", handleSellerLogin);
  }

  if (mode) {
    mode.addEventListener("change", () => {
      const signup = mode.value === "signup";

      document.getElementById(
        "seller-display-name-wrap"
      ).hidden = !signup;

      const button =
        document.getElementById("seller-auth-submit");

      button.textContent = signup
        ? "Seller accounts require approval"
        : "Log in";
    });
  }

  document
    .getElementById("seller-profile-form")
    ?.addEventListener("submit", saveSellerProfile);

  document
    .getElementById("product-form")
    ?.addEventListener("submit", addProduct);

  document
    .getElementById("seller-logout")
    ?.addEventListener("click", handleSellerLogout);
}


/* =========================================
   SELLER LOGIN
========================================= */

async function handleSellerLogin(event) {
  event.preventDefault();

  if (!supabaseClient) return;

  const mode = document.getElementById("auth-mode").value;

  if (mode === "signup") {
    showSellerMessage(
      "Seller accounts must be approved and created through the administrator.",
      true
    );
    return;
  }

  const email = document
    .getElementById("seller-email")
    .value.trim();

  const password = document
    .getElementById("seller-password")
    .value;

  const button = document.getElementById("seller-auth-submit");

  button.disabled = true;
  button.textContent = "Checking...";

  try {
    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, display_name, whatsapp_number, role")
        .eq("id", currentUser?.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== "seller") {
      await supabaseClient.auth.signOut();

      throw new Error(
        "This account is not approved as a seller."
      );
    }

    showSellerMessage("Seller login successful.");

  } catch (error) {
    showSellerMessage(error.message, true);

  } finally {
    button.disabled = false;
    button.textContent = "Log in";
  }
}


/* =========================================
   UPDATE DASHBOARD
========================================= */

async function updateDashboard() {
  if (!currentUser || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, whatsapp_number, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile error:", error);
    return;
  }

  currentProfile = data;

  const sellerAuth = document.getElementById("seller-auth");
  const sellerWorkspace =
    document.getElementById("seller-workspace");

  const isSeller = data?.role === "seller";

  sellerAuth.hidden = isSeller;
  sellerWorkspace.hidden = !isSeller;

  if (isSeller) {
    document.getElementById("seller-display-name-edit").value =
      data.display_name || "";

    document.getElementById("seller-whatsapp").value =
      data.whatsapp_number || "";

    await loadMyProducts();
  }
}


/* =========================================
   SAVE SELLER PROFILE
========================================= */

async function saveSellerProfile(event) {
  event.preventDefault();

  if (!currentUser || currentProfile?.role !== "seller") {
    showProfileMessage("Seller access is required.", true);
    return;
  }

  const displayName = document
    .getElementById("seller-display-name-edit")
    .value.trim();

  const whatsapp = document
    .getElementById("seller-whatsapp")
    .value.trim();

  if (!displayName || !normalizeWhatsAppNumber(whatsapp)) {
    showProfileMessage(
      "Enter a display name and valid Ghana WhatsApp number.",
      true
    );
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      display_name: displayName,
      whatsapp_number: normalizeWhatsAppNumber(whatsapp)
    })
    .eq("id", currentUser.id);

  if (error) {
    showProfileMessage(error.message, true);
    return;
  }

  showProfileMessage("Profile updated successfully.");
  await loadProducts();
}


/* =========================================
   ADD PRODUCT
========================================= */

async function addProduct(event) {
  event.preventDefault();

  if (!currentUser || currentProfile?.role !== "seller") {
    showProductMessage("Seller access is required.", true);
    return;
  }

  const name = document
    .getElementById("new-product-name")
    .value.trim();

  const category = document
    .getElementById("new-product-category")
    .value;

  const price = Number(
    document.getElementById("new-product-price").value
  );

  const description = document
    .getElementById("new-product-description")
    .value.trim();

  const imageUrl = document
    .getElementById("new-product-image")
    .value.trim();

  if (!name || !category || !Number.isFinite(price) || price <= 0) {
    showProductMessage("Enter valid product details.", true);
    return;
  }

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

  if (error) {
    showProductMessage(error.message, true);
    return;
  }

  showProductMessage("Product added successfully.");

  document.getElementById("product-form").reset();

  await loadProducts();
  await loadMyProducts();
}


/* =========================================
   LOAD SELLER PRODUCTS
========================================= */

async function loadMyProducts() {
  if (!currentUser || currentProfile?.role !== "seller") return;

  const container = document.getElementById("my-products");

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("seller_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = error.message;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "<p>No products yet.</p>";
    return;
  }

  container.innerHTML = data.map(product => `
    <div class="seller-product">

      <h4>${escapeHTML(product.name)}</h4>

      <p>${formatPrice(product.price)}</p>

      <p>${product.is_active ? "Active" : "Hidden"}</p>

      <button
        class="button button-secondary"
        data-toggle-product="${escapeHTML(product.id)}"
        data-active="${product.is_active}">
        ${product.is_active ? "Hide" : "Show"}
      </button>

      <button
        class="button button-danger"
        data-delete-product="${escapeHTML(product.id)}">
        Delete
      </button>

    </div>
  `).join("");

  container.querySelectorAll("[data-toggle-product]")
    .forEach(button => {
      button.addEventListener("click", () => {
        toggleProduct(
          button.dataset.toggleProduct,
          button.dataset.active === "true"
        );
      });
    });

  container.querySelectorAll("[data-delete-product]")
    .forEach(button => {
      button.addEventListener("click", () => {
        deleteProduct(button.dataset.deleteProduct);
      });
    });
}


/* =========================================
   SHOW OR HIDE PRODUCT
========================================= */

async function toggleProduct(id, currentlyActive) {
  const { error } = await supabaseClient
    .from("products")
    .update({ is_active: !currentlyActive })
    .eq("id", id)
    .eq("seller_id", currentUser.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadProducts();
  await loadMyProducts();
}


/* =========================================
   DELETE PRODUCT
========================================= */

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id)
    .eq("seller_id", currentUser.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadProducts();
  await loadMyProducts();
}


/* =========================================
   SELLER LOGOUT
========================================= */

async function handleSellerLogout() {
  await handleCustomerLogout();
}


/* =========================================
   CUSTOMER REVIEWS
========================================= */

function setupReviewForm() {
  const form = document.getElementById("review-form");

  if (form) {
    form.addEventListener("submit", submitReview);
  }

  document.querySelectorAll("[data-rating]").forEach(button => {
    button.addEventListener("click", () => {
      const rating = Number(button.dataset.rating);

      document.getElementById("review-rating").value = rating;

      document.querySelectorAll("[data-rating]").forEach(star => {
        star.classList.toggle(
          "selected",
          Number(star.dataset.rating) <= rating
        );
      });
    });
  });
}


async function submitReview(event) {
  event.preventDefault();

  if (!currentUser) {
    showReviewMessage("Please log in first.", true);
    return;
  }

  const name = document
    .getElementById("review-name")
    .value.trim();

  const rating = Number(
    document.getElementById("review-rating").value
  );

  const comment = document
    .getElementById("review-comment")
    .value.trim();

  if (!name || rating < 1 || rating > 5 || !comment) {
    showReviewMessage(
      "Enter your name, choose a rating and write a review.",
      true
    );
    return;
  }

  const { error } = await supabaseClient
    .from("reviews")
    .insert({
      user_id: currentUser.id,
      name,
      rating,
      comment,
      status: "pending"
    });

  if (error) {
    showReviewMessage(error.message, true);
    return;
  }

  showReviewMessage(
    "Thank you! Your review has been submitted for approval."
  );

  document.getElementById("review-form").reset();
  document.getElementById("review-rating").value = "0";

  document.querySelectorAll("[data-rating]").forEach(star => {
    star.classList.remove("selected");
  });
}


/* =========================================
   LOAD APPROVED REVIEWS
========================================= */

async function loadReviews() {
  if (!supabaseClient || !currentUser) return;

  const container = document.getElementById("reviews-list");

  const { data, error } = await supabaseClient
    .from("reviews")
    .select("name, rating, comment, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Unable to load reviews.";
    console.error("Review error:", error);
    return;
  }

  reviews = data || [];

  if (!reviews.length) {
    container.innerHTML = "<p>No approved reviews yet.</p>";
    return;
  }

  container.innerHTML = reviews.map(review => `
    <div class="review-card">

      <h4>${escapeHTML(review.name)}</h4>

      <p class="review-stars">
        ${"★".repeat(Math.min(5, Math.max(0, Number(review.rating))))}
      </p>

      <p>${escapeHTML(review.comment)}</p>

    </div>
  `).join("");
}


/* =========================================
   HELPER FUNCTIONS
========================================= */

function formatPrice(price) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) return "Price unavailable";

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS"
  }).format(amount);
}


function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return characters[character];
  });
}


function setCurrentYear() {
  const year = document.getElementById("year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }
}


function showCustomerMessage(message, isError = false) {
  const element =
    document.getElementById("customer-auth-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#C0392B" : "#176B50";
}


function showSellerMessage(message, isError = false) {
  const element = document.getElementById("auth-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#C0392B" : "#176B50";
}


function showProfileMessage(message, isError = false) {
  const element =
    document.getElementById("seller-profile-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#C0392B" : "#176B50";
}


function showProductMessage(message, isError = false) {
  const element =
    document.getElementById("seller-product-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#C0392B" : "#176B50";
}


function showReviewMessage(message, isError = false) {
  const element =
    document.getElementById("review-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#C0392B" : "#176B50";
}
