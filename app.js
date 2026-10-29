
const config = window.HEAVENS_MART_CONFIG;

let supabaseClient = null;
let products = [];

document.addEventListener("DOMContentLoaded", initializeStore);

async function initializeStore() {
  const grid = document.getElementById("product-grid");

  if (!grid) {
    console.error("Product grid not found.");
    return;
  }

  grid.innerHTML = "<p>Loading products...</p>";

  if (!config || !config.url || !config.anonKey) {
    grid.innerHTML = "<p>Supabase configuration is missing.</p>";
    return;
  }

  if (!window.supabase) {
    grid.innerHTML = "<p>Supabase library is missing.</p>";
    return;
  }

  supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  await loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");

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
    displayProducts(products);
  } catch (error) {
    console.error("Heaven's Mart database error:", error);

    grid.innerHTML =
      "<p>Products could not load. Please check the database connection and permissions.</p>";
  }
}

function displayProducts(items) {
  const grid = document.getElementById("product-grid");

  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = "<p>No products available yet.</p>";
    return;
  }

  grid.innerHTML = items.map(product => {
    const phone = product.profiles?.whatsapp_number || "";
    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}">`
      : "";

    const whatsapp = phone
      ? `<a href="https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
          "Hello, I am interested in " + product.name
        )}" target="_blank" rel="noopener noreferrer">
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

document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("search-input");

  if (search) {
    search.addEventListener("input", event => {
      const term = event.target.value.toLowerCase();

      displayProducts(products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        (product.category || "").toLowerCase().includes(term)
      ));
    });
  }
});
