// Supabase init
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_KEY = "PUBLIC_ANON_KEY";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Termékek betöltése (shop.html) ---
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("product-list").innerHTML = "Hiba a betöltéskor!";
    return;
  }

  let html = "";
  data.forEach(p => {
    html += `
      <div class="product-card">
        <img src="${p.image_url}" alt="${p.title}">
        <h3>${p.title}</h3>
        <p>${p.price} Ft</p>
        <a href="product.html?id=${p.id}">
          <button>Megnyitás</button>
        </a>
        <button onclick="addToCart('${p.id}', '${p.title}', ${p.price})">Kosárba</button>
      </div>
    `;
  });

  document.getElementById("product-list").innerHTML = html;
}

// --- Kosár kezelés ---
function addToCart(id, title, price) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.push({ id, title, price });
  localStorage.setItem("cart", JSON.stringify(cart));
  alert(`${title} hozzáadva a kosárhoz!`);
}

// --- Product részletei (product.html) ---
async function loadProductDetails() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) return;

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    document.getElementById("product-details").innerHTML = "Hiba!";
    return;
  }

  document.getElementById("product-details").innerHTML = `
    <h2>${data.title}</h2>
    <img src="${data.image_url}" alt="${data.title}">
    <p>${data.description || "Nincs leírás"}</p>
    <p><strong>${data.price} Ft</strong></p>
    <button onclick="addToCart('${data.id}', '${data.title}', ${data.price})">Kosárba</button>
  `;
}

// --- Vélemények kezelése ---
async function loadReviews(productId) {
  const { data } = await supabaseClient
    .from("reviews")
    .select("*")
    .eq("product_id", productId);

  let html = "";
  data.forEach(r => {
    html += `<li><b>${r.user}</b>: ${r.text}</li>`;
  });
  document.getElementById("review-list").innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("product-list")) loadProducts();
  if (document.getElementById("product-details")) loadProductDetails();
});
// --- Vélemény mentése ---
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (id && document.getElementById("review-form")) {
    loadReviews(id);

    document.getElementById("review-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = e.target.querySelector("textarea").value;

      const { error } = await supabaseClient
        .from("reviews")
        .insert([
          { product_id: id, user: "Vendég", text }
        ]);

      if (error) {
        alert("Hiba a vélemény mentésekor!");
      } else {
        e.target.reset();
        loadReviews(id);
      }
    });
  }
});

