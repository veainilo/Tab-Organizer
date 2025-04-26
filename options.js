// Default settings
let settings = {
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  groupByRootDomain: true,  // 按根域名分组
  ignoreTLD: true,          // 忽略顶级域名（如.com, .org等）
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// DOM elements
let autoGroupByDomainCheckbox;
let autoGroupOnCreationCheckbox;
let groupByRootDomainCheckbox;
let ignoreTLDCheckbox;  // 新增
let domainListElement;
let noDomainsElement;
let newDomainInput;
let addDomainButton;
let colorMappingsElement;
let addColorMappingButton;
let defaultColorSelect;
let saveSettingsButton;
let statusElement;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Get UI elements
  autoGroupByDomainCheckbox = document.getElementById('autoGroupByDomain');
  autoGroupOnCreationCheckbox = document.getElementById('autoGroupOnCreation');
  groupByRootDomainCheckbox = document.getElementById('groupByRootDomain');
  ignoreTLDCheckbox = document.getElementById('ignoreTLD');  // 新增
  domainListElement = document.getElementById('domainList');
  noDomainsElement = document.getElementById('noDomains');
  newDomainInput = document.getElementById('newDomain');
  addDomainButton = document.getElementById('addDomain');
  colorMappingsElement = document.getElementById('colorMappings');
  addColorMappingButton = document.getElementById('addColorMapping');
  defaultColorSelect = document.getElementById('defaultColor');
  saveSettingsButton = document.getElementById('saveSettings');
  statusElement = document.getElementById('status');

  // Load settings
  loadSettings();

  // Add event listeners
  addDomainButton.addEventListener('click', addExcludedDomain);
  addColorMappingButton.addEventListener('click', addColorMapping);
  saveSettingsButton.addEventListener('click', saveSettings);

  // Handle Enter key in domain input
  newDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addExcludedDomain();
    }
  });
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get('tabOrganizerSettings', (data) => {
    if (data.tabOrganizerSettings) {
      settings = data.tabOrganizerSettings;
    }

    // Update UI with loaded settings
    updateUI();
  });
}

// Update UI with current settings
function updateUI() {
  // Update checkboxes
  autoGroupByDomainCheckbox.checked = settings.autoGroupByDomain;
  autoGroupOnCreationCheckbox.checked = settings.autoGroupOnCreation;
  groupByRootDomainCheckbox.checked = settings.groupByRootDomain;
  ignoreTLDCheckbox.checked = settings.ignoreTLD;

  // Update excluded domains list
  updateDomainList();

  // Update color mappings
  updateColorMappings();

  // Set default color
  defaultColorSelect.value = settings.colorScheme['default'] || 'blue';
}

// Update the excluded domains list
function updateDomainList() {
  // Clear the list
  while (domainListElement.firstChild) {
    domainListElement.removeChild(domainListElement.firstChild);
  }

  if (settings.excludeDomains.length === 0) {
    domainListElement.appendChild(noDomainsElement);
    return;
  }

  // Add each domain to the list
  settings.excludeDomains.forEach(domain => {
    const domainItem = document.createElement('div');
    domainItem.className = 'domain-item';

    const domainText = document.createElement('span');
    domainText.textContent = domain;

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      removeDomain(domain);
    });

    domainItem.appendChild(domainText);
    domainItem.appendChild(removeButton);

    domainListElement.appendChild(domainItem);
  });
}

// Add a domain to the excluded list
function addExcludedDomain() {
  const domain = newDomainInput.value.trim();

  if (!domain) {
    showStatus('Please enter a domain', 'error');
    return;
  }

  // Check if domain is already in the list
  if (settings.excludeDomains.includes(domain)) {
    showStatus('Domain is already in the list', 'error');
    return;
  }

  // Add domain to the list
  settings.excludeDomains.push(domain);

  // Update UI
  updateDomainList();

  // Clear input
  newDomainInput.value = '';

  showStatus('Domain added', 'success');
}

// Remove a domain from the excluded list
function removeDomain(domain) {
  settings.excludeDomains = settings.excludeDomains.filter(d => d !== domain);

  // Update UI
  updateDomainList();

  showStatus('Domain removed', 'success');
}

// Update the color mappings UI
function updateColorMappings() {
  // Clear existing mappings (except default)
  const children = Array.from(colorMappingsElement.children);
  for (let i = 1; i < children.length; i++) {
    colorMappingsElement.removeChild(children[i]);
  }

  // Add each color mapping
  for (const domain in settings.colorScheme) {
    if (domain === 'default') continue;

    addColorMappingToUI(domain, settings.colorScheme[domain]);
  }
}

// Add a new color mapping
function addColorMapping() {
  addColorMappingToUI('', 'blue');
}

// Add a color mapping to the UI
function addColorMappingToUI(domain, color) {
  const colorItem = document.createElement('div');
  colorItem.className = 'color-item';

  const domainInput = document.createElement('input');
  domainInput.type = 'text';
  domainInput.value = domain;
  domainInput.placeholder = 'Enter domain (e.g., example.com)';

  const colorSelect = document.createElement('select');
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  colors.forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    option.textContent = c.charAt(0).toUpperCase() + c.slice(1);
    option.selected = c === color;
    colorSelect.appendChild(option);
  });

  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.style.backgroundColor = '#d83b01';
  removeButton.style.color = 'white';
  removeButton.style.border = 'none';
  removeButton.style.borderRadius = '3px';
  removeButton.style.padding = '3px 8px';
  removeButton.style.marginLeft = '10px';
  removeButton.style.cursor = 'pointer';

  removeButton.addEventListener('click', () => {
    colorMappingsElement.removeChild(colorItem);
  });

  colorItem.appendChild(domainInput);
  colorItem.appendChild(colorSelect);
  colorItem.appendChild(removeButton);

  colorMappingsElement.appendChild(colorItem);
}

// Save settings
function saveSettings() {
  // Get values from UI
  settings.autoGroupByDomain = autoGroupByDomainCheckbox.checked;
  settings.autoGroupOnCreation = autoGroupOnCreationCheckbox.checked;
  settings.groupByRootDomain = groupByRootDomainCheckbox.checked;
  settings.ignoreTLD = ignoreTLDCheckbox.checked;

  // Get default color
  settings.colorScheme['default'] = defaultColorSelect.value;

  // Get color mappings
  const colorItems = colorMappingsElement.querySelectorAll('.color-item');
  const newColorScheme = {
    'default': settings.colorScheme['default']
  };

  for (let i = 1; i < colorItems.length; i++) {
    const domainInput = colorItems[i].querySelector('input');
    const colorSelect = colorItems[i].querySelector('select');

    const domain = domainInput.value.trim();

    if (domain) {
      newColorScheme[domain] = colorSelect.value;
    }
  }

  settings.colorScheme = newColorScheme;

  // Save to storage
  chrome.storage.sync.set({ tabOrganizerSettings: settings }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('Settings saved successfully!', 'success');
    }
  });
}

// Show status message
function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = 'status';

  if (type === 'success') {
    statusElement.classList.add('success');
  } else if (type === 'error') {
    statusElement.classList.add('error');
  }

  statusElement.style.display = 'block';

  // Hide status after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}
