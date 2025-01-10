(() => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    cursor: crosshair;
  `;

  const selection = document.createElement('div');
  selection.style.cssText = `
    position: fixed;
    border: 1px solid blue;
    background: rgba(0, 0, 255, 0.05);
    display: none;
    z-index: 10000;
    pointer-events: none;  /* Make selection div non-interactive */
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(selection);

  let isSelecting = false;
  let startX, startY;

  overlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.display = 'block';
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
  });

  document.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = selection.getBoundingClientRect();

	// Request zoom level from background script
    const zoomLevel = window.devicePixelRatio; // doesn't work on high-DPI devices like those with Retina displays
    
    // Convert screen coordinates to page coordinates
    const area = {
      left: Math.round(rect.left * zoomLevel),
      top: Math.round(rect.top * zoomLevel),
      width: Math.round(rect.width * zoomLevel),
      height: Math.round(rect.height * zoomLevel)
    };

	
    overlay.remove();
    selection.remove();

    chrome.runtime.sendMessage({
      action: "captureScreenshot",
      area: area
    });
  });
})();
