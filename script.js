const SUPABASE_URL = "https://sdrnppxcpmmixywrtatpc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcm5wcHhjcG1taXh5d3J0YXRwYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg0NTUzNTQ4LCJleHAiOjIxMDAxMjk1NDh9.K3mn2TeTFg2s5K5Kv9EnZ7TriGQOt23No5THHNOxp94";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeSession = null;
let activeChatListingId = null;
let chatSubscriptionChannel = null;
let myStore = null;

const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const first = (object, keys, fallback = "") => {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  return fallback;
};
const fallbackSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="#151515"/><text x="50%" y="50%" fill="#777" text-anchor="middle" dominant-baseline="middle" font-family="Arial">No image</text></svg>');
const imageFallback = `data:image/svg+xml;charset=UTF-8,${fallbackSvg}`;

function toggleThemeMode() {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("themePreference", document.body.classList.contains("light-mode") ? "light" : "dark");
  updateThemeButton();
}
function updateThemeButton() {
  const button = document.getElementById("theme-toggle");
  if (button) button.textContent = document.body.classList.contains("light-mode") ? "☀️" : "🌙";
}
(function initTheme() {
  if (localStorage.getItem("themePreference") === "light") document.body.classList.add("light-mode");
  updateThemeButton();
})();

window.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  await updateSessionState(session);
  await refreshEverything();
  _supabase.auth.onAuthStateChange(async (_event, sessionState) => {
    await updateSessionState(sessionState);
    await refreshEverything();
  });
});

async function updateSessionState(session) {
  activeSession = session;
  const status = document.getElementById("auth-status");
  const authBox = document.getElementById("auth-box");
  const sellBox = document.getElementById("sell-box");
  const editorButton = document.getElementById("open-store-editor");
  if (!status || !authBox || !sellBox) return;

  if (session) {
    status.innerHTML = `<span class="user-email-display-tag">${esc(session.user.email)}</span><button class="logout-action-trigger-link" onclick="_supabase.auth.signOut()">Logout</button>`;
    authBox.classList.add("hidden");
    sellBox.classList.remove("hidden");
    editorButton?.classList.remove("hidden");
    await loadMyStore();
  } else {
    status.innerHTML = `<span class="user-email-display-tag anonym-flag">Browsing Mode</span>`;
    authBox.classList.remove("hidden");
    sellBox.classList.add("hidden");
    editorButton?.classList.add("hidden");
    myStore = null;
  }
}

async function handleSignUp() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) return alert("Enter your email and password.");
  const { error } = await _supabase.auth.signUp({ email, password });
  if (error) alert("Sign up error: " + error.message);
  else alert("Sign up successful. You can now sign in and create your store.");
}

async function handleSignIn() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) return alert("Enter your email and password.");
  const { error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) alert("Login error: " + error.message);
}

function normalizeStore(row) {
  return {
    raw: row,
    id: first(row, ["id", "store_id"]),
    ownerId: first(row, ["user_id", "owner_id", "seller_id", "profile_id", "created_by"]),
    name: first(row, ["store_name", "name", "business_name", "title"], "Business Store"),
    description: first(row, ["description", "bio", "about", "store_description"], ""),
    logo: first(row, ["logo_url", "logo", "store_logo", "avatar_url", "image_url"]),
    banner: first(row, ["banner_url", "banner", "store_banner", "cover_url", "cover_image_url"]),
    createdAt: first(row, ["created_at"])
  };
}

function normalizeListing(row) {
  return {
    ...row,
    ownerId: first(row, ["seller_id", "user_id", "owner_id", "profile_id"]),
    title: first(row, ["title", "name"], "Untitled product"),
    description: first(row, ["description", "details"], ""),
    price: first(row, ["price"], ""),
    image: first(row, ["image_url", "image", "photo_url"])
  };
}

async function loadMyStore() {
  if (!activeSession) return;
  const { data: rows, error } = await _supabase.from("stores").select("*").order("created_at", { ascending: false });
  if (error) {
    myStore = null;
    console.error("loadMyStore:", error);
    return;
  }
  const found = (rows || []).map(normalizeStore).find(store => String(store.ownerId) === String(activeSession.user.id));
  myStore = found || null;
  const title = document.getElementById("store-form-title");
  if (title) title.textContent = myStore ? "Edit your store" : "Create your store";
}

async function fetchStores() {
  const feed = document.getElementById("stores-feed");
  const status = document.getElementById("stores-status");
  if (!feed || !status) return [];
  feed.innerHTML = "";
  status.textContent = "Loading stores...";

  const { data: rows, error } = await _supabase.from("stores").select("*").order("created_at", { ascending: false });
  if (error) {
    status.textContent = "Storefronts could not be loaded. Check the stores table and its RLS policies.";
    console.error("fetchStores:", error);
    return [];
  }

  const stores = (rows || []).map(normalizeStore);
  if (!stores.length) {
    status.textContent = "No Business Storefronts yet.";
    return [];
  }

  const { data: allListings, error: listingsError } = await _supabase.from("listings").select("*").order("created_at", { ascending: false });
  if (listingsError) console.error("store products:", listingsError);
  const products = (allListings || []).map(normalizeListing);

  for (const store of stores) {
    const storeProducts = store.ownerId ? products.filter(product => String(product.ownerId) === String(store.ownerId)).slice(0, 5) : [];
    const thumbs = storeProducts.filter(product => product.image).slice(0, 4).map(product => `<img class="store-product-thumb" src="${esc(product.image)}" alt="" loading="lazy">`).join("");
    const card = document.createElement("article");
    card.className = "store-card";
    card.innerHTML = `
      <img class="store-banner" src="${esc(store.banner || imageFallback)}" alt="${esc(store.name)} banner" loading="lazy">
      <div class="store-body">
        <img class="store-logo" src="${esc(store.logo || imageFallback)}" alt="${esc(store.name)} logo" loading="lazy">
        <div class="store-body-inner">
          <h3>${esc(store.name)}</h3>
          <p>${esc(store.description || "Welcome to our store.")}</p>
          <div class="store-products">${thumbs || '<span class="eyebrow">NO PRODUCTS YET</span>'}</div>
        </div>
      </div>`;
    card.addEventListener("click", () => openStore(store, storeProducts));
    feed.appendChild(card);
  }
  status.textContent = `${stores.length} store${stores.length === 1 ? "" : "s"}`;
  return stores;
}

function openStore(store, products) {
  const modal = document.getElementById("store-modal");
  const content = document.getElementById("store-modal-content");
  if (!modal || !content) return;
  const normalizedProducts = (products || []).map(normalizeListing);
  content.innerHTML = `
    <div class="store-modal-content">
      <img class="store-modal-banner" src="${esc(store.banner || imageFallback)}" alt="${esc(store.name)} banner">
      <img class="store-modal-logo" src="${esc(store.logo || imageFallback)}" alt="${esc(store.name)} logo">
      <h2>${esc(store.name)}</h2>
      <p class="store-description">${esc(store.description || "")}</p>
      <div class="store-modal-products">
        ${normalizedProducts.length ? normalizedProducts.map(product => `
          <div class="mini-product">
            ${product.image ? `<img src="${esc(product.image)}" alt="${esc(product.title)}" loading="lazy">` : ""}
            <div><strong>${esc(product.title)}</strong>${product.price !== "" ? `<br>$${esc(product.price)}` : ""}</div>
          </div>`).join("") : "<p>No products listed yet.</p>"}
      </div>
    </div>`;
  modal.classList.remove("hidden");
}

function closeStoreModal(event) {
  const modal = document.getElementById("store-modal");
  if (!modal) return;
  if (!event || event.target === modal) modal.classList.add("hidden");
}

function openStoreEditor() {
  if (!activeSession) return alert("Please sign in first.");
  document.getElementById("store-box")?.classList.remove("hidden");
  document.getElementById("store-name").value = myStore?.name || "";
  document.getElementById("store-description").value = myStore?.description || "";
  document.getElementById("store-form-status").textContent = "";
  document.getElementById("store-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
function closeStoreEditor() { document.getElementById("store-box")?.classList.add("hidden"); }

function storagePathFromUrl(url) {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    return match ? { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) } : null;
  } catch {
    return null;
  }
}

async function removeStorageFile(url) {
  const parsed = storagePathFromUrl(url);
  if (!parsed) return false;
  const { error } = await _supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    console.warn("Storage cleanup failed:", error.message);
    return false;
  }
  return true;
}

async function uploadStoreImage(file, type) {
  if (!file || !activeSession) return null;
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `stores/${activeSession.user.id}/${type}_${Date.now()}_${crypto.randomUUID()}.${extension}`;
  const { error } = await _supabase.storage.from("store-media").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return _supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

async function saveStore(event) {
  event.preventDefault();
  if (!activeSession) return alert("Please sign in first.");
  const status = document.getElementById("store-form-status");
  const button = document.getElementById("save-store-button");
  const name = document.getElementById("store-name").value.trim();
  const description = document.getElementById("store-description").value.trim();
  if (!name) return alert("Enter a store name.");

  button.disabled = true;
  status.textContent = "Saving store...";
  let newLogo = null;
  let newBanner = null;

  try {
    newLogo = await uploadStoreImage(document.getElementById("store-logo").files[0], "logo");
    newBanner = await uploadStoreImage(document.getElementById("store-banner").files[0], "banner");

    const current = myStore?.raw || {};
    const payload = { ...current };
    if ("user_id" in current || !myStore) payload.user_id = activeSession.user.id;
    if ("owner_id" in current) payload.owner_id = activeSession.user.id;
    if ("seller_id" in current) payload.seller_id = activeSession.user.id;
    if ("store_name" in current || !myStore) payload.store_name = name;
    if ("name" in current || !myStore) payload.name = name;
    if ("business_name" in current) payload.business_name = name;
    if ("title" in current) payload.title = name;
    if ("description" in current || !myStore) payload.description = description;
    if ("logo_url" in current || !myStore) payload.logo_url = newLogo || myStore?.logo || null;
    if ("banner_url" in current || !myStore) payload.banner_url = newBanner || myStore?.banner || null;

    let result;
    if (myStore?.id) {
      result = await _supabase.from("stores").update(payload).eq("id", myStore.id);
    } else {
      result = await _supabase.from("stores").insert(payload);
    }
    if (result.error) throw result.error;

    if (myStore) {
      if (newLogo && myStore.logo && myStore.logo !== newLogo) await removeStorageFile(myStore.logo);
      if (newBanner && myStore.banner && myStore.banner !== newBanner) await removeStorageFile(myStore.banner);
    }

    document.getElementById("store-logo").value = "";
    document.getElementById("store-banner").value = "";
    await loadMyStore();
    await fetchStores();
    status.textContent = "Store saved successfully.";
  } catch (error) {
    if (newLogo) await removeStorageFile(newLogo);
    if (newBanner) await removeStorageFile(newBanner);
    console.error("saveStore:", error);
    status.textContent = "Could not save store: " + error.message;
  } finally {
    button.disabled = false;
  }
}

function validatePrice(price) { return Number.isFinite(price) && price > 0 && price <= 50000; }

async function publishListing() {
  if (!activeSession) return alert("Please sign in first.");
  const title = document.getElementById("item-title").value.trim();
  const description = document.getElementById("item-desc").value.trim();
  const price = parseFloat(document.getElementById("item-price").value);
  const input = document.getElementById("item-image");
  if (!title || !validatePrice(price)) return alert("Enter a title and a price between $0.01 and $50,000.");

  let imageUrl = "";
  let uploadedUrl = null;
  try {
    if (input.files[0]) {
      const file = input.files[0];
      const path = `${activeSession.user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await _supabase.storage.from("marketplace-media").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upload.error) throw upload.error;
      imageUrl = _supabase.storage.from("marketplace-media").getPublicUrl(path).data.publicUrl;
      uploadedUrl = imageUrl;
    }
    const { error } = await _supabase.from("listings").insert({ title, description, price, image_url: imageUrl, seller_id: activeSession.user.id });
    if (error) throw error;
    document.getElementById("item-title").value = "";
    document.getElementById("item-desc").value = "";
    document.getElementById("item-price").value = "";
    input.value = "";
    await refreshEverything();
  } catch (error) {
    if (uploadedUrl) await removeStorageFile(uploadedUrl);
    alert("Could not publish listing: " + error.message);
  }
}

async function fetchActiveListings() {
  const feed = document.getElementById("listings-feed");
  const status = document.getElementById("listings-status");
  if (!feed || !status) return;
  feed.innerHTML = "";
  status.textContent = "Loading listings...";
  const { data: items, error } = await _supabase.from("listings").select("*").order("created_at", { ascending: false });
  if (error) {
    status.textContent = "Listings could not be loaded.";
    console.error(error);
    return;
  }
  status.textContent = `${items?.length || 0} listing${items?.length === 1 ? "" : "s"}`;
  (items || []).map(normalizeListing).forEach(item => {
    const card = document.createElement("article");
    card.className = "listing-card";
    card.innerHTML = `<img src="${esc(item.image || imageFallback)}" alt="${esc(item.title)}" loading="lazy"><div class="card-content"><div class="price-header-wrapper"><h3>${esc(item.title)}</h3><span class="custom-price-tag-value">${item.price !== "" ? `$${esc(item.price)}` : ""}</span></div><p>${esc(item.description || "No description provided.")}</p><button class="view-btn">💬 Contact Seller / Offer</button></div>`;
    card.querySelector("button").addEventListener("click", () => openChatRoom(item.id, item.title));
    feed.appendChild(card);
  });
}

async function openChatRoom(listingId, listingTitle) {
  if (!activeSession) return alert("Please sign in before opening chat.");
  activeChatListingId = listingId;
  document.getElementById("chat-title").textContent = `Negotiation Chat: ${listingTitle}`;
  document.getElementById("chat-modal").classList.remove("hidden");
  document.getElementById("chat-messages").innerHTML = '<p class="syncing-channel-text">Loading messages...</p>';
  const { data } = await _supabase.from("messages").select("*").eq("listing_id", listingId).order("created_at", { ascending: true });
  renderChatHistory(data || []);
  if (chatSubscriptionChannel) _supabase.removeChannel(chatSubscriptionChannel);
  chatSubscriptionChannel = _supabase.channel(`messages-${listingId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `listing_id=eq.${listingId}` }, payload => appendSingleMessage(payload.new)).subscribe();
}

function renderChatHistory(messages) {
  const container = document.getElementById("chat-messages");
  container.innerHTML = messages.length ? "" : '<p class="syncing-channel-text">No messages yet.</p>';
  messages.forEach(appendSingleMessage);
}
function appendSingleMessage(message) {
  const container = document.getElementById("chat-messages");
  if (container.querySelector(".syncing-channel-text")) container.innerHTML = "";
  const mine = message.sender_email === activeSession?.user?.email;
  const bubble = document.createElement("div");
  bubble.className = `message-bubble-node ${mine ? "outgoing-cloud" : "incoming-cloud"}`;
  bubble.innerHTML = `<span class="msg-meta">${esc(message.sender_email)}</span><span>${esc(message.message)}</span>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !activeChatListingId || !activeSession) return;
  const { error } = await _supabase.from("messages").insert({ listing_id: activeChatListingId, sender_email: activeSession.user.email, message: text });
  if (error) alert(error.message); else input.value = "";
}
function closeChatRoom(event) {
  const modal = document.getElementById("chat-modal");
  if (!event || event.target === modal) {
    modal.classList.add("hidden");
    if (chatSubscriptionChannel) _supabase.removeChannel(chatSubscriptionChannel);
    chatSubscriptionChannel = null;
    activeChatListingId = null;
  }
}

async function refreshEverything() {
  await Promise.allSettled([fetchStores(), fetchActiveListings(), activeSession ? loadMyStore() : Promise.resolve()]);
}
