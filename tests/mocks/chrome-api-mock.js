/**
 * Chrome API 模拟
 */

const chromeMock = {
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    move: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabGroups: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    move: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  windows: {
    WINDOW_ID_CURRENT: -2
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  i18n: {
    getMessage: jest.fn((key) => key)
  }
};

global.chrome = chromeMock;

// 重置所有模拟
export function resetChromeApiMocks() {
  Object.keys(chromeMock).forEach(namespace => {
    Object.keys(chromeMock[namespace]).forEach(method => {
      if (typeof chromeMock[namespace][method] === 'function' && chromeMock[namespace][method].mockReset) {
        chromeMock[namespace][method].mockReset();
      }
    });
  });
}

export default chromeMock; 