/**
 * -------------------------------------------------------------------
 * SUPABASE OPERATIONS & INTERACTION HANDLERS LAYER
 * -------------------------------------------------------------------
 */
const SUPABASE_URL = "https://supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcm5wcHhjcG1taXh5d3J0aWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTM1NDgsImV4cCI6MjEwMDEyOTU0OH0.K3mn2TeTFg2s5K5Kv9EnZ7TriGQOt23No5THHNOxp94";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeSession = null;
let activeChatListingId = null;
let chatSubscriptionChannel = null;

document.addEventListener("DOMContentLoaded", () => {
  _supabase.auth.getSession().then(({ data: { session } }) => {
    updateSessionState(session);
    fetchActiveListings();
  });

  _supabase.auth.onAuthStateChange((_event, session) => {
    updateSessionState(session);
  });
});

function toggleThemeMode() {
  const bodyElement = document.body;
  if (bodyElement.classList.contains('light-mode')) {
    bodyElement.classList.remove('light-mode');
    localStorage.setItem('themePreference', 'dark');
  } else {
    bodyElement.classList.add('light-mode');
    localStorage.setItem('themePreference', 'light');
  }
}

(function manageStoredThemeLayout() {
  const activeSavedTheme = localStorage.getItem('themePreference');
  if (activeSavedTheme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
})();

function updateSessionState(session) {
  activeSession = session;
  const statusContainer = document.getElementById("auth-status");
  const authBox = document.getElementById("auth-box");
  const sellBox = document.getElementById("sell-box");

  if (session) {
    statusContainer.innerHTML = `
      <span class="user-email-display-tag">${session.user.email}</span>
      <button onclick="_supabase.auth.signOut()" class="logout-action-trigger-link">Logout</button>
    `;
    authBox.classList.add("hidden");
    sellBox.classList.remove("hidden");
  } else {
    statusContainer.innerHTML = `<span class="user-email-display-tag anonym-flag">Browsing Mode</span>`;
    authBox.classList.remove("hidden");
    sellBox.classList.add("hidden");
  }
}

async function handleSignUp() {
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  if(!email || !password) return alert("Credentials configurations missing.");
  const { error } = await _supabase.auth.signUp({ email, password });
  if (error) alert("Error creating profile: " + error.message);
  else alert("Sign up successful! You can now browse or post listings.");
}

async function handleSignIn() {
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  if(!email || !password) return alert("Credentials fields must be completely filled out.");
  const { error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) alert("Login error: " + error.message);
}

function validatePrice(price) {
  return (price > 0.0 && price <= 50000.0);
}

async function publishListing() {
  const title = document.getElementById("item-title").value;
  const description = document.getElementById("item-desc").value;
  const priceInput = document.getElementById("item-price").value;
  const imageFileInput = document.getElementById("item-image");
  const imageFile = imageFileInput.files;

  if (!title || !priceInput) return alert("Title and Price fields are mandatory components.");

  const targetPrice = parseFloat(priceInput);

  if (!validatePrice(targetPrice)) {
    return alert("Price validation error: Price must sit between $0.01 and $50,000.00.");
  }

  let image_url = "";

  if (imageFile.length > 0) {
    const file = imageFile[0];
    const uniqueFileName = `${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await _supabase.storage
      .from('marketplace-media')
      .upload(uniqueFileName, file);

    if (uploadError) return alert("Storage Upload Failed: " + uploadError.message);
    
    const { data: publicUrlData } = _supabase.storage
      .from('marketplace-media')
      .getPublicUrl(uniqueFileName);
          
    image_url = publicUrlData.publicUrl;
  }

  const { error } = await _supabase.from("listings").insert([
    { title, description, price: targetPrice, image_url, seller_id: activeSession.user.id }
  ]);

  if (error) {
    alert("Listing database instantiation block failure: " + error.message);
  } else {
    document.getElementById("item-title").value = "";
    document.getElementById("item-desc").value = "";
    document.getElementById("item-price").value = "";
    imageFileInput.value = "";
    fetchActiveListings();
  }
}

async function fetchActiveListings() {
  const { data: items, error } = await _supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  const feed = document.getElementById("listings-feed");
  feed.innerHTML = "";

  items.forEach(item => {
    const fallbackImg = 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%230a0a0a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-size="12">No Photo</text></svg>';
    const imgTag = item.image_url ? `<img src="${item.image_url}">` : `<img src="${fallbackImg}">`;
    
    feed.innerHTML += `
      <div class="card slide-in visible">
        ${imgTag}
        <div class="card-content">
          <div class="price-header-wrapper">
             <h3>${item.title}</h3>
             <span class="custom-price-tag-value">$${item.price}</span>
          </div>
          <p>${item.description || 'No description provided.'}</p>
          <button onclick="openChatRoom('${item.id}', '${item.title}')" class="view-btn">
            💬 Contact Seller / Offer
          </button>
        </div>
      </div>
    `;
  });
}

async function openChatRoom(listingId, listingTitle) {
  if (!activeSession) return alert("Profile session token missing. Please sign in before opening chat nodes.");
  
  activeChatListingId = listingId;
  document.getElementById("chat-title").innerText = `Negotiation Chat: ${listingTitle}`;
  document.getElementById("chat-modal").classList.remove("hidden");
  document.getElementById("chat-messages").innerHTML = `<p class="syncing-channel-text">Syncing secure transaction logs...</p>`;

  const { data: historicMessages } = await _supabase
    .from("messages")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  renderChatHistory(historicMessages || []);

  chatSubscriptionChannel = _supabase.channel(`public:messages:listing_id=eq.${listingId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `listing_id=eq.${listingId}` }, payload => {
          appendSingleMessage(payload.new);
    })
    .subscribe();
}

function renderChatHistory(messages) {
  const container = document.getElementById("chat-messages");
  container.innerHTML = messages.length === 0 ? `<p class="syncing-channel-text empty-chat">No transmission lines recorded yet.</p>` : "";
  messages.forEach(msg => appendSingleMessage(msg));
}

function appendSingleMessage(msg) {
  const container = document.getElementById("chat-messages");
  
  if(container.querySelector('.syncing-channel-text')) container.innerHTML = '';
  
  const isMe = msg.sender_email === activeSession.user.email;
  const targetMessageStyleVariantClass = isMe ? "outgoing-cloud" : "incoming-cloud";
  
  const msgBlob = document.createElement("div");
  msgBlob.className = `message-bubble-node ${targetMessageStyleVariantClass}`;
  msgBlob.innerHTML = `
    <span class="msg-meta">${msg.sender_email}</span>
    <p class="msg-body">${msg.message}</p>
  `;
  container.appendChild(msgBlob);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const messageText = input.value.trim();
  if (!messageText || !activeChatListingId) return;

  const { error } = await _supabase.from("messages").insert([
    { listing_id: activeChatListingId, sender_email: activeSession.user.email, message: messageText }
  ]);

  if (error) alert("Websocket transmission structural block fault: " + error.message);
  else input.value = "";
}

function closeChatRoom() {
  document.getElementById("chat-modal").classList.add("hidden");
  if (chatSubscriptionChannel) {
    _supabase.removeChannel(chatSubscriptionChannel);
    chatSubscriptionChannel = null;
  }
  activeChatListingId = null;
}
