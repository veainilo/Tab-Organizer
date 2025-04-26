// Default settings
let settings = {
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// Define constant for ungrouped tabs
const TAB_GROUP_ID_NONE = -1;

// Load settings when extension starts
chrome.storage.sync.get('tabOrganizerSettings', (data) => {
  if (data.tabOrganizerSettings) {
    settings = data.tabOrganizerSettings;
  }
});

// Listen for changes to settings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.tabOrganizerSettings) {
    settings = changes.tabOrganizerSettings.newValue;
  }
});

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return '';
  }
}

// Group tabs by domain
async function groupTabsByDomain() {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Group tabs by domain
    const domainGroups = {};

    tabs.forEach(tab => {
      if (!tab.url) return;

      const domain = extractDomain(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) return;

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push(tab.id);
    });

    // Create or update groups
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];

      // Skip if only one tab for this domain
      if (tabIds.length < 2) continue;

      // Check if any of these tabs are already in a group with the same domain
      let existingGroupId = null;

      for (const tabId of tabIds) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            existingGroupId = tab.groupId;
            break;
          }
        }
      }

      if (existingGroupId) {
        // Add tabs to existing group
        await chrome.tabs.group({ tabIds, groupId: existingGroupId });
      } else {
        // Create new group
        const groupId = await chrome.tabs.group({ tabIds });

        // Set group title and color
        const color = settings.colorScheme[domain] || settings.colorScheme['default'] || 'blue';
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
      }
    }
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
  }
}

// Handle tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!settings.autoGroupOnCreation) return;

  // Wait a moment for the tab to load
  setTimeout(async () => {
    try {
      // Get updated tab info
      const updatedTab = await chrome.tabs.get(tab.id);

      if (!updatedTab.url) return;

      const domain = extractDomain(updatedTab.url);
      if (!domain || settings.excludeDomains.includes(domain)) return;

      // Find existing group with this domain
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let existingGroupId = null;

      for (const t of tabs) {
        if (t.id === tab.id) continue;
        if (t.groupId && t.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(t.groupId);
          if (group.title === domain) {
            existingGroupId = t.groupId;
            break;
          }
        }
      }

      if (existingGroupId) {
        // Add tab to existing group
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroupId });
      } else {
        // Check if there are other tabs with the same domain
        const sameDomainTabs = tabs.filter(t =>
          t.id !== tab.id &&
          t.url &&
          extractDomain(t.url) === domain
        );

        if (sameDomainTabs.length > 0) {
          // Create new group with all tabs of this domain
          const tabIds = [tab.id, ...sameDomainTabs.map(t => t.id)];
          const groupId = await chrome.tabs.group({ tabIds });

          // Set group title and color
          const color = settings.colorScheme[domain] || settings.colorScheme['default'] || 'blue';
          await chrome.tabGroups.update(groupId, {
            title: domain,
            color: color
          });
        }
      }
    } catch (error) {
      console.error('Error handling new tab:', error);
    }
  }, 1000); // Wait 1 second for the tab to load
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!settings.autoGroupByDomain) return;
  if (!changeInfo.url) return;

  // Wait a moment for the tab to fully update
  setTimeout(async () => {
    try {
      const domain = extractDomain(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) {
        // If tab is in a group, remove it
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          await chrome.tabs.ungroup(tabId);
        }
        return;
      }

      // Find existing group with this domain
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let existingGroupId = null;

      for (const t of tabs) {
        if (t.id === tabId) continue;
        if (t.groupId && t.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(t.groupId);
          if (group.title === domain) {
            existingGroupId = t.groupId;
            break;
          }
        }
      }

      // If tab is already in the correct group, do nothing
      if (tab.groupId === existingGroupId) return;

      // If tab is in a different group, remove it
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tabId);
      }

      if (existingGroupId) {
        // Add tab to existing group
        await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId });
      } else {
        // Check if there are other tabs with the same domain
        const sameDomainTabs = tabs.filter(t =>
          t.id !== tabId &&
          t.url &&
          extractDomain(t.url) === domain
        );

        if (sameDomainTabs.length > 0) {
          // Create new group with all tabs of this domain
          const tabIds = [tabId, ...sameDomainTabs.map(t => t.id)];
          const groupId = await chrome.tabs.group({ tabIds });

          // Set group title and color
          const color = settings.colorScheme[domain] || settings.colorScheme['default'] || 'blue';
          await chrome.tabGroups.update(groupId, {
            title: domain,
            color: color
          });
        }
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }, 500); // Wait 0.5 seconds for the tab to fully update
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'groupByDomain') {
    groupTabsByDomain().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error in groupByDomain:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates async response
  }

  if (message.action === 'ungroupAll') {
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      try {
        for (const tab of tabs) {
          if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
            await chrome.tabs.ungroup(tab.id);
          }
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error in ungroupAll:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Indicates async response
  }
});
