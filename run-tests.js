// 运行测试的脚本
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// 创建一个沙箱环境
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Promise,
  Date,
  Math,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Error,
  RegExp,
  JSON,
  URL,
  URLSearchParams
};

// 加载测试框架
const testFrameworkCode = fs.readFileSync(path.join(__dirname, 'test-background.js'), 'utf8');
vm.runInNewContext(testFrameworkCode, sandbox);

// 加载background.js
const backgroundCode = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
vm.runInNewContext(backgroundCode, sandbox);

// 运行测试
sandbox.runTests();
