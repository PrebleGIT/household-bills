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

  const badgeCount = typeof data.badgeCount === "number" ? data.badgeCount : null;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (badgeCount !== null && "setAppBadge" in self.registration) {
        try {
          if (badgeCount > 0) {
            await self.registration.setAppBadge(badgeCount);
          } else {
            await self.registration.clearAppBadge();
          }
        } catch (e) {
          // Badge API not supported in this context — safe to ignore.
        }
      }
    })()
  );
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
