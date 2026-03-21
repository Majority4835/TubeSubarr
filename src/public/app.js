const subscriptionsEl = document.getElementById('subscriptions');
const videosEl = document.getElementById('videos');
const userCheckboxes = document.getElementById('user-checkboxes');
const form = document.getElementById('subscription-form');

async function fetchSubscriptions() {
  const response = await fetch('/subscriptions');
  const data = await response.json();
  userCheckboxes.innerHTML = data.users.map((user) => `
    <label class="checkbox"><input type="checkbox" name="userIds" value="${user.id}" /> ${user.name}</label>
  `).join('');

  subscriptionsEl.innerHTML = data.subscriptions.map((channel) => `
    <article class="card">
      <div>
        <strong>${channel.name}</strong>
        <span class="badge ${channel.isActive ? 'active' : 'paused'}">${channel.isActive ? 'Active' : 'Paused'}</span>
      </div>
      <div class="muted">${channel.contentType} · ${channel.assignments.map((a) => a.user.name).join(', ')}</div>
      <div class="muted">Filter: ${channel.contentFilter} · Backlog: ${channel.backlogCount}</div>
      <button data-delete="${channel.id}">Unsubscribe</button>
    </article>
  `).join('') || '<p class="muted">No subscriptions yet.</p>';

  subscriptionsEl.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await fetch(`/subscriptions/${button.dataset.delete}`, { method: 'DELETE' });
      await refresh();
    });
  });
}

async function fetchVideos() {
  const response = await fetch('/videos');
  const videos = await response.json();
  videosEl.innerHTML = videos.map((video) => `
    <article class="card">
      <div>
        <strong>${video.title}</strong>
        <span class="badge ${video.isWatched ? 'active' : 'paused'}">${video.isWatched ? 'Watched' : 'New'}</span>
      </div>
      <div class="muted">${video.channel.name}</div>
      <div class="actions">
        <button data-pin="${video.id}">${video.isPinned ? 'Unpin' : 'Pin'}</button>
        <button data-watch="${video.id}">${video.isWatched ? 'Mark unplayed' : 'Mark watched'}</button>
      </div>
    </article>
  `).join('') || '<p class="muted">No videos downloaded yet.</p>';

  videosEl.querySelectorAll('[data-pin]').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('.card');
      const title = card.querySelector('strong')?.textContent;
      const current = button.textContent === 'Unpin';
      await fetch(`/videos/${button.dataset.pin}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !current }),
      });
      if (title) console.log(`Updated pin for ${title}`);
      await fetchVideos();
    });
  });

  videosEl.querySelectorAll('[data-watch]').forEach((button) => {
    button.addEventListener('click', async () => {
      const current = button.textContent === 'Mark unplayed';
      await fetch(`/videos/${button.dataset.watch}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWatched: !current }),
      });
      await fetchVideos();
    });
  });
}

async function refresh() {
  await Promise.all([fetchSubscriptions(), fetchVideos()]);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const userIds = formData.getAll('userIds');
  const payload = {
    name: formData.get('name'),
    url: formData.get('url'),
    contentType: formData.get('contentType'),
    contentFilter: formData.get('contentFilter'),
    backlogCount: Number(formData.get('backlogCount')),
    watchedPolicy: 'keep',
    watchedDelayHours: 0,
    unwatchedPolicy: 'delete_after_days',
    unwatchedDays: 30,
    keepIfPlaylisted: true,
    keepIfPinned: true,
    isActive: formData.get('isActive') === 'on',
    userIds,
  };

  await fetch('/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  form.reset();
  await refresh();
});

document.getElementById('refresh-subscriptions').addEventListener('click', fetchSubscriptions);
document.getElementById('refresh-videos').addEventListener('click', fetchVideos);
refresh();
