/* service-worker.js - 离线缓存（stale-while-revalidate 策略）*/
var CACHE = 'pain-quiz-v1';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './q1.js',
  './q2.js',
  './q3.js',
  './q4.js',
  './q5.js',
  './manifest.json',
  './icon.jpg'
];

/* 安装：预缓存全部资源 */
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

/* 激活：清理旧缓存 */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 请求：优先返回缓存（快），后台静默更新（保证下次拿到最新）*/
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      var fetchPromise = fetch(e.request).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        return resp;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
