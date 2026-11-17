/**
 * Generates a deterministic device/browser fingerprint hash (SHA-256)
 * so Incognito windows on the same device share the weekly Priority quota.
 */

let cachedFingerprintPromise = null;

function fallbackHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  );
}

function getCanvasSignature() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(12, 8, 90, 22);
    ctx.fillStyle = '#069';
    ctx.fillText('FRENGP-NAS-FP-2026', 6, 10);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('FRENGP-NAS-FP-2026', 8, 12);
    return canvas.toDataURL();
  } catch (_) {
    return 'canvas-err';
  }
}

function getWebGLSignature() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return `${gl.getParameter(gl.VENDOR)}|${gl.getParameter(gl.RENDERER)}`;
    }
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return `${vendor}|${renderer}`;
  } catch (_) {
    return 'webgl-err';
  }
}

async function computeFingerprint() {
  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    Array.isArray(navigator.languages) ? navigator.languages.join(',') : '',
    navigator.platform || '',
    String(navigator.hardwareConcurrency || ''),
    String(navigator.deviceMemory || ''),
    String(navigator.maxTouchPoints || ''),
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`,
    `${window.screen.availWidth}x${window.screen.availHeight}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    getWebGLSignature(),
    getCanvasSignature(),
  ];

  const raw = parts.join('||');

  try {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(raw);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}

  return fallbackHash(raw);
}

export function getDeviceFingerprint() {
  if (!cachedFingerprintPromise) {
    cachedFingerprintPromise = computeFingerprint();
  }
  return cachedFingerprintPromise;
}
