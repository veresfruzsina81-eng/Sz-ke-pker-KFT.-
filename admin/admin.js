import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://gckynywmoxylwyppmkck.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdja3lueXdtb3h5bHd5cHBta2NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUxODUsImV4cCI6MjA3NDk2MTE4NX0.0p2EsBFpWnYCq5IpQ6T3FsgKkJBNt0kGRd901sNBanI";
const supa = createClient(supabaseUrl, supabaseKey);

document.getElementById("logoutBtn").onclick = () => {
  sessionStorage.removeItem("isAdmin");
  location.href = "login.html";
};

// TABOK
document.querySelectorAll(".admin-nav button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

// TERMÉKEK
async function loadProducts(){
  const { data } = await supa.from("products").select("*").order("created_at",{ascending:false});
  const list = document.getElementById("productList");
  list.innerHTML = data.map(p=>`
    <div class="card">
      <img src="${p.image_url||''}" alt="">
      <div>
        <strong>${p.name}</strong> – ${p.price} Ft
        <p>${p.description||''}</p>
        <button onclick="deleteProduct('${p.id}')">🗑 Törlés</button>
      </div>
    </div>
  `).join("");
}
window.deleteProduct = async (id)=>{
  await supa.from("products").delete().eq("id",id);
  loadProducts();
};

document.getElementById("addProductForm").onsubmit = async (e)=>{
  e.preventDefault();
  const name=document.getElementById("prodName").value;
  const price=parseInt(document.getElementById("prodPrice").value);
  const desc=document.getElementById("prodDesc").value;
  const img=document.getElementById("prodImg").value;
  await supa.from("products").insert([{name,price,description:desc,image_url:img}]);
  e.target.reset();
  loadProducts();
};

// RENDELÉSEK
async function loadOrders(){
  const { data } = await supa.from("orders").select("*").order("created_at",{ascending:false});
  const list=document.getElementById("orderList");
  list.innerHTML = data.map(o=>`
    <div class="card">
      <div><strong>${o.name}</strong> (${o.email}) – ${o.total} Ft</div>
      <pre>${JSON.stringify(o.items,null,2)}</pre>
      <button onclick="deleteOrder('${o.id}')">🗑 Törlés</button>
    </div>
  `).join("");
}
window.deleteOrder = async (id)=>{
  await supa.from("orders").delete().eq("id",id);
  loadOrders();
};

// VÉLEMÉNYEK
async function loadReviews(){
  const { data } = await supa.from("reviews").select("*").order("created_at",{ascending:false});
  const list=document.getElementById("reviewList");
  list.innerHTML = data.map(r=>`
    <div class="card">
      <strong>${r.author||'Anon'}</strong> – ${r.created_at}
      <p>${r.content}</p>
      <button onclick="deleteReview('${r.id}')">🗑 Törlés</button>
    </div>
  `).join("");
}
window.deleteReview = async (id)=>{
  await supa.from("reviews").delete().eq("id",id);
  loadReviews();
};

// INIT
loadProducts();
loadOrders();
loadReviews();
