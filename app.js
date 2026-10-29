/* =========================================
   HEAVEN'S MART - MAIN JAVASCRIPT
   Ghana Marketplace
========================================= */

let supabaseClient = null;
let currentUser = null;
let products = [];
let reviews = [];

/* =========================================
   INITIALIZE THE WEBSITE
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  // Set the current year
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Set up navigation FIRST, even if the database fails
  setupNavigation();
  setupSearchAndCategories();
  setupReviewForm();
  setupDashboard();

  // Check Supabase configuration
  const config = window.HEAVENS_MART_CONFIG;

  if (
    !config ||
    !config.url ||
    !config.anonKey ||
    !window.supabase
  ) {
    showDatabaseStatus(
      "Database configuration is missing. Check config.js and the Supabase library."
    );
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      config.url,
      config.anonKey
    );

    showDatabaseStatus("Connecting to Heaven's Mart...");

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    currentUser = data.session?.user || null;

    await updateDashboard();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;

      // Avoid doing additional authentication work inside the callback.
      setTimeout(() => {
        updateDashboard();
      }, 0);
    });

    await loadProducts();
    await loadReviews();

    showDatabaseStatus("Heaven's Mart is connected.");
  } catch (error) {
    console.error("Initialization error:", error);

    showDatabaseStatus(
      "Could not connect to the database. Check your Supabase settings."
    );
  }
});


/* =========================================
   NAVIGATION
========================================= */

function setupNavigation() {
  const dialog = document.getElementById("admin-dialog");
  const openButton = document.getElementById("open-admin");
  const closeButton = document.getElementById("close-admin");
  const menuButton = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");

  // Open seller dashboard
  if (openButton && dialog) {
    openButton.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    });
  }

  // Close seller dashboard
  if (closeButton && dialog) {
    closeButton.addEventListener("click", () => {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    });
  }

  // Close the dialog when clicking its backdrop
  if (dialog) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      }
    });
  }

  // Mobile navigation menu
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }
}


/* =========================================
   DATABASE STATUS
========================================= */

function showDatabaseStatus(message) {
  const element = document.getElementById("database-status");

  if (element) {
    element.textContent = message;
  }
}


/* =========================================
   SELLER DASHBOARD
========================================= */

function setupDashboard() {
  const authForm = document.getElementById("seller-auth-form");
  const authMode = document.getElementById("auth-mode");
  const logoutButton = document.getElementById("seller-logout");
  const profileForm = document.getElementById("seller-profile-form");
  const productForm = document.getElementById("product-form");

  // Switch between signup and login
  if (authMode) {
    authMode.addEventListener("change", () => {
      const isSignup = authMode.value === "signup";
      const nameWrap = document.getElementById(
        "seller-display-name-wrap"
      );

      if (nameWrap) {
        nameWrap.hidden = !isSignup;
      }

      const submitButton = document.getElementById(
        "seller-auth-submit"
      );

      if (submitButton) {
        submitButton.textContent = isSignup
          ? "Create seller account"
          : "Log in";
      }

      showMessage("auth-message", "");
    });
  }

  // Seller signup and login
  if (authForm) {
    authForm.addEventListener("submit", handleSellerAuth);
  }

  // Seller logout
  if (logoutButton) {
    logoutButton.addEventListener("click", handleSellerLogout);
  }

  // Update seller profile
  if (profileForm) {
    profileForm.addEventListener("submit", saveSellerProfile);
  }

  // Add product
  if (productForm) {
    productForm.addEventListener("submit", addProduct);
  }
}


async function handleSellerAuth(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showMessage(
      "auth-message",
      "The database is not connected. Check config.js."
    );
    return;
  }

  const mode = document.getElementById("auth-mode")?.value;
  const name = document.getElementById("seller-display-name")?.value.trim();
  const email = document.getElementById("seller-email")?.value.trim();
  const password = document.getElementById("seller-password")?.value;

  if (!email || !password) {
    showMessage("auth-message", "Enter your email and password.");
    return;
  }

  if (mode === "signup") {
    if (!name) {
      showMessage("auth-message", "Enter your display name.");
      return;
    }

    if (password.length < 6) {
      showMessage(
        "auth-message",
        "Your password must contain at least 6 characters."
      );
      return;
    }

    showMessage("auth-message", "Creating your seller account...");

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name
        }
      }
    });

    if (error) {
      showMessage("auth-message", error.message);
      return;
    }

    if (data.session) {
      currentUser = data.session.user;

      const profileResult = await ensureSellerProfile(name);

      if (!profileResult) {
        showMessage(
          "auth-message",
          "Your account was created, but your seller profile could not be saved. Check the profiles table permissions in Supabase."
        );
        return;
      }

      await updateDashboard();
      showMessage("auth-message", "Your seller account is ready.");
    } else {
      showMessage(
        "auth-message",
        "Account created. Check your email to confirm your account, then log in."
      );
    }

    return;
  }

  showMessage("auth-message", "Logging in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("auth-message", error.message);
    return;
  }

  currentUser = data.user;

  const profileResult = await ensureSellerProfile(
    currentUser.user_metadata?.display_name || ""
  );

  if (!profileResult) {
    showMessage(
      "auth-message",
      "You are logged in, but your seller profile could not be saved. Check the profiles table permissions in Supabase."
    );
    return;
  }

  await updateDashboard();

  showMessage("auth-message", "Login successful.");
}


async function ensureSellerProfile(displayName) {
  if (!supabaseClient || !currentUser) {
    return false;
  }

  const { data: existingProfile, error: selectError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name, whatsapp_number, role")
      .eq("id", currentUser.id)
      .maybeSingle();

  if (selectError) {
    console.error("Profile lookup error:", selectError);
    return false;
  }

  if (existingProfile) {
    // Do not change the role here. Role changes should be controlled
    // by secure database permissions.
    return true;
  }

  const { error: insertError } = await supabaseClient
    .from("profiles")
    .insert({
      id: currentUser.id,
      display_name:
        displayName ||
        currentUser.user_metadata?.display_name ||
        "Seller",
      role: "seller"
    });

  if (insertError) {
    console.error("Profile creation error:", insertError);
    return false;
  }

  return true;
}


async function handleSellerLogout() {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showMessage("auth-message", error.message);
    return;
  }

  currentUser = null;
  await updateDashboard();

  showMessage("auth-message", "You have logged out.");
}


async function updateDashboard() {
  const authSection = document.getElementById("seller-auth");
  const workspace = document.getElementById("seller-workspace");

  if (authSection) {
    authSection.hidden = Boolean(currentUser);
  }

  if (workspace) {
    workspace.hidden = !currentUser;
  }

  if (!currentUser || !supabaseClient) {
    renderMyProducts([]);
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("display_name, whatsapp_number, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Loading profile error:", error);
  }

  const displayNameInput = document.getElementById(
    "seller-display-name-edit"
  );
  const whatsappInput = document.getElementById("seller-whatsapp");

  if (displayNameInput) {
    displayNameInput.value = profile?.display_name || "";
  }

  if (whatsappInput) {
    whatsappInput.value = profile?.whatsapp_number || "";
  }

  await loadMyProducts();
}


/* =========================================
   SELLER PROFILE
========================================= */

async function saveSellerProfile(event) {
  event.preventDefault();

  if (!supabaseClient || !currentUser) {
    showMessage("seller-profile-message", "Please log in first.");
    return;
  }

  const displayName = document
    .getElementById("seller-display-name-edit")
    ?.value.trim();

  const whatsappNumber = document
    .getElementById("seller-whatsapp")
    ?.value.trim();

  if (!displayName || !whatsappNumber) {
    showMessage(
      "seller-profile-message",
      "Enter your display name and WhatsApp number."
    );
    return;
  }

  showMessage("seller-profile-message", "Saving your profile...");

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      display_name: displayName,
      whatsapp_number: whatsappNumber
    })
    .eq("id", currentUser.id);

  if (error) {
    console.error("Profile update error:", error);
    showMessage("seller-profile-message", error.message);
    return;
  }

  showMessage("seller-profile-message", "Profile saved successfully.");

  await loadProducts();
}


/* =========================================
   ADD PRODUCT
========================================= */

async function addProduct(event) {
  event.preventDefault();

  if (!supabaseClient || !currentUser) {
    showMessage("seller-product-message", "Please log in first.");
    return;
  }

  const name = document.getElementById("new-product-name")?.value.trim();
  const category = document.getElementById("new-product-category")?.value;
  const price = Number(
    document.getElementById("new-product-price")?.value
  );
  const description = document
    .getElementById("new-product-description")
    ?.value.trim();
  const imageUrl = document
    .getElementById("new-product-image")
    ?.value.trim();

  if (!name || !category || !Number.isFinite(price) || price <= 0) {
    showMessage(
      "seller-product-message",
      "Enter a product name, category, and valid price."
    );
    return;
  }

  showMessage("seller-product-message", "Adding your product...");

  const { error } = await supabaseClient.from("products").insert({
    seller_id: currentUser.id,
    name,
    category,
    price,
    description: description || "",
    image_url: imageUrl || null,
    is_active: true
  });

  if (error) {
    console.error("Add product error:", error);
    showMessage("seller-product-message", error.message);
    return;
  }

  document.getElementById("product-form")?.reset();

  showMessage("seller-product-message", "Product added successfully.");

  await loadProducts();
  await loadMyProducts();
}


/* =========================================
   LOAD PRODUCTS
========================================= */

async function loadProducts() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Loading products error:", error);
    showDatabaseStatus("Could not load products. Check database policies.");
    return;
  }

  products = data || [];

  renderProducts(products);
  populateCategories(products);
}


async function loadMyProducts() {
  if (!supabaseClient || !currentUser) {
    renderMyProducts([]);
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("seller_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Loading seller products error:", error);
    showMessage("seller-product-message", error.message);
    renderMyProducts([]);
    return;
  }

  renderMyProducts(data || []);
}


/* =========================================
   DISPLAY PRODUCTS
========================================= */
/* =========================================
DISPLAY PRODUCTS
========================================= */

function renderProducts(list) {
const container = document.getElementById("product-grid");

if (!container) {
console.error("Product container #product-grid was not found.");
return;
}

if (!list.length) {
container.innerHTML = "<p class="empty-state"> No products found. Please check again later. </p>";
return;
}

container.innerHTML = list.map((product) => {
const image = product.image_url
? "<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.style.display='none'">"
: "<div class="product-placeholder" aria-hidden="true">🛍️</div>";

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

async function contactSeller(productId) {
  if (!supabaseClient) {
    alert("The database is not connected yet.");
    return;
  }

  const product = products.find(
    (item) => String(item.id) === String(productId)
  );

  if (!product) {
    alert("This product is no longer available.");
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("display_name, whatsapp_number")
    .eq("id", product.seller_id)
    .maybeSingle();

  if (error) {
    console.error("Seller contact error:", error);
    alert("Could not load seller contact details.");
    return;
  }

  const phone = normalizeWhatsAppNumber(profile?.whatsapp_number);

  if (!phone) {
    alert("This seller has not added a valid WhatsApp number yet.");
    return;
  }

  const message = `Hello ${profile?.display_name || "seller"}, I am interested in "${product.name}" listed on Heaven's Mart. Is it available?`;

  const whatsappUrl =
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}


/* =========================================
   SELLER PRODUCT MANAGEMENT
========================================= */

function renderMyProducts(list) {
  const container = document.getElementById("my-products");

  if (!container) {
    return;
  }

  if (!list.length) {
    container.innerHTML = `
      <p class="empty-state">
        You have not added any products yet.
      </p>
    `;
    return;
  }

  container.innerHTML = list.map((product) => `
    <article class="seller-product">
      <div>
        <h3>${escapeHTML(product.name)}</h3>
        <p>${formatPrice(product.price)}</p>
        <p>Status: ${product.is_active ? "Active" : "Hidden"}</p>
      </div>

      <button
        type="button"
        class="button button-secondary toggle-product"
        data-product-id="${escapeHTML(product.id)}"
        data-active="${String(product.is_active)}">
        ${product.is_active ? "Hide product" : "Show product"}
      </button>

      <button
        type="button"
        class="button button-danger delete-product"
        data-product-id="${escapeHTML(product.id)}">
        Delete
      </button>
    </article>
  `).join("");

  container.querySelectorAll(".toggle-product").forEach((button) => {
    button.addEventListener("click", () => {
      toggleProduct(
        button.dataset.productId,
        button.dataset.active === "true"
      );
    });
  });

  container.querySelectorAll(".delete-product").forEach((button) => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.productId);
    });
  });
}


async function toggleProduct(productId, currentlyActive) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  const { error } = await supabaseClient
    .from("products")
    .update({ is_active: !currentlyActive })
    .eq("id", productId)
    .eq("seller_id", currentUser.id);

  if (error) {
    console.error("Toggle product error:", error);
    showMessage("seller-product-message", error.message);
    return;
  }

  await loadProducts();
  await loadMyProducts();

  showMessage("seller-product-message", "Product status updated.");
}


async function deleteProduct(productId) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", currentUser.id);

  if (error) {
    console.error("Delete product error:", error);
    showMessage("seller-product-message", error.message);
    return;
  }

  await loadProducts();
  await loadMyProducts();

  showMessage("seller-product-message", "Product deleted.");
}


/* =========================================
   SEARCH AND CATEGORY FILTERS
========================================= */

function setupSearchAndCategories() {
  const searchInput = document.getElementById("product-search");
  const categorySelect = document.getElementById("category-filter");

  if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", filterProducts);
  }
}


function filterProducts() {
  const search = (
    document.getElementById("product-search")?.value || ""
  ).toLowerCase().trim();

  const category =
    document.getElementById("category-filter")?.value || "";

  const filtered = products.filter((product) => {
    const matchesSearch =
      (product.name || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search);

    const matchesCategory =
      !category || product.category === category;

    return matchesSearch && matchesCategory;
  });

  renderProducts(filtered);
}


function populateCategories(list) {
  const select = document.getElementById("category-filter");

  if (!select) {
    return;
  }

  const selectedValue = select.value;

  const categories = [...new Set(
    list.map((product) => product.category).filter(Boolean)
  )].sort();

  select.innerHTML = `<option value="">All categories</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (categories.includes(selectedValue)) {
    select.value = selectedValue;
  }
}


/* =========================================
   CUSTOMER REVIEWS
========================================= */

function setupReviewForm() {
  const form = document.getElementById("review-form");
  const stars = document.querySelectorAll("[data-rating]");
  const ratingInput = document.getElementById("review-rating");

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      const rating = Number(star.dataset.rating);

      if (ratingInput) {
        ratingInput.value = String(rating);
      }

      stars.forEach((item) => {
        const selected = Number(item.dataset.rating) <= rating;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  if (form) {
    form.addEventListener("submit", submitReview);
  }
}


async function submitReview(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showMessage("review-message", "The database is not connected.");
    return;
  }

  const name = document.getElementById("review-name")?.value.trim();
  const rating = Number(
    document.getElementById("review-rating")?.value
  );
  const comment = document.getElementById("review-comment")?.value.trim();

  if (!name || !comment || rating < 1 || rating > 5) {
    showMessage(
      "review-message",
      "Enter your name, select a rating, and write a review."
    );
    return;
  }

  const { error } = await supabaseClient.from("reviews").insert({
    customer_name: name,
    rating,
    comment,
    status: "pending"
  });

  if (error) {
    console.error("Review submission error:", error);
    showMessage("review-message", error.message);
    return;
  }

  document.getElementById("review-form")?.reset();
  document.querySelectorAll("[data-rating]").forEach((star) => {
    star.classList.remove("selected");
    star.setAttribute("aria-pressed", "false");
  });

  showMessage(
    "review-message",
    "Thank you! Your review has been submitted for approval."
  );

  await loadReviews();
}


async function loadReviews() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("reviews")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Loading reviews error:", error);
    return;
  }

  reviews = data || [];
  renderReviews(reviews);
}


function renderReviews(list) {
  const container = document.getElementById("reviews-list");

  if (!container) {
    return;
  }

  if (!list.length) {
    container.innerHTML = `
      <p class="empty-state">
        No approved reviews yet. Be the first to share your experience!
      </p>
    `;
    return;
  }

  container.innerHTML = list.map((review) => `
    <article class="review-card">
      <h3>${escapeHTML(review.customer_name)}</h3>

      <p class="review-stars" aria-label="${Number(review.rating)} out of 5 stars">
        ${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}
      </p>

      <p>${escapeHTML(review.comment)}</p>
    </article>
  `).join("");
}


/* =========================================
   GENERAL HELPERS
========================================= */

function showMessage(elementId, message) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = message;
  }
}


function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}


function formatPrice(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(amount);
}


function normalizeWhatsAppNumber(value) {
  let phone = String(value || "").replace(/\D/g, "");

  // Convert Ghana's local 0XXXXXXXXX format to 233XXXXXXXXX.
  if (phone.startsWith("0") && phone.length === 10) {
    phone = "233" + phone.slice(1);
  }

  // Accept Ghanaian international numbers.
  if (phone.startsWith("233") && phone.length === 12) {
    return phone;
  }

  // Do not open WhatsApp with an invalid number.
  return "";
}
