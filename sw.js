self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || 'BotaniQ', { body: data.body, icon: '/img/favicon.png', data: { url: data.url || '/tasks.html' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
