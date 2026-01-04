/**
 * Renderer Wrapper - Waits for API to be ready before initializing
 */

function waitForAPI() {
  if (window.snippetAPI) {
    console.log('API already available, loading renderer');
    loadRenderer();
  } else {
    console.log('Waiting for API...');
    window.addEventListener('snippetAPIReady', () => {
      console.log('API ready event received, loading renderer');
      loadRenderer();
    });
  }
}

function loadRenderer() {
  // Load the actual renderer script
  const script = document.createElement('script');
  script.src = 'renderer.js';
  script.onload = () => console.log('✅ Renderer loaded');
  script.onerror = (e) => console.error('❌ Failed to load renderer:', e);
  document.body.appendChild(script);
}

waitForAPI();
