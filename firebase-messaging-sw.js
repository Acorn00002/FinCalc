// FCM Web Push 서비스워커 — 반드시 사이트 루트(/firebase-messaging-sw.js)에 있어야
// 기본 scope('/')로 등록되어 앱 전체에서 오는 백그라운드 푸시를 받을 수 있다.
// 페이지의 JS와는 별개의 전역 컨텍스트라, 여기서 다시 한 번 initializeApp이 필요하다.
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww",
  authDomain: "asset-filot.firebaseapp.com",
  projectId: "asset-filot",
  storageBucket: "asset-filot.firebasestorage.app",
  messagingSenderId: "862512786797",
  appId: "1:862512786797:web:7ee42935258c645a2fbe64"
});

const messaging = firebase.messaging();

// 앱이 백그라운드(다른 탭/최소화)일 때 도착한 메시지를 OS 알림으로 직접 띄운다.
// 앱이 포그라운드일 때는 index.html의 onMessage 핸들러가 대신 처리(알림함 배지 갱신 등)한다.
messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || "자산 파일럿";
  const body = (payload.notification && payload.notification.body) || "";
  const link = (payload.data && payload.data.link) || "/";

  self.registration.showNotification(title, {
    body: body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { link: link }
  });
});

// 알림을 클릭하면 딥링크 경로로 이동(이미 열려있는 탭이 있으면 그 탭을 포커스)
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
