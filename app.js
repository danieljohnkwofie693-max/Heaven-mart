// Heaven's Mart - Ghana Marketplace

const config = window.HEAVENS_MART_CONFIG;

let supabaseClient = null;
let products = [];

document.addEventListener("DOMContentLoaded", initializeStore);

function initializeStore() {
  if (!config || !config.url || !config.anonKey) {
    console.error("Supabase configuration is missing.");
    return;
  }

  if (!window.supabase) {
    console.error("Supabase library is missing.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");

  if (grid) {
    grid.innerHTML = "<p>Loading products...</p>";
  }

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
    console.error("Could not load products:", error.message);

    if (grid) {
      grid.innerHTML =
        "<p>Products could not load. Please try again later.</p>";
    }

    return;
  }

  products = data || [];
  displayProducts(products);
}

function displayProducts(items) {
  const grid = document.getElementById("product-grid");

  if (!grid) {
    console.error("Product grid not found in index.html.");
    return;
  }

  if (items.length === 0) {
    grid.innerHTML = "<p>No products available yet.</p>";
    return;
  }

  grid.innerHTML = items.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}">`
      : "";

    const phone = product.profiles?.whatsapp_number || "";

    const message = encodeURIComponent(
      `Hello, I am interested in ${product.name}.`
    );

    const whatsapp = phone
      ? `<a href="https://wa.me/${phone.replace(/\D/g, "")}?text=${message}"
           target="_blank" rel="noopener noreferrer">
           Contact seller on WhatsApp
         </a>`
      : "<p>Seller contact unavailable.</p>";

    return `
      <article class="product-card">
        ${image}
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(product.description || "")}</p>
        <p><strong>GH₵ ${Number(product.price).toFixed(2)}</strong></p>
        <p>${escapeHTML(product.category || "General")}</p>
        ${whatsapp}
      </article>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Search products
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("search-input");

  if (search) {
    search.addEventListener("input", event => {
      const term = event.target.value.toLowerCase();

      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        (product.category || "").toLowerCase().includes(term)
      );

      displayProducts(filtered);
    });
  }
});// Heaven's Mart - Ghana Marketplace

const config = window.HEAVENS_MART_CONFIG;

let supabaseClient = null;
let products = [];

document.addEventListener("DOMContentLoaded", initializeStore);

function initializeStore() {
  if (!config || !config.url || !config.anonKey) {
    console.error("Supabase configuration is missing.");
    return;
  }

  if (!window.supabase) {
    console.error("Supabase library is missing.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");

  if (grid) {
    grid.innerHTML = "<p>Loading products...</p>";
  }

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
    console.error("Could not load products:", error.message);

    if (grid) {
      grid.innerHTML =
        "<p>Products could not load. Please try again later.</p>";
    }

    return;
  }

  products = data || [];
  displayProducts(products);
}

function displayProducts(items) {
  const grid = document.getElementById("product-grid");

  if (!grid) {
    console.error("Product grid not found in index.html.");
    return;
  }

  if (items.length === 0) {
    grid.innerHTML = "<p>No products available yet.</p>";
    return;
  }

  grid.innerHTML = items.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}">`
      : "";

    const phone = product.profiles?.whatsapp_number || "";

    const message = encodeURIComponent(
      `Hello, I am interested in ${product.name}.`
    );

    const whatsapp = phone
      ? `<a href="https://wa.me/${phone.replace(/\D/g, "")}?text=${message}"
           target="_blank" rel="noopener noreferrer">
           Contact seller on WhatsApp
         </a>`
      : "<p>Seller contact unavailable.</p>";

    return `
      <article class="product-card">
        ${image}
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(product.description || "")}</p>
        <p><strong>GH₵ ${Number(product.price).toFixed(2)}</strong></p>
        <p>${escapeHTML(product.category || "General")}</p>
        ${whatsapp}
      </article>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Search products
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("search-input");

  if (search) {
    search.addEventListener("input", event => {
      const term = event.target.value.toLowerCase();

      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        (product.category || "").toLowerCase().includes(term)
      );

      displayProducts(filtered);
    });
  }
});// Heaven's Mart - Ghana Marketplace

const config = window.HEAVENS_MART_CONFIG;

let supabaseClient = null;
let products = [];

document.addEventListener("DOMContentLoaded", initializeStore);

function initializeStore() {
  if (!config || !config.url || !config.anonKey) {
    console.error("Supabase configuration is missing.");
    return;
  }

  if (!window.supabase) {
    console.error("Supabase library is missing.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");

  if (grid) {
    grid.innerHTML = "<p>Loading products...</p>";
  }

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
    console.error("Could not load products:", error.message);

    if (grid) {
      grid.innerHTML =
        "<p>Products could not load. Please try again later.</p>";
    }

    return;
  }

  products = data || [];
  displayProducts(products);
}

function displayProducts(items) {
  const grid = document.getElementById("product-grid");

  if (!grid) {
    console.error("Product grid not found in index.html.");
    return;
  }

  if (items.length === 0) {
    grid.innerHTML = "<p>No products available yet.</p>";
    return;
  }

  grid.innerHTML = items.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}">`
      : "";

    const phone = product.profiles?.whatsapp_number || "";

    const message = encodeURIComponent(
      `Hello, I am interested in ${product.name}.`
    );

    const whatsapp = phone
      ? `<a href="https://wa.me/${phone.replace(/\D/g, "")}?text=${message}"
           target="_blank" rel="noopener noreferrer">
           Contact seller on WhatsApp
         </a>`
      : "<p>Seller contact unavailable.</p>";

    return `
      <article class="product-card">
        ${image}
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(product.description || "")}</p>
        <p><strong>GH₵ ${Number(product.price).toFixed(2)}</strong></p>
        <p>${escapeHTML(product.category || "General")}</p>
        ${whatsapp}
      </article>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Search products
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("search-input");

  if (search) {
    search.addEventListener("input", event => {
      const term = event.target.value.toLowerCase();

      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        (product.category || "").toLowerCase().includes(term)
      );

      displayProducts(filtered);
    });
  }
});
