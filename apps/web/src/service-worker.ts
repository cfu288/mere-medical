/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
// <reference lib="webworker" />
import { precacheAndRoute, addPlugins } from 'workbox-precaching';
import { BroadcastUpdatePlugin } from 'workbox-broadcast-update';
import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { pageCache, imageCache, staticResourceCache } from 'workbox-recipes';

// ServiceWorkerGlobalScope is a type from the workbox-precaching module
declare const self: Window & ServiceWorkerGlobalScope;

addPlugins([new BroadcastUpdatePlugin()]);

/**
 * Setting up pre-caching
 */

setCacheNameDetails({
  prefix: 'MereMedical',
  suffix: 'v1',
});

// Download and cache all the files webpack created
// https://developer.chrome.com/docs/workbox/precaching-with-workbox/#precaching-with-injectmanifest
const precacheManifest = [].concat((self.__WB_MANIFEST as []) || []);
precacheAndRoute(precacheManifest);

// Tells the Service Worker to skip the waiting state and become active.
self.skipWaiting();

// Will make the Service Worker control the all clients right away
// (even if they're controlling other tabs or windows). Without this,
// we could be seeing different versions in different tabs or windows.
clientsClaim();

/**
 * Setting up runtime caching - independent of the previous pre-cache step but uses it if it's available
 */

pageCache();
staticResourceCache();
imageCache();

console.log('Service worker ready');
