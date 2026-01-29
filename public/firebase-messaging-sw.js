// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyBJ2q-5IKqomRzIF0X4LmVYhJJyYSXlABM",
    authDomain: "nust-market-5b7c7.firebaseapp.com",
    projectId: "nust-market-5b7c7",
    storageBucket: "nust-market-5b7c7.firebasestorage.app",
    messagingSenderId: "353984015464",
    appId: "1:353984015464:web:6d77f25ffe62d674339fdd"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here (optional, FCM usually handles this automatically if 'notification' key is present)
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png',
        data: payload.data // Pass URL/chatId data to notification
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event);
    event.notification.close();

    // Deep Link Logic
    // If we have a URL in data, open it.
    // If tab is already open, focus it.

    // NOTE: In the previous step we put 'url' in the data payload.
    // The payload structure from FCM might put data in event.notification.data or event.action
    // But standard Web Push often needs us to parse it.
    // However, Firebase FCM usually handles 'click_action' automatically if provided in notification payload?
    // We removed 'click_action' in favor of manual handling to support deep links more robustly across browsers.
    // Let's see where the data is. It's usually in event.notification.data if we passed it to showNotification.
    // BUT we need to ensure showNotification received it!
    // In onBackgroundMessage above, we did NOT pass 'data' to showNotification options.
    // We need to fix onBackgroundMessage first to pass data.

    // Let's assume onBackgroundMessage is updated in this same file (it is, see lines 23-33).
    // Wait, I need to update line 27-30 first to include data?
    // Actually, I can do it all in one replace or separate.
    // Let's implement the click handler first.

    // We need to get the URL.
    // If we passed data to showNotification, it's in event.notification.data
    // Let's try to assume it's there.

    const urlToOpen = event.notification.data ? event.notification.data.url : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Check if there is already a window/tab open with the target URL
            // For simplicity, just check if ANY window of our origin is open and focus it + navigate
            // OR open new if none.

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Check if it's our app
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    // Focus it
                    // And navigate to the deep link
                    if (urlToOpen && client.navigate) {
                        return client.focus().then(c => c.navigate(urlToOpen));
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
