// Define constants
const TAB_GROUP_ID_NONE = -1;
const WINDOW_ID_CURRENT = -2;

// Helper function to get localized message
function getMessage(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Get UI elements
  const groupByDomainButton = document.getElementById('groupByDomain');
  const ungroupAllButton = document.getElementById('ungroupAll');
  const statusElement = document.getElementById('status');
  const groupListElement = document.getElementById('groupList');
  const noGroupsElement = document.getElementById('noGroups');

  // Load current tab groups
  loadTabGroups();

  // Add event listeners
  groupByDomainButton.addEventListener('click', () => {
    showStatus(getMessage('groupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'groupByDomain' }, (response) => {
      if (response.success) {
        showStatus(getMessage('tabsGrouped'), 'success');
        loadTabGroups();
      } else {
        showStatus(getMessage('errorGroupingTabs', [response.error || 'Unknown error']), 'error');
      }
    });
  });

  ungroupAllButton.addEventListener('click', () => {
    showStatus(getMessage('ungroupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'ungroupAll' }, (response) => {
      if (response.success) {
        showStatus(getMessage('tabsUngrouped'), 'success');
        loadTabGroups();
      } else {
        showStatus(getMessage('errorUngroupingTabs', [response.error || 'Unknown error']), 'error');
      }
    });
  });

  // Function to show status messages
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

  // Function to load and display current tab groups
  async function loadTabGroups() {
    try {
      // Get all tab groups in the current window
      const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });

      // Clear the group list
      while (groupListElement.firstChild) {
        groupListElement.removeChild(groupListElement.firstChild);
      }

      if (groups.length === 0) {
        groupListElement.appendChild(noGroupsElement);
        return;
      }

      // Get all tabs to count tabs in each group
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Create a map of group IDs to tab counts
      const groupTabCounts = {};
      tabs.forEach(tab => {
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          groupTabCounts[tab.groupId] = (groupTabCounts[tab.groupId] || 0) + 1;
        }
      });

      // Add each group to the list
      groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.style.backgroundColor = getGroupColorBackground(group.color);
        groupItem.style.color = getGroupColorText(group.color);

        const groupTitle = document.createElement('span');
        groupTitle.className = 'group-title';
        groupTitle.textContent = group.title || getMessage('unnamedGroup');

        const groupCount = document.createElement('span');
        groupCount.className = 'group-count';
        groupCount.textContent = groupTabCounts[group.id] || 0;

        groupItem.appendChild(groupTitle);
        groupItem.appendChild(groupCount);

        groupListElement.appendChild(groupItem);
      });
    } catch (error) {
      console.error('Error loading tab groups:', error);
      showStatus(getMessage('errorLoadingGroups'), 'error');
    }
  }

  // Helper function to get background color for group
  function getGroupColorBackground(color) {
    const colors = {
      'grey': '#f1f3f4',
      'blue': '#d0e8ff',
      'red': '#ffd0d0',
      'yellow': '#fff8d0',
      'green': '#d0ffd0',
      'pink': '#ffd0f0',
      'purple': '#e8d0ff',
      'cyan': '#d0ffff',
      'orange': '#ffecd0'
    };

    return colors[color] || '#f1f3f4';
  }

  // Helper function to get text color for group
  function getGroupColorText(color) {
    const colors = {
      'grey': '#444444',
      'blue': '#0046b5',
      'red': '#b50000',
      'yellow': '#b57700',
      'green': '#00b500',
      'pink': '#b5007a',
      'purple': '#7a00b5',
      'cyan': '#00b5b5',
      'orange': '#b56a00'
    };

    return colors[color] || '#444444';
  }
});
