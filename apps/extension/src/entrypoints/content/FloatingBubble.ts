/**
 * Floating Bubble UI Component
 * A draggable bubble that opens the DevMentorAI side panel
 */

let bubbleContainer: HTMLDivElement | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

export function createFloatingBubble() {
  if (bubbleContainer) return;

  // Create shadow host for isolation
  bubbleContainer = document.createElement('div');
  bubbleContainer.id = 'devmentorai-floating-bubble';
  bubbleContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const shadow = bubbleContainer.attachShadow({ mode: 'closed' });

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    .bubble {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    }
    
    .bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5), 0 3px 6px rgba(0, 0, 0, 0.15);
    }
    
    .bubble:active {
      transform: scale(0.95);
    }
    
    .bubble.dragging {
      transform: scale(1.05);
      cursor: grabbing;
    }
    
    .bubble-icon {
      color: white;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    .bubble-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .bubble-badge svg {
      width: 12px;
      height: 12px;
      color: white;
    }
    
    .tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      pointer-events: none;
    }
    
    .bubble:hover .tooltip {
      opacity: 1;
      visibility: visible;
    }
  `;

  // Create bubble element
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `
    <span class="bubble-icon">D</span>
    <div class="bubble-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <div class="tooltip">DevMentorAI - Click to open</div>
  `;

  // Add event listeners
  bubble.addEventListener('click', handleBubbleClick);
  bubble.addEventListener('mousedown', handleMouseDown);

  shadow.appendChild(styles);
  shadow.appendChild(bubble);
  document.body.appendChild(bubbleContainer);

  // Add global mouse events for dragging
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Load saved position
  loadBubblePosition();
}

export function removeFloatingBubble() {
  if (bubbleContainer) {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    bubbleContainer.remove();
    bubbleContainer = null;
  }
}

function handleBubbleClick(e: MouseEvent) {
  if (isDragging) return;
  
  e.preventDefault();
  e.stopPropagation();

  // Open side panel
  chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return; // Only left click
  
  const bubble = e.currentTarget as HTMLElement;
  const rect = bubbleContainer!.getBoundingClientRect();
  
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  isDragging = false;
  
  // Set dragging after a small movement
  const startX = e.clientX;
  const startY = e.clientY;
  
  const checkDrag = (moveEvent: MouseEvent) => {
    const dx = Math.abs(moveEvent.clientX - startX);
    const dy = Math.abs(moveEvent.clientY - startY);
    
    if (dx > 5 || dy > 5) {
      isDragging = true;
      bubble.classList.add('dragging');
      document.removeEventListener('mousemove', checkDrag);
    }
  };
  
  document.addEventListener('mousemove', checkDrag);
  
  setTimeout(() => {
    document.removeEventListener('mousemove', checkDrag);
  }, 200);
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging || !bubbleContainer) return;
  
  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;
  
  // Constrain to viewport
  const maxX = window.innerWidth - 56;
  const maxY = window.innerHeight - 56;
  
  bubbleContainer.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
  bubbleContainer.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
  bubbleContainer.style.right = 'auto';
  bubbleContainer.style.bottom = 'auto';
}

function handleMouseUp() {
  if (isDragging && bubbleContainer) {
    const bubble = bubbleContainer.shadowRoot?.querySelector('.bubble');
    bubble?.classList.remove('dragging');
    
    // Save position
    saveBubblePosition();
  }
  
  setTimeout(() => {
    isDragging = false;
  }, 10);
}

function saveBubblePosition() {
  if (!bubbleContainer) return;
  
  const rect = bubbleContainer.getBoundingClientRect();
  chrome.storage.local.set({
    bubblePosition: {
      x: rect.left,
      y: rect.top,
    },
  });
}

async function loadBubblePosition() {
  try {
    const result = await chrome.storage.local.get(['bubblePosition']);
    if (result.bubblePosition && bubbleContainer) {
      bubbleContainer.style.left = `${result.bubblePosition.x}px`;
      bubbleContainer.style.top = `${result.bubblePosition.y}px`;
      bubbleContainer.style.right = 'auto';
      bubbleContainer.style.bottom = 'auto';
    }
  } catch (error) {
    // Use default position
  }
}
