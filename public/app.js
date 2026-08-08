// VIBESPHERE - GEN Z SOCIAL MEDIA CHAT & DAILY HIGHLIGHTS APP JS

// State Management
const state = {
  currentUser: null,
  token: localStorage.getItem('vibesphere_token') || null,
  channels: [],
  activeChannel: 'main-stage',
  messages: [],
  highlights: null,
  members: [],
  soundEnabled: true,
  slangModeEnabled: true,
  ws: null,
  typingTimeout: null,
  userVotes: {},
  pendingImage: null,
  unblurredMessages: {}
};

// Gen Z Slang Dictionary for Auto-Highlighting & Tooltips
const SLANG_DICTIONARY = {
  'rizz': 'Charm, charisma, or ability to smoothly attract someone.',
  'no cap': 'For real, no lie, 100% truth.',
  'cap': 'Lie or fake claim.',
  'ate': 'Performed exceptionally well, crushed it completely.',
  'crashed out': 'Lost temper or acted erratically over a minor issue.',
  'skibidi': 'Absurdist Gen Z meme descriptor for chaotic or cool energy.',
  'main character': 'Someone radiating confidence as if they are the protagonist.',
  'cooking': 'Creating something great or making impressive moves.',
  'cooked': 'In trouble, exhausted, or doomed.',
  'brainrot': 'Mind-numbing internet memes or chaotic viral content.',
  'gyatt': 'Exclamation of surprise or appreciation.',
  'y2k': 'Late 90s & early 2000s nostalgic retro aesthetic.',
  'stan': 'Obsessive fan or supporter of someone.',
  'bet': 'Agreement or confirmation ("deal", "for sure").',
  'touch grass': 'Go outside and take a break from the internet.'
};

// Web Audio Sound Effects Synthesizer (No external audio files required!)
function playSound(type = 'pop') {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'vote') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Audio Context optional
  }
}

// API Helper
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAuth();
  await loadChannels();
  await loadDailyHighlights();
  await loadMembers();
  initWebSocket();
});

// Auth Check & Session Hydration
async function checkAuth() {
  if (!state.token) {
    updateUserUI(null);
    return;
  }
  try {
    const user = await apiCall('/api/auth/me');
    state.currentUser = user;
    updateUserUI(user);
  } catch (err) {
    console.warn('Session expired or invalid token');
    localStorage.removeItem('vibesphere_token');
    state.token = null;
    state.currentUser = null;
    updateUserUI(null);
  }
}

function updateUserUI(user) {
  const profileContainer = document.getElementById('user-profile-container');
  if (!profileContainer) return;

  if (user) {
    profileContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="user-profile-btn" onclick="openProfileModal()" title="View Profile">
          <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}" class="user-avatar" alt="${user.username}" />
          <div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <span class="vibe-chip">${escapeHtml(user.vibe_tag || '✨ Main Character')}</span>
          </div>
        </div>
        <button class="logout-btn" onclick="handleLogout()" title="Log Out of VibeSphere">
          <span>🚪</span> Log Out
        </button>
      </div>
    `;
  } else {
    profileContainer.innerHTML = `
      <button class="auth-btn-primary" onclick="openAuthModal('login')">
        🔐 Log In / Join Squad
      </button>
    `;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      playSound('pop');
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetTab = tab.dataset.tab;
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // Sound Toggle
  document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    btn.innerHTML = state.soundEnabled ? '🔊' : '🔇';
    if (state.soundEnabled) playSound('pop');
  });

  // Slang Mode Toggle
  document.getElementById('slang-toggle-btn')?.addEventListener('click', () => {
    state.slangModeEnabled = !state.slangModeEnabled;
    playSound('pop');
    renderMessages();
  });

  // Message Send Form
  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendMessage();
  });

  // Input typing listener
  document.getElementById('chat-input-field')?.addEventListener('input', () => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    if (state.typingTimeout) clearTimeout(state.typingTimeout);

    state.ws.send(JSON.stringify({
      type: 'TYPING_INDICATOR',
      channelSlug: state.activeChannel,
      isTyping: true
    }));

    state.typingTimeout = setTimeout(() => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          type: 'TYPING_INDICATOR',
          channelSlug: state.activeChannel,
          isTyping: false
        }));
      }
    }, 2000);
  });
}

// WebSocket Management
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('⚡ WebSocket Connected');
    joinWsChannel(state.activeChannel);
  };

  state.ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_MESSAGE') {
        playSound('pop');
        state.messages.push(data.message);
        renderMessages();
        scrollToChatBottom();
      } else if (data.type === 'REACTION_UPDATED') {
        const msg = state.messages.find(m => m.id === data.messageId);
        if (msg) {
          msg.reactions = data.reactions;
          renderMessages();
        }
      } else if (data.type === 'MESSAGE_EDITED') {
        const idx = state.messages.findIndex(m => m.id === data.message.id);
        if (idx !== -1) {
          state.messages[idx] = data.message;
          renderMessages();
        }
      } else if (data.type === 'MESSAGE_DELETED') {
        state.messages = state.messages.filter(m => m.id !== parseInt(data.messageId, 10));
        renderMessages();
      } else if (data.type === 'USER_TYPING') {
        const typingBar = document.getElementById('typing-indicator-bar');
        if (typingBar) {
          typingBar.innerText = data.isTyping ? `⚡ ${data.username} is cooking a reply...` : '';
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  state.ws.onclose = () => {
    setTimeout(initWebSocket, 3000); // Auto reconnect
  };
}

function joinWsChannel(channelSlug) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: 'JOIN_CHANNEL',
      channelSlug: channelSlug,
      userId: state.currentUser ? state.currentUser.id : null,
      username: state.currentUser ? state.currentUser.username : 'Guest'
    }));
  }
}

// Load Channels & Messages
async function loadChannels() {
  try {
    state.channels = await apiCall('/api/channels');
    renderChannelsList();
    if (state.channels.length > 0) {
      selectChannel(state.channels[0].slug);
    }
  } catch (err) {
    console.error('Error loading channels:', err);
  }
}

function renderChannelsList() {
  const listEl = document.getElementById('channels-list');
  if (!listEl) return;

  listEl.innerHTML = state.channels.map(c => `
    <div class="channel-item ${c.slug === state.activeChannel ? 'active' : ''}" onclick="selectChannel('${c.slug}')">
      <span class="channel-icon">${c.icon || '💬'}</span>
      <span class="channel-name">#${c.name}</span>
    </div>
  `).join('');
}

async function selectChannel(slug) {
  playSound('pop');
  state.activeChannel = slug;
  renderChannelsList();

  const channelObj = state.channels.find(c => c.slug === slug);
  if (channelObj) {
    document.getElementById('current-channel-title').innerText = `#${channelObj.name}`;
    document.getElementById('current-channel-desc').innerText = channelObj.description;
  }

  joinWsChannel(slug);

  try {
    state.messages = await apiCall(`/api/channels/${slug}/messages`);
    renderMessages();
    scrollToChatBottom();
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// Render Messages & Gen Z Slang Parser
function renderMessages() {
  const container = document.getElementById('messages-container');
  if (!container) return;

  if (state.messages.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 40px;">
        ✨ No messages here yet. Be the main character and start the conversation!
      </div>
    `;
    return;
  }

  container.innerHTML = state.messages.map(msg => {
    const formattedContent = formatSlangText(msg.content);
    const reactions = msg.reactions || {};
    const reactionKeys = Object.keys(reactions);

    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let imageMarkup = '';
    if (msg.image_url) {
      const isNsfw = Boolean(msg.is_nsfw);
      const isUnblurred = Boolean(state.unblurredMessages[msg.id]);

      if (isNsfw) {
        imageMarkup = `
          <div class="nsfw-image-wrapper ${isUnblurred ? 'unblurred' : 'blurred'}" id="nsfw-wrapper-${msg.id}">
            <img src="${msg.image_url}" class="message-image" alt="NSFW Content" />
            <div class="nsfw-overlay">
              <div class="nsfw-badge">🔞 NSFW CONTENT</div>
              <button class="nsfw-unblur-btn" onclick="toggleNsfwBlur(${msg.id})">
                👁️ Click to Unblur
              </button>
            </div>
            <button class="nsfw-reblur-btn" onclick="toggleNsfwBlur(${msg.id})" title="Re-blur image">
              🙈 Blur
            </button>
          </div>
        `;
      } else {
        imageMarkup = `<img src="${msg.image_url}" class="message-image" alt="Attachment" />`;
      }
    }

    const isOwner = state.currentUser && msg.user_id === state.currentUser.id;

    return `
      <div class="message-card" id="msg-${msg.id}">
        <img src="${msg.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + msg.username}" class="message-avatar" alt="${msg.username}" />
        <div class="message-body">
          <div class="message-meta">
            <span class="message-author">${msg.username}</span>
            <span class="vibe-chip">${msg.vibe_tag || '✨ Vibe'}</span>
            <span class="message-time">${timeStr} ${msg.is_edited ? '<span style="font-size:0.7rem; color:var(--text-dim); font-style:italic;">(edited)</span>' : ''}</span>
            ${isOwner ? `
              <div class="owner-actions">
                <button class="owner-action-btn" onclick="openEditModal(${msg.id})" title="Edit message">✏️ Edit</button>
                <button class="owner-action-btn delete-btn" onclick="deleteMessage(${msg.id})" title="Delete message">🗑️ Delete</button>
              </div>
            ` : ''}
          </div>
          <div class="message-text">${formattedContent}</div>
          ${imageMarkup}

          <div class="reactions-list">
            ${reactionKeys.map(k => `
              <div class="reaction-pill" onclick="addReaction(${msg.id}, '${k}')">
                <span>${k}</span> <span>${reactions[k]}</span>
              </div>
            `).join('')}
          </div>

          <div class="quick-react-menu">
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '💀')">💀</button>
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '🔥')">🔥</button>
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '🗿')">🗿</button>
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '✨')">✨</button>
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '💅')">💅</button>
            <button class="quick-react-btn" onclick="addReaction(${msg.id}, '💯')">💯</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function formatSlangText(text) {
  if (!text) return '';
  if (!state.slangModeEnabled) return escapeHtml(text);

  let formatted = escapeHtml(text);
  Object.keys(SLANG_DICTIONARY).forEach(term => {
    const regex = new RegExp(`\\b(${term})\\b`, 'gi');
    const def = SLANG_DICTIONARY[term.toLowerCase()];
    formatted = formatted.replace(regex, `<span class="slang-highlight" data-definition="${def}">$1</span>`);
  });
  return formatted;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function scrollToChatBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// Send Message
async function sendMessage() {
  if (!state.currentUser) {
    openAuthModal('login');
    return;
  }

  const inputEl = document.getElementById('chat-input-field');
  const imgUrlEl = document.getElementById('image-url-input');
  const nsfwCheckbox = document.getElementById('nsfw-toggle-checkbox');

  const content = inputEl.value.trim();
  const image_url = state.pendingImage || (imgUrlEl ? imgUrlEl.value.trim() : null);
  const is_nsfw = nsfwCheckbox ? nsfwCheckbox.checked : false;

  if (!content && !image_url) return;

  try {
    const newMsg = await apiCall(`/api/channels/${state.activeChannel}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, image_url, is_nsfw })
    });

    inputEl.value = '';
    clearImageAttachment();
    playSound('pop');

    // Broadcast via WS
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        channelSlug: state.activeChannel,
        message: newMsg
      }));
    }
  } catch (err) {
    alert(err.message);
  }
}

// Device Image & Password Toggle Helpers
function triggerDeviceImagePicker() {
  playSound('pop');
  document.getElementById('device-image-input')?.click();
}

function handleDeviceImageSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('File is too large! Please select an image under 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.pendingImage = e.target.result;
    showImagePreview(e.target.result, file.name);
    playSound('pop');
  };
  reader.readAsDataURL(file);
}

function handleImageUrlInput(event) {
  const url = event.target.value.trim();
  if (url) {
    state.pendingImage = url;
    showImagePreview(url, 'URL Image');
  } else {
    clearImageAttachment();
  }
}

function showImagePreview(src, name) {
  const bar = document.getElementById('image-preview-bar');
  const thumb = document.getElementById('image-preview-thumb');
  const nameEl = document.getElementById('image-preview-name');

  if (bar && thumb && nameEl) {
    thumb.src = src;
    nameEl.innerText = name || 'Image attached';
    bar.style.display = 'flex';
  }
}

function clearImageAttachment() {
  state.pendingImage = null;
  const bar = document.getElementById('image-preview-bar');
  const fileInput = document.getElementById('device-image-input');
  const urlInput = document.getElementById('image-url-input');
  const nsfwCheckbox = document.getElementById('nsfw-toggle-checkbox');

  if (bar) bar.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  if (nsfwCheckbox) nsfwCheckbox.checked = false;
}

function toggleNsfwBlur(msgId) {
  playSound('pop');
  state.unblurredMessages[msgId] = !state.unblurredMessages[msgId];
  renderMessages();
}

function togglePasswordVisibility(inputId, btnEl) {
  playSound('pop');
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btnEl.innerText = '🙈';
    btnEl.title = 'Hide password';
  } else {
    input.type = 'password';
    btnEl.innerText = '👁️';
    btnEl.title = 'Show password';
  }
}

// Edit & Delete Message Functions
function openEditModal(msgId) {
  const msg = state.messages.find(m => m.id === msgId);
  if (!msg) return;

  playSound('pop');
  document.getElementById('edit-message-id').value = msg.id;
  document.getElementById('edit-message-content').value = msg.content || '';
  document.getElementById('edit-message-image').value = msg.image_url || '';
  document.getElementById('edit-message-nsfw').checked = Boolean(msg.is_nsfw);

  const modal = document.getElementById('edit-modal-overlay');
  if (modal) modal.classList.add('active');
}

function closeEditModal() {
  playSound('pop');
  const modal = document.getElementById('edit-modal-overlay');
  if (modal) modal.classList.remove('active');
}

async function handleSaveEdit(e) {
  e.preventDefault();
  const msgId = document.getElementById('edit-message-id').value;
  const content = document.getElementById('edit-message-content').value.trim();
  const image_url = document.getElementById('edit-message-image').value.trim() || null;
  const is_nsfw = document.getElementById('edit-message-nsfw').checked;

  try {
    const updatedMsg = await apiCall(`/api/messages/${msgId}`, {
      method: 'PUT',
      body: JSON.stringify({ content, image_url, is_nsfw })
    });

    closeEditModal();
    playSound('vote');

    const idx = state.messages.findIndex(m => m.id == msgId);
    if (idx !== -1) {
      state.messages[idx] = updatedMsg;
      renderMessages();
    }

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'MESSAGE_EDITED',
        channelSlug: state.activeChannel,
        message: updatedMsg
      }));
    }
  } catch (err) {
    alert(err.message);
  }
}

async function deleteMessage(msgId) {
  if (!confirm('Are you sure you want to delete this message? 🗑️')) return;

  try {
    await apiCall(`/api/messages/${msgId}`, {
      method: 'DELETE'
    });

    playSound('pop');
    state.messages = state.messages.filter(m => m.id !== msgId);
    renderMessages();

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'MESSAGE_DELETED',
        channelSlug: state.activeChannel,
        messageId: msgId
      }));
    }
  } catch (err) {
    alert(err.message);
  }
}

// Add Emoji Reaction
async function addReaction(messageId, emoji) {
  if (!state.currentUser) {
    openAuthModal('login');
    return;
  }
  try {
    const updated = await apiCall(`/api/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    playSound('pop');

    const msg = state.messages.find(m => m.id === messageId);
    if (msg) {
      msg.reactions = updated.reactions;
      renderMessages();
    }

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'REACTION_UPDATE',
        channelSlug: state.activeChannel,
        messageId,
        reactions: updated.reactions
      }));
    }
  } catch (err) {
    console.error(err);
  }
}

// Load & Render Daily Highlights
async function loadDailyHighlights() {
  try {
    state.highlights = await apiCall('/api/highlights/daily');
    renderDailyHighlights();
  } catch (err) {
    console.error('Error loading daily highlights:', err);
  }
}

function renderDailyHighlights() {
  const container = document.getElementById('daily-highlights-content');
  if (!container || !state.highlights) return;

  const h = state.highlights;
  const mainChar = h.main_character;
  const slang = h.slang_of_the_day;
  const poll = h.daily_poll;
  const drops = h.pop_culture_drops || [];
  const meme = h.meme_of_day;

  const totalVotes = poll.total_votes || 1;

  container.innerHTML = `
    <div class="highlights-header glass-panel">
      <div class="highlights-title">${h.title}</div>
      <div class="highlights-subtitle">${h.subtitle}</div>
    </div>

    <div class="highlights-grid">
      <!-- Main Character Hero Card -->
      <div class="highlight-card glass-panel">
        <span class="card-header-badge badge-pink">👑 TODAY'S MAIN CHARACTER</span>
        <div class="main-char-body">
          <img src="${mainChar.avatar}" class="main-char-img" alt="${mainChar.name}" />
          <div class="main-char-info">
            <h3>${mainChar.name}</h3>
            <span class="vibe-chip">${mainChar.vibeRating}</span>
            <p>${mainChar.bio}</p>
          </div>
        </div>
      </div>

      <!-- Slang of the Day Card -->
      <div class="highlight-card glass-panel">
        <span class="card-header-badge badge-cyan">📖 SLANG OF THE DAY</span>
        <div>
          <span class="slang-term">${slang.term}</span>
          <span class="slang-phonetic">${slang.pronunciation} • ${slang.category}</span>
        </div>
        <div class="slang-def">${slang.definition}</div>
        <div class="slang-example">${slang.example}</div>
      </div>

      <!-- Interactive Daily Poll Card -->
      <div class="highlight-card glass-panel" style="grid-column: span 1;">
        <span class="card-header-badge badge-purple">📊 DAILY HOT TAKE POLL</span>
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; margin-bottom: 8px;">${poll.question}</h3>

        <div class="poll-options">
          ${poll.options.map(opt => {
            const percent = Math.round(((opt.votes || 0) / totalVotes) * 100);
            return `
              <button class="poll-option-btn" onclick="voteDailyPoll('${h.date_str}', ${opt.id})">
                <div class="poll-progress-fill" style="width: ${percent}%;"></div>
                <span class="poll-text">${opt.text}</span>
                <span class="poll-percent">${percent}% (${opt.votes || 0})</span>
              </button>
            `;
          }).join('')}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-dim); text-align: right; margin-top: 6px;">
          Total Votes: ${totalVotes}
        </div>
      </div>

      <!-- Meme of the Day Card -->
      <div class="highlight-card glass-panel">
        <span class="card-header-badge badge-emerald">🖼️ MEME OF THE DAY</span>
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.1rem;">${meme.title}</h3>
        <img src="${meme.imageUrl}" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px;" alt="Meme of the day" />
        <div style="font-size: 0.9rem; font-style: italic; color: var(--text-muted);">${meme.caption}</div>
      </div>
    </div>
  `;
}

// Daily Poll Voting
async function voteDailyPoll(date_str, option_id) {
  if (!state.currentUser) {
    openAuthModal('login');
    return;
  }
  try {
    const res = await apiCall('/api/highlights/poll/vote', {
      method: 'POST',
      body: JSON.stringify({ date_str, option_id })
    });
    playSound('vote');
    state.highlights.daily_poll = res.daily_poll;
    renderDailyHighlights();
  } catch (err) {
    alert(err.message);
  }
}

// Load Members
async function loadMembers() {
  try {
    state.members = await apiCall('/api/members');
    renderMembers();
  } catch (err) {
    console.error('Error loading members:', err);
  }
}

function renderMembers() {
  const container = document.getElementById('members-grid-container');
  if (!container) return;

  container.innerHTML = state.members.map(m => `
    <div class="member-card glass-panel">
      <img src="${m.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + m.username}" class="member-avatar" alt="${m.username}" />
      <div class="member-name">${m.username}</div>
      <span class="vibe-chip">${m.vibe_tag || '✨ Squad Member'}</span>
      <p style="font-size: 0.85rem; color: var(--text-muted); min-height: 38px;">${m.bio || m.status_message}</p>
      <button class="dm-action-btn" onclick="openDirectMessageModal(${m.id}, '${m.username}')">💬 Direct Message</button>
    </div>
  `).join('');
}

// Auth Modal Management ("login must through")
function openAuthModal(defaultTab = 'login') {
  playSound('pop');
  const modal = document.getElementById('auth-modal-overlay');
  if (modal) modal.classList.add('active');
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  playSound('pop');
  const modal = document.getElementById('auth-modal-overlay');
  if (modal) modal.classList.remove('active');
}

function switchAuthTab(tabName) {
  playSound('pop');
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form-body').forEach(f => f.style.display = 'none');

  document.getElementById(`auth-tab-${tabName}`)?.classList.add('active');
  document.getElementById(`form-${tabName}`)?.style.setProperty('display', 'flex');
}

// Auth Handlers
async function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('login-username-input').value.trim();
  const password = document.getElementById('login-password-input').value;

  try {
    const data = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password })
    });

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('vibesphere_token', data.token);

    updateUserUI(data.user);
    closeAuthModal();
    playSound('vote');
  } catch (err) {
    alert(err.message);
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username-input').value.trim();
  const email = document.getElementById('reg-email-input').value.trim();
  const password = document.getElementById('reg-password-input').value;
  const vibe_tag = document.getElementById('reg-vibe-input').value.trim();
  const avatar_url = document.getElementById('reg-avatar-input').value.trim();

  try {
    const data = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, vibe_tag, avatar_url })
    });

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('vibesphere_token', data.token);

    updateUserUI(data.user);
    closeAuthModal();
    playSound('vote');
  } catch (err) {
    alert(err.message);
  }
}

// Quick Demo Login
async function quickDemoLogin(username) {
  try {
    const data = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail: username, password: 'password123' })
    });

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('vibesphere_token', data.token);

    updateUserUI(data.user);
    closeAuthModal();
    playSound('vote');
  } catch (err) {
    alert(err.message);
  }
}

function openProfileModal() {
  if (!state.currentUser) return;
  const user = state.currentUser;
  const modal = document.getElementById('profile-modal-overlay');
  const body = document.getElementById('profile-modal-body');

  if (body) {
    body.innerHTML = `
      <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}" style="width:80px; height:80px; border-radius:50%; border:3px solid var(--accent-purple); object-fit:cover;" alt="${user.username}" />
      <div>
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800;">${escapeHtml(user.username)}</h3>
        <span class="vibe-chip" style="margin-top: 4px; display: inline-block;">${escapeHtml(user.vibe_tag || '✨ Main Character')}</span>
      </div>
      <div style="font-size: 0.9rem; color: var(--text-muted); width: 100%; background: rgba(255,255,255,0.03); padding: 14px; border-radius: 14px; border: 1px solid var(--border-glass); text-align: left;">
        <div style="margin-bottom: 6px;"><b>Email:</b> ${escapeHtml(user.email || 'N/A')}</div>
        <div><b>Status:</b> ${escapeHtml(user.status_message || 'Vibing in VibeSphere ⚡')}</div>
      </div>
      <button class="logout-btn" style="width: 100%; justify-content: center; padding: 12px; font-size: 0.95rem; margin-top: 10px;" onclick="handleLogout()">
        🚪 Log Out of VibeSphere
      </button>
    `;
  }

  if (modal) {
    playSound('pop');
    modal.classList.add('active');
  }
}

function closeProfileModal() {
  playSound('pop');
  const modal = document.getElementById('profile-modal-overlay');
  if (modal) modal.classList.remove('active');
}

function handleLogout() {
  playSound('pop');
  localStorage.removeItem('vibesphere_token');
  state.token = null;
  state.currentUser = null;
  closeProfileModal();
  updateUserUI(null);

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    joinWsChannel(state.activeChannel);
  }
}
