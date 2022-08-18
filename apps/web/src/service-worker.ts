/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { setCacheNameDetails } from 'workbox-core';

// ServiceWorkerGlobalScope is a type from the workbox-precaching module
declare const self: Window & ServiceWorkerGlobalScope;

setCacheNameDetails({
  prefix: 'MariMedical',
  suffix: 'v1',
});

// Tells the Service Worker to skip the waiting state and become active.
self.skipWaiting();

// Will make the Service Worker control the all clients right away
// (even if they're controlling other tabs or windows). Without this,
// we could be seeing different versions in different tabs or windows.
clientsClaim();

// Download and cache all the files webpack created
const precacheManifest = [].concat((self.__WB_MANIFEST as any) || []);
precacheAndRoute(precacheManifest);
