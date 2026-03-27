const state = {
  page: 'subscriptions',
  topBarMode: 'idle',
  query: '',
  users: [],
  selectedUserIds: [],
  subscriptions: [],
  searchResults: [],
  appSettings: null,
  expandedChannelId: null,
  highlightedChannelId: null,
  resolveCache: null,
  appVersion: '0.0.0',
};

const els = {
  smartInput: document.getElementById('smart-input'),
  primaryAction: document.getElementById('primary-action'),
  modePill: document.getElementById('mode-pill'),
  modeHint: document.getElementById('mode-hint'),
  secondaryActions: document.getElementById('secondary-actions'),
  userPills: document.getElementById('user-pills'),
  subscriptionsContent: document.getElementById('subscriptions-content'),
  subscriptionsStatus: document.getElementById('subscriptions-status'),
  refreshSubscriptions: document.getElementById('refresh-subscriptions'),
  backToSubscriptions: document.getElementById('back-to-subscriptions'),
  sectionTitle: document.getElementById('section-title'),
  navSubscriptions: document.getElementById('nav-subscriptions'),
  navSettings: document.getElementById('nav-settings'),
  subscriptionsView: document.getElementById('subscriptions-view'),
  settingsView: document.getElementById('settings-view'),
  appSettingsForm: document.getElementById('app-settings-form'),
  saveSettings: document.getElementById('save-settings'),
  appVersion: document.getElementById('app-version'),
};

const escapeHtml = (value = '') => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function inferMode(input) {
  const trimmed = input.trim();
  if (!trimmed) return 'idle';
  if (/^https?:\/\//i.test(trimmed) && /(watch\?v=|youtu\.be\/|\/shorts\/)/i.test(trimmed)) return 'video-url';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  return 'search';
}

function modeLabel(mode) {
  return {
    idle: 'Idle',
    search: 'Search',
    url: 'Channel URL',
    'video-url': 'Video URL',
    results: 'Results',
  }[mode] || mode;
}

function modeHint(mode) {
  return {
    idle: 'Paste a YouTube URL or search by channel name.',
    search: 'Search up to your configured default result count.',
    url: 'TubSubarr will fetch channel metadata and subscribe directly.',
    'video-url': 'Primary action subscribes to the source channel. Secondary actions handle this one video.',
    results: 'Search results temporarily replace the subscriptions list.',
  }[mode] || '';
}

function primaryLabel(mode) {
  if (mode === 'url' || mode === 'video-url') return 'Subscribe';
  return 'Search';
}

function avatarMarkup(url, fallback) {
  if (url) return `<img class="avatar" src="${escapeHtml(url)}" alt="${escapeHtml(fallback)}" />`;
  return `<div class="avatar avatar-fallback">${escapeHtml((fallback || '?').slice(0, 1).toUpperCase())}</div>`;
}

function renderSettingsSection(title, description, body) {
  return `
    <section class="settings-section">
      <div>
        <h4>${escapeHtml(title)}</h4>
        <p class="muted">${escapeHtml(description)}</p>
      </div>
      <div class="settings-section-body">${body}</div>
    </section>
  `;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadSubscriptions() {
  const [data, meta] = await Promise.all([api('/subscriptions'), api('/meta')]);
  state.subscriptions = data.subscriptions;
  state.users = data.users;
  state.appSettings = data.appSettings;
  state.appVersion = meta.version || '0.0.0';
  if (state.selectedUserIds.length === 0) {
    state.selectedUserIds = data.users.filter((user) => user.name === 'Shared').map((user) => user.id);
    if (state.selectedUserIds.length === 0) state.selectedUserIds = data.users.slice(0, 1).map((user) => user.id);
  }
  if (state.page === 'settings') {
    renderAppSettingsForm();
  }
  render();
}

function selectedUserIdsFromForm(form) {
  return Array.from(form.querySelectorAll('input[name="userIds"]:checked')).map((input) => input.value);
}

function renderUserPills() {
  els.userPills.innerHTML = state.users.map((user) => `
    <label class="pill selectable ${state.selectedUserIds.includes(user.id) ? 'selected' : ''}">
      <input type="checkbox" value="${user.id}" ${state.selectedUserIds.includes(user.id) ? 'checked' : ''} data-user-pill />
      <span>${escapeHtml(user.name)}</span>
    </label>
  `).join('');

  els.userPills.querySelectorAll('[data-user-pill]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedUserIds = Array.from(els.userPills.querySelectorAll('[data-user-pill]:checked')).map((node) => node.value);
      renderUserPills();
    });
  });
}

function renderSecondaryActions() {
  if (state.topBarMode !== 'video-url') {
    els.secondaryActions.classList.add('hidden');
    els.secondaryActions.innerHTML = '';
    return;
  }

  els.secondaryActions.classList.remove('hidden');
  els.secondaryActions.innerHTML = `
    <button class="ghost" data-secondary="browser">Download video to browser</button>
    <button class="ghost" data-secondary="library">Only add this video to media library</button>
  `;

  els.secondaryActions.querySelectorAll('[data-secondary]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.secondary === 'browser') {
        window.open(state.query, '_blank', 'noopener');
        return;
      }
      await subscribeFromInput({ onlyThisVideo: true });
    });
  });
}

function renderTopBar() {
  els.smartInput.value = state.query;
  els.appVersion.textContent = `v${state.appVersion}`;
  els.modePill.textContent = modeLabel(state.topBarMode);
  els.modeHint.textContent = modeHint(state.topBarMode);
  els.primaryAction.textContent = primaryLabel(state.topBarMode);
  renderSecondaryActions();
  renderUserPills();
}

function renderStatus(message) {
  els.subscriptionsStatus.textContent = message;
}

function renderResults() {
  els.sectionTitle.textContent = 'Search results';
  els.backToSubscriptions.classList.remove('hidden');
  renderStatus(`Showing up to ${state.searchResults.length} channel matches for “${state.query}”.`);
  els.subscriptionsContent.innerHTML = state.searchResults.map((result) => `
    <article class="card result-card">
      <div class="result-main">
        ${avatarMarkup(result.avatarUrl, result.name)}
        <div>
          <h3>${escapeHtml(result.name)}</h3>
          <p class="muted clamp-2">${escapeHtml(result.summary || 'No summary returned by YouTube metadata.')}</p>
          <p class="meta-link">${escapeHtml(result.url)}</p>
        </div>
      </div>
      <button data-subscribe-result="${escapeHtml(result.url)}">Subscribe</button>
    </article>
  `).join('');

  els.subscriptionsContent.querySelectorAll('[data-subscribe-result]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.query = button.dataset.subscribeResult;
      state.topBarMode = inferMode(state.query);
      renderTopBar();
      await subscribeFromInput();
    });
  });
}

function renderVideoList(videos) {
  if (!videos?.length) return '<p class="muted">No downloaded videos tracked for this channel yet.</p>';
  return `
    <div class="video-list">
      ${videos.map((video) => `
        <article class="video-row">
          <div>
            <strong>${escapeHtml(video.title)}</strong>
            <p class="muted">${video.isWatched ? 'Watched' : 'Unwatched'}${video.durationSeconds ? ` · ${Math.round(video.durationSeconds / 60)} min` : ''}</p>
          </div>
          <button class="ghost small" data-toggle-pin="${video.id}">${video.isPinned ? 'Unpin' : 'Pin'}</button>
        </article>
      `).join('')}
    </div>
  `;
}

function renderMediaSection(channel) {
  const sections = [];
  if (channel.mediaMusic) {
    sections.push(renderSettingsSection('Music', 'Use music-specific matching without changing core retention rules.', `
      <div class="subsetting-note">Music channels inherit the title filter, shorts toggle, and keep-after-watched behavior.</div>
    `));
  }
  if (channel.mediaShow) {
    sections.push(renderSettingsSection('Show', 'Long-form shows can share the same library while keeping independent retention controls.', `
      <div class="subsetting-note">Show channels honor the channel pause threshold and unwatched retention override.</div>
    `));
  }
  if (channel.mediaPodcast) {
    sections.push(renderSettingsSection('Podcast', 'Define title keyword rules and episode length heuristics.', `
      <label>
        <span>Title keyword rules</span>
        <input name="podcastTitleKeywords" value="${escapeHtml(channel.podcastTitleKeywords || '')}" placeholder="podcast, episode, interview" />
      </label>
      <div class="inline-fields">
        <label>
          <span>Min length (seconds)</span>
          <input type="number" min="0" name="podcastMinLengthSeconds" value="${channel.podcastMinLengthSeconds ?? ''}" />
        </label>
        <label>
          <span>Max length (seconds)</span>
          <input type="number" min="0" name="podcastMaxLengthSeconds" value="${channel.podcastMaxLengthSeconds ?? ''}" />
        </label>
      </div>
    `));
  }
  return sections.join('');
}

function renderSubscriptionCard(channel) {
  const expanded = state.expandedChannelId === channel.id;
  return `
    <article class="card channel-card ${state.highlightedChannelId === channel.id ? 'highlighted' : ''}" id="channel-${channel.id}">
      <div class="channel-row">
        <div class="channel-main">
          ${avatarMarkup(channel.avatarUrl, channel.name)}
          <div>
            <div class="channel-title-row">
              <h3>${escapeHtml(channel.name)}</h3>
              <span class="status ${channel.isActive ? 'active' : 'paused'}">${channel.isActive ? 'Active' : 'Paused'}</span>
            </div>
            <p class="muted clamp-2">${escapeHtml(channel.summary || 'No channel summary available yet.')}</p>
            <p class="meta-link">${channel.assignments.map((assignment) => assignment.user.name).join(', ')}</p>
          </div>
        </div>
        <button class="icon-button" data-expand-channel="${channel.id}" aria-label="Channel settings">⚙</button>
      </div>
      ${expanded ? `
        <form class="channel-settings" data-channel-form="${channel.id}">
          <div class="settings-grid">
            ${renderSettingsSection('Subscription behavior', 'Default behavior for new uploads on this channel.', `
              <label class="toggle-row"><input type="checkbox" name="downloadOnlyNewVideos" ${channel.downloadOnlyNewVideos ? 'checked' : ''} /> Download only new videos</label>
              <label>
                <span>Optional title filter</span>
                <input name="titleFilter" value="${escapeHtml(channel.titleFilter || '')}" placeholder="e.g. live set" />
              </label>
              <label class="toggle-row"><input type="checkbox" name="includeShorts" ${channel.includeShorts ? 'checked' : ''} /> Include YouTube Shorts</label>
              <label class="toggle-row"><input type="checkbox" name="keepAfterWatched" ${channel.keepAfterWatched ? 'checked' : ''} /> Keep after watched</label>
              <label>
                <span>Unwatched retention (days)</span>
                <input type="number" min="1" name="unwatchedRetentionDays" value="${channel.unwatchedRetentionDays}" />
              </label>
              <label>
                <span>Pause downloads after unwatched count</span>
                <input type="number" min="1" name="pauseDownloadsThreshold" value="${channel.pauseDownloadsThreshold ?? ''}" placeholder="Use app default" />
              </label>
            `)}
            ${renderSettingsSection('Media types', 'Choose what kind of content this channel should be treated as.', `
              <div class="media-checks">
                <label class="toggle-row"><input type="checkbox" name="mediaMusic" ${channel.mediaMusic ? 'checked' : ''} /> Music</label>
                <label class="toggle-row"><input type="checkbox" name="mediaShow" ${channel.mediaShow ? 'checked' : ''} /> Show</label>
                <label class="toggle-row"><input type="checkbox" name="mediaPodcast" ${channel.mediaPodcast ? 'checked' : ''} /> Podcast</label>
              </div>
              ${renderMediaSection(channel)}
            `)}
            ${renderSettingsSection('Owners', 'Each selected user gets this channel in their Jellyfin view library.', `
              <div class="pill-row compact">
                ${state.users.map((user) => `
                  <label class="pill selectable ${channel.assignments.some((assignment) => assignment.userId === user.id) ? 'selected' : ''}">
                    <input type="checkbox" name="userIds" value="${user.id}" ${channel.assignments.some((assignment) => assignment.userId === user.id) ? 'checked' : ''} />
                    <span>${escapeHtml(user.name)}</span>
                  </label>
                `).join('')}
              </div>
            `)}
          </div>
          <div class="channel-actions">
            <button type="submit">Save channel settings</button>
            <button type="button" class="ghost" data-delete-channel="${channel.id}">Unsubscribe</button>
          </div>
          <div class="channel-videos">
            <h4>Recent downloads</h4>
            ${renderVideoList(channel.videos)}
          </div>
        </form>
      ` : ''}
    </article>
  `;
}

function bindChannelCardEvents() {
  els.subscriptionsContent.querySelectorAll('[data-expand-channel]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expandedChannelId = state.expandedChannelId === button.dataset.expandChannel ? null : button.dataset.expandChannel;
      render();
    });
  });

  els.subscriptionsContent.querySelectorAll('[data-channel-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const channelId = form.dataset.channelForm;
      const payload = {
        downloadOnlyNewVideos: form.downloadOnlyNewVideos.checked,
        titleFilter: form.titleFilter.value || null,
        includeShorts: form.includeShorts.checked,
        keepAfterWatched: form.keepAfterWatched.checked,
        unwatchedRetentionDays: Number(form.unwatchedRetentionDays.value || 30),
        pauseDownloadsThreshold: form.pauseDownloadsThreshold.value ? Number(form.pauseDownloadsThreshold.value) : null,
        mediaMusic: form.mediaMusic.checked,
        mediaShow: form.mediaShow.checked,
        mediaPodcast: form.mediaPodcast.checked,
        podcastTitleKeywords: form.podcastTitleKeywords?.value || null,
        podcastMinLengthSeconds: form.podcastMinLengthSeconds?.value ? Number(form.podcastMinLengthSeconds.value) : null,
        podcastMaxLengthSeconds: form.podcastMaxLengthSeconds?.value ? Number(form.podcastMaxLengthSeconds.value) : null,
        userIds: selectedUserIdsFromForm(form),
      };
      await api(`/subscriptions/${channelId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await loadSubscriptions();
      state.expandedChannelId = channelId;
      renderStatus('Channel settings saved.');
    });
  });

  els.subscriptionsContent.querySelectorAll('[data-delete-channel]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/subscriptions/${button.dataset.deleteChannel}`, { method: 'DELETE' });
      await loadSubscriptions();
      renderStatus('Subscription removed.');
    });
  });

  els.subscriptionsContent.querySelectorAll('[data-toggle-pin]').forEach((button) => {
    button.addEventListener('click', async () => {
      const current = button.textContent === 'Unpin';
      await api(`/videos/${button.dataset.togglePin}`, { method: 'PATCH', body: JSON.stringify({ isPinned: !current }) });
      await loadSubscriptions();
      renderStatus('Video pin updated.');
    });
  });
}

function renderSubscriptions() {
  els.sectionTitle.textContent = 'Subscriptions';
  els.backToSubscriptions.classList.add('hidden');
  renderStatus(`${state.subscriptions.length} subscribed channel${state.subscriptions.length === 1 ? '' : 's'}.`);
  if (!state.subscriptions.length) {
    const template = document.getElementById('empty-state-template');
    els.subscriptionsContent.innerHTML = template.innerHTML;
    return;
  }
  els.subscriptionsContent.innerHTML = state.subscriptions.map(renderSubscriptionCard).join('');
  bindChannelCardEvents();
}

function renderAppSettingsForm() {
  if (!state.appSettings) return;
  els.appSettingsForm.innerHTML = `
    <div class="settings-grid app-settings-grid">
      ${renderSettingsSection('New channel defaults', 'Applied when a fresh subscription is created from the smart bar.', `
        <label class="toggle-row"><input type="checkbox" name="includeShortsDefault" ${state.appSettings.includeShortsDefault ? 'checked' : ''} /> Include shorts by default</label>
        <div class="inline-fields">
          <label>
            <span>Min video length (seconds)</span>
            <input type="number" min="0" name="minVideoLengthSecondsDefault" value="${state.appSettings.minVideoLengthSecondsDefault ?? ''}" />
          </label>
          <label>
            <span>Max video length (seconds)</span>
            <input type="number" min="0" name="maxVideoLengthSecondsDefault" value="${state.appSettings.maxVideoLengthSecondsDefault ?? ''}" />
          </label>
        </div>
        <label class="toggle-row"><input type="checkbox" name="keepAfterWatchedDefault" ${state.appSettings.keepAfterWatchedDefault ? 'checked' : ''} /> Keep after watched by default</label>
        <label>
          <span>Default unwatched retention (days)</span>
          <input type="number" min="1" name="unwatchedRetentionDaysDefault" value="${state.appSettings.unwatchedRetentionDaysDefault}" />
        </label>
        <label>
          <span>Pause downloads after unwatched count</span>
          <input type="number" min="1" name="pauseDownloadsThresholdDefault" value="${state.appSettings.pauseDownloadsThresholdDefault ?? ''}" />
        </label>
      `)}
      ${renderSettingsSection('Search & podcast detection', 'Controls how the smart bar and podcast auto-detection behave.', `
        <label>
          <span>Default search result limit</span>
          <input type="number" min="1" max="25" name="searchResultLimitDefault" value="${state.appSettings.searchResultLimitDefault}" />
        </label>
        <label>
          <span>Default podcast title keywords</span>
          <input name="podcastTitleKeywordsDefault" value="${escapeHtml(state.appSettings.podcastTitleKeywordsDefault || '')}" placeholder="podcast, episode, interview" />
        </label>
        <div class="inline-fields">
          <label>
            <span>Podcast min length (seconds)</span>
            <input type="number" min="0" name="podcastMinLengthSecondsDefault" value="${state.appSettings.podcastMinLengthSecondsDefault ?? ''}" />
          </label>
          <label>
            <span>Podcast max length (seconds)</span>
            <input type="number" min="0" name="podcastMaxLengthSecondsDefault" value="${state.appSettings.podcastMaxLengthSecondsDefault ?? ''}" />
          </label>
        </div>
      `)}
    </div>
  `;
}

function switchPage(page) {
  state.page = page;
  els.navSubscriptions.classList.toggle('active', page === 'subscriptions');
  els.navSettings.classList.toggle('active', page === 'settings');
  els.subscriptionsView.classList.toggle('hidden', page !== 'subscriptions');
  els.settingsView.classList.toggle('hidden', page !== 'settings');
  if (page === 'settings') renderAppSettingsForm();
}

function render() {
  renderTopBar();
  switchPage(state.page);
  if (state.page === 'subscriptions') {
    if (state.topBarMode === 'results') renderResults();
    else renderSubscriptions();
  }
}

async function resolveInput() {
  if (!state.query.trim()) return null;
  const result = await api('/subscriptions/resolve', {
    method: 'POST',
    body: JSON.stringify({ input: state.query, limit: state.appSettings?.searchResultLimitDefault || 10 }),
  });
  state.resolveCache = result;
  return result;
}

async function searchFromInput() {
  const resolved = await resolveInput();
  if (!resolved) return;
  state.topBarMode = resolved.mode;
  state.searchResults = resolved.results || [];
  render();
}

async function subscribeFromInput({ onlyThisVideo = false } = {}) {
  if (!state.selectedUserIds.length) {
    renderStatus('Select at least one owner before subscribing.');
    return;
  }

  const resolved = state.resolveCache?.query === state.query ? state.resolveCache : await resolveInput();
  const mode = resolved?.mode || state.topBarMode;
  const channelUrl = resolved?.channel?.url || state.query;
  const payload = {
    url: channelUrl,
    userIds: state.selectedUserIds,
    seedVideoUrl: mode === 'video-url' && onlyThisVideo ? state.query : null,
  };

  const subscription = await api('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  state.topBarMode = 'idle';
  state.searchResults = [];
  state.resolveCache = null;
  state.highlightedChannelId = subscription.id;
  state.expandedChannelId = subscription.id;
  await loadSubscriptions();
  requestAnimationFrame(() => {
    const element = document.getElementById(`channel-${subscription.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  renderStatus(`Subscribed to ${subscription.name}.`);
}

function normalizeNumber(value) {
  return value === '' ? null : Number(value);
}

async function saveAppSettings() {
  const form = els.appSettingsForm;
  const payload = {
    includeShortsDefault: form.includeShortsDefault.checked,
    minVideoLengthSecondsDefault: normalizeNumber(form.minVideoLengthSecondsDefault.value),
    maxVideoLengthSecondsDefault: normalizeNumber(form.maxVideoLengthSecondsDefault.value),
    keepAfterWatchedDefault: form.keepAfterWatchedDefault.checked,
    unwatchedRetentionDaysDefault: Number(form.unwatchedRetentionDaysDefault.value || 30),
    searchResultLimitDefault: Number(form.searchResultLimitDefault.value || 10),
    podcastTitleKeywordsDefault: form.podcastTitleKeywordsDefault.value,
    podcastMinLengthSecondsDefault: normalizeNumber(form.podcastMinLengthSecondsDefault.value),
    podcastMaxLengthSecondsDefault: normalizeNumber(form.podcastMaxLengthSecondsDefault.value),
    pauseDownloadsThresholdDefault: normalizeNumber(form.pauseDownloadsThresholdDefault.value),
  };

  state.appSettings = await api('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  renderStatus('App defaults saved.');
  render();
}

els.smartInput.addEventListener('input', () => {
  state.query = els.smartInput.value;
  state.topBarMode = inferMode(state.query);
  if (state.topBarMode !== 'results') state.resolveCache = null;
  renderTopBar();
});

els.primaryAction.addEventListener('click', async () => {
  if (state.topBarMode === 'search' || state.topBarMode === 'idle') {
    await searchFromInput();
    return;
  }
  await subscribeFromInput();
});

els.refreshSubscriptions.addEventListener('click', loadSubscriptions);
els.backToSubscriptions.addEventListener('click', () => {
  state.topBarMode = inferMode(state.query);
  state.searchResults = [];
  render();
});
els.navSubscriptions.addEventListener('click', () => switchPage('subscriptions'));
els.navSettings.addEventListener('click', () => switchPage('settings'));
els.saveSettings.addEventListener('click', saveAppSettings);

document.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && document.activeElement === els.smartInput) {
    event.preventDefault();
    if (state.topBarMode === 'search' || state.topBarMode === 'idle') await searchFromInput();
    else await subscribeFromInput();
  }
});

loadSubscriptions().catch((error) => {
  renderStatus(error.message);
});
