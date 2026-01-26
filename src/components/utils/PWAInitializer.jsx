import React, { useEffect } from "react";

// PWA Injector Component
// This component attempts to inject the manifest link and register the SW
// It is a workaround since we cannot edit index.html directly in this environment.

export default function PWAInitializer() {
  useEffect(() => {
    // 1. Inject Manifest Link
    const linkId = 'flowup-manifest';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // 2. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  return null;
}