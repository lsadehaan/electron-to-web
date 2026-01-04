/**
 * Renderer Process - UI Logic
 */

// State
let snippets = [];
let currentSnippet = null;
let filteredSnippets = [];

// DOM Elements
const elements = {
  // Lists
  snippetList: document.getElementById('snippetList'),
  searchInput: document.getElementById('searchInput'),

  // Editor
  emptyState: document.getElementById('emptyState'),
  editorView: document.getElementById('editorView'),
  snippetTitle: document.getElementById('snippetTitle'),
  snippetLanguage: document.getElementById('snippetLanguage'),
  snippetTags: document.getElementById('snippetTags'),
  snippetDescription: document.getElementById('snippetDescription'),
  snippetCode: document.getElementById('snippetCode'),
  createdDate: document.getElementById('createdDate'),
  updatedDate: document.getElementById('updatedDate'),

  // Buttons
  newSnippetBtn: document.getElementById('newSnippetBtn'),
  saveBtn: document.getElementById('saveBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  copyBtn: document.getElementById('copyBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  openFolderBtn: document.getElementById('openFolderBtn'),

  // Footer
  appInfo: document.getElementById('appInfo'),
  docsLink: document.getElementById('docsLink'),
  githubLink: document.getElementById('githubLink')
};

// ============================================
// Initialize App
// ============================================

async function init() {
  await loadSnippets();
  await loadAppInfo();
  setupEventListeners();
}

// ============================================
// Data Loading
// ============================================

async function loadSnippets() {
  const result = await window.snippetAPI.getAllSnippets();

  if (result.success) {
    snippets = result.snippets.sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    filteredSnippets = [...snippets];
    renderSnippetList();
  } else {
    console.error('Failed to load snippets:', result.error);
  }
}

async function loadAppInfo() {
  const info = await window.snippetAPI.getAppInfo();
  elements.appInfo.innerHTML = `
    <span>v${info.version}</span>
    <span>📁 ${info.snippetsPath}</span>
  `;
}

// ============================================
// Rendering
// ============================================

function renderSnippetList() {
  if (filteredSnippets.length === 0) {
    elements.snippetList.innerHTML = `
      <div class="empty-state">
        <p>${snippets.length === 0 ? 'No snippets yet' : 'No matching snippets'}</p>
        <p class="hint">${snippets.length === 0 ? 'Click "New Snippet" to create one' : 'Try a different search'}</p>
      </div>
    `;
    return;
  }

  elements.snippetList.innerHTML = filteredSnippets.map(snippet => `
    <div class="snippet-item ${currentSnippet?.id === snippet.id ? 'active' : ''}"
         data-id="${snippet.id}">
      <div class="snippet-item-title">${escapeHtml(snippet.title)}</div>
      <div class="snippet-item-language">${snippet.language}</div>
      ${snippet.tags && snippet.tags.length > 0 ? `
        <div class="snippet-item-tags">${snippet.tags.map(tag => `#${tag}`).join(' ')}</div>
      ` : ''}
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.snippet-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      loadSnippet(id);
    });
  });
}

function showEditor() {
  elements.emptyState.style.display = 'none';
  elements.editorView.style.display = 'flex';
}

function hideEditor() {
  elements.emptyState.style.display = 'flex';
  elements.editorView.style.display = 'none';
  currentSnippet = null;
}

function renderSnippet(snippet) {
  elements.snippetTitle.value = snippet.title || '';
  elements.snippetLanguage.value = snippet.language || 'javascript';
  elements.snippetTags.value = (snippet.tags || []).join(', ');
  elements.snippetDescription.value = snippet.description || '';
  elements.snippetCode.value = snippet.code || '';

  if (snippet.createdAt) {
    elements.createdDate.textContent = `Created: ${formatDate(snippet.createdAt)}`;
  }
  if (snippet.updatedAt) {
    elements.updatedDate.textContent = `Updated: ${formatDate(snippet.updatedAt)}`;
  }

  showEditor();
}

// ============================================
// Snippet Operations
// ============================================

async function loadSnippet(id) {
  const result = await window.snippetAPI.getSnippet(id);

  if (result.success) {
    currentSnippet = result.snippet;
    renderSnippet(currentSnippet);
    renderSnippetList(); // Update active state
  } else {
    alert('Failed to load snippet: ' + result.error);
  }
}

async function saveSnippet() {
  const snippet = {
    id: currentSnippet?.id,
    title: elements.snippetTitle.value.trim() || 'Untitled Snippet',
    language: elements.snippetLanguage.value,
    tags: elements.snippetTags.value.split(',').map(t => t.trim()).filter(Boolean),
    description: elements.snippetDescription.value.trim(),
    code: elements.snippetCode.value,
    createdAt: currentSnippet?.createdAt
  };

  const result = await window.snippetAPI.saveSnippet(snippet);

  if (result.success) {
    currentSnippet = result.snippet;
    await loadSnippets();
    renderSnippet(currentSnippet);
    renderSnippetList();
  } else {
    alert('Failed to save snippet: ' + result.error);
  }
}

async function deleteSnippet() {
  if (!currentSnippet) return;

  if (!confirm(`Delete "${currentSnippet.title}"?`)) return;

  const result = await window.snippetAPI.deleteSnippet(currentSnippet.id);

  if (result.success) {
    hideEditor();
    await loadSnippets();
  } else {
    alert('Failed to delete snippet: ' + result.error);
  }
}

function newSnippet() {
  currentSnippet = null;
  renderSnippet({
    title: '',
    language: 'javascript',
    tags: [],
    description: '',
    code: ''
  });
  elements.snippetTitle.focus();
}

// ============================================
// Native API Operations
// ============================================

async function copyCode() {
  const code = elements.snippetCode.value;

  if (!code) {
    alert('No code to copy');
    return;
  }

  const result = await window.snippetAPI.copyToClipboard(code);

  if (!result.success) {
    alert('Failed to copy: ' + result.error);
  }
  // Notification is shown by main process
}

async function exportSnippet() {
  if (!currentSnippet) {
    alert('No snippet to export');
    return;
  }

  const defaultName = `${currentSnippet.title.replace(/[^a-z0-9]/gi, '_')}.json`;
  const dialogResult = await window.snippetAPI.saveFileDialog(defaultName);

  if (dialogResult.canceled) return;

  if (dialogResult.success) {
    const result = await window.snippetAPI.exportSnippet(currentSnippet, dialogResult.filePath);

    if (!result.success) {
      alert('Failed to export: ' + result.error);
    }
    // Notification is shown by main process
  }
}

async function importSnippet() {
  const dialogResult = await window.snippetAPI.openFileDialog();

  if (dialogResult.canceled) return;

  if (dialogResult.success && dialogResult.filePaths.length > 0) {
    for (const filePath of dialogResult.filePaths) {
      const result = await window.snippetAPI.importSnippet(filePath);

      if (!result.success) {
        alert(`Failed to import ${filePath}: ${result.error}`);
      }
    }

    await loadSnippets();
    // Notification is shown by main process
  }
}

async function openSnippetsFolder() {
  const result = await window.snippetAPI.openSnippetsFolder();

  if (!result.success) {
    alert('Failed to open folder: ' + result.error);
  }
}

async function openDocsLink(e) {
  e.preventDefault();
  await window.snippetAPI.openExternal('https://github.com/lsadehaan/electron-to-web');
}

async function openGithubLink(e) {
  e.preventDefault();
  await window.snippetAPI.openExternal('https://github.com/lsadehaan/electron-to-web');
}

// ============================================
// Event Handlers
// ============================================

function setupEventListeners() {
  // Buttons
  elements.newSnippetBtn.addEventListener('click', newSnippet);
  elements.saveBtn.addEventListener('click', saveSnippet);
  elements.deleteBtn.addEventListener('click', deleteSnippet);
  elements.copyBtn.addEventListener('click', copyCode);
  elements.exportBtn.addEventListener('click', exportSnippet);
  elements.importBtn.addEventListener('click', importSnippet);
  elements.openFolderBtn.addEventListener('click', openSnippetsFolder);

  // Footer links
  elements.docsLink.addEventListener('click', openDocsLink);
  elements.githubLink.addEventListener('click', openGithubLink);

  // Search
  elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (!query) {
      filteredSnippets = [...snippets];
    } else {
      filteredSnippets = snippets.filter(snippet =>
        snippet.title.toLowerCase().includes(query) ||
        snippet.description.toLowerCase().includes(query) ||
        snippet.code.toLowerCase().includes(query) ||
        (snippet.tags && snippet.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    renderSnippetList();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentSnippet !== null || elements.editorView.style.display !== 'none') {
        saveSnippet();
      }
    }

    // Ctrl/Cmd + N = New snippet
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      newSnippet();
    }

    // Ctrl/Cmd + K = Copy code
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      copyCode();
    }
  });
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// ============================================
// Start App
// ============================================

init();
