// 检查 service worker 是否正确注册
console.log('检查 service worker 注册状态');

// 获取扩展的 service worker 状态
chrome.management.getSelf(function(extensionInfo) {
  console.log('扩展信息:', extensionInfo);
  
  // 检查扩展是否已启用
  if (extensionInfo.enabled) {
    console.log('扩展已启用');
    
    // 尝试发送消息到 background service worker
    chrome.runtime.sendMessage({ action: 'checkServiceWorker' }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('发送消息失败:', chrome.runtime.lastError);
      } else {
        console.log('Service worker 响应:', response);
      }
    });
  } else {
    console.error('扩展未启用');
  }
});
