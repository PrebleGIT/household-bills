self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Bills", body: event.data ? event.data.text() : "You have a bill due." };
  }

  const title = data.title || "Bills";
  const options = {
    body: data.body || "A bill is due.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  // Deliberately not touching the app badge here. The app already updates it
  // in the foreground every time it's opened, and there's a documented Apple
  // bug where setting/clearing the badge in the same moment a notification
  // is shown can cause the notification to disappear almost immediately.
  // Touching the badge and showing a notification in the same push event
  // was doing exactly that, so this only shows the notification now.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
