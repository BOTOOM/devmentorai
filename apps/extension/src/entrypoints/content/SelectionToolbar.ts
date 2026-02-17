/**
 * Selection Toolbar Component
 * Quick action toolbar that appears when text is selected
 */

let toolbarContainer: HTMLDivElement | null = null;

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'explain', label: '💡', icon: 'lightbulb', tooltip: 'Explain' },
  { id: 'translate', label: '🌐', icon: 'globe', tooltip: 'Translate' },
  { id: 'rewrite', label: '✏️', icon: 'edit', tooltip: 'Rewrite' },
  { id: 'fix_grammar', label: '📝', icon: 'spellcheck', tooltip: 'Fix Grammar' },
  { id: 'summarize', label: '📄', icon: 'summary', tooltip: 'Summarize' },
];

export function createSelectionToolbar(
  x: number,
  y: number,
  selectedText: string,
  onAction: (action: string) => void
) {
  removeSelectionToolbar();

  // Create shadow host for style isolation
  toolbarContainer = document.createElement('div');
  toolbarContainer.id = 'devmentorai-selection-toolbar';
  toolbarContainer.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const shadow = toolbarContainer.attachShadow({ mode: 'closed' });

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    .toolbar {
      display: flex;
      gap: 4px;
      padding: 6px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.05);
      animation: fadeIn 0.15s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* C.6 - Smaller icon buttons */
    .action-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, transform 0.15s;
      position: relative;
    }
    
    .action-btn:hover {
      background: #f3f4f6;
      transform: scale(1.05);
    }
    
    .action-btn:active {
      transform: scale(0.95);
    }
    
    .action-btn .tooltip {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 8px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s, visibility 0.15s;
      pointer-events: none;
    }
    
    .action-btn:hover .tooltip {
      opacity: 1;
      visibility: visible;
    }
    
    .divider {
      width: 1px;
      background: #e5e7eb;
      margin: 4px 2px;
    }
    
    .more-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      color: white;
    }
    
    .more-btn:hover {
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
    }
    
    /* C.5 - Enhanced tone submenu */
    .tone-container {
      position: relative;
    }
    
    .tone-menu {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      padding: 6px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      display: none;
      min-width: 150px;
      z-index: 100;
    }
    
    .tone-menu.drop-down {
      bottom: auto;
      top: calc(100% + 8px);
    }
    
    .tone-menu.visible {
      display: block;
      animation: slideUp 0.15s ease-out;
    }
    
    .tone-menu.drop-down.visible {
      animation: slideDown 0.15s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .tone-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      border-radius: 6px;
      color: #374151;
      transition: background 0.1s;
    }
    
    .tone-item:hover {
      background: #f3f4f6;
    }
    
    .tone-item .emoji {
      font-size: 14px;
    }
  `;

  // Create toolbar element
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  // Add action buttons
  QUICK_ACTIONS.forEach((action) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = action.label;

    const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.textContent = action.tooltip;
    btn.appendChild(tooltip);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction(action.id);
    });
    toolbar.appendChild(btn);
  });

  // Add divider
  const divider = document.createElement('div');
  divider.className = 'divider';
  toolbar.appendChild(divider);

  // C.5 - Enhanced tone menu with submenu
  const toneContainer = document.createElement('div');
  toneContainer.className = 'tone-container';

  const toneBtn = document.createElement('button');
  toneBtn.className = 'action-btn';
  toneBtn.textContent = '🎨';
  const toneTooltip = document.createElement('span');
  toneTooltip.className = 'tooltip';
  toneTooltip.textContent = 'Change Tone';
  toneBtn.appendChild(toneTooltip);

  const toneMenu = document.createElement('div');
  toneMenu.className = 'tone-menu';

  const tones = [
    { id: 'formal', emoji: '👔', label: 'Formal' },
    { id: 'casual', emoji: '😊', label: 'Casual' },
    { id: 'technical', emoji: '⚙️', label: 'Technical' },
    { id: 'friendly', emoji: '🤝', label: 'Friendly' },
    { id: 'professional', emoji: '💼', label: 'Professional' },
    { id: 'concise', emoji: '📝', label: 'Concise' },
  ];

  tones.forEach((tone) => {
    const item = document.createElement('button');
    item.className = 'tone-item';

    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = tone.emoji;
    item.appendChild(emoji);
    item.appendChild(document.createTextNode(` ${tone.label}`));
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction(`rewrite_${tone.id}`);
    });
    toneMenu.appendChild(item);
  });

  toneBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isVisible = toneMenu.classList.contains('visible');
    
    if (!isVisible) {
      // Decide direction: check if there's enough space above the toolbar
      const btnRect = toneBtn.getBoundingClientRect();
      const menuHeight = 280; // approximate height of 6 tone items
      const spaceAbove = btnRect.top;
      
      if (spaceAbove < menuHeight) {
        toneMenu.classList.add('drop-down');
      } else {
        toneMenu.classList.remove('drop-down');
      }
    }
    
    toneMenu.classList.toggle('visible');
    
    // Only add close handler when opening the menu
    if (!isVisible) {
      setTimeout(() => {
        const closeHandler = (event: Event) => {
          if (!toneMenu.contains(event.target as Node) && !toneBtn.contains(event.target as Node)) {
            toneMenu.classList.remove('visible');
            document.removeEventListener('click', closeHandler);
          }
        };
        document.addEventListener('click', closeHandler);
      }, 0);
    }
  });

  toneContainer.appendChild(toneBtn);
  toneContainer.appendChild(toneMenu);
  toolbar.appendChild(toneContainer);

  // Add "Open Chat" button
  const chatBtn = document.createElement('button');
  chatBtn.className = 'action-btn more-btn';
  chatBtn.textContent = '💬';
  const chatTooltip = document.createElement('span');
  chatTooltip.className = 'tooltip';
  chatTooltip.textContent = 'Open Chat';
  chatBtn.appendChild(chatTooltip);
  chatBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ 
      type: 'OPEN_SIDE_PANEL_WITH_TEXT',
      selectedText 
    });
    removeSelectionToolbar();
  });
  toolbar.appendChild(chatBtn);

  shadow.appendChild(styles);
  shadow.appendChild(toolbar);
  document.body.appendChild(toolbarContainer);

  // Position toolbar
  positionToolbar(x, y);
}

export function removeSelectionToolbar() {
  if (toolbarContainer) {
    toolbarContainer.remove();
    toolbarContainer = null;
  }
}

function positionToolbar(x: number, y: number) {
  if (!toolbarContainer) return;

  // Get toolbar dimensions (approximate)
  const toolbarWidth = 320;
  const toolbarHeight = 48;

  // Calculate position (center above selection)
  let left = x - toolbarWidth / 2;
  let top = y - toolbarHeight - 12;

  // Ensure toolbar stays within viewport
  const padding = 10;
  const maxX = window.innerWidth - toolbarWidth - padding;
  const maxY = window.innerHeight - toolbarHeight - padding;

  left = Math.max(padding, Math.min(left, maxX));
  top = Math.max(padding, Math.min(top, maxY));

  // If no room above, show below
  if (top < padding) {
    top = y + 20;
  }

  toolbarContainer.style.left = `${left}px`;
  toolbarContainer.style.top = `${top}px`;
}
