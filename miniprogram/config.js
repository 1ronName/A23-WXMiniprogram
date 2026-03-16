/**
 * 小程序配置文件
 */

const host = '14592619.qcloud.la'

const config = {
  // 测试的请求地址，用于测试会话
  requestUrl: 'https://mp.weixin.qq.com',
  host,

  // 云开发环境 ID
  envId: 'release-b86096',
  // envId: 'test-f0b102',

  // 云开发-存储 示例文件的文件 ID
  demoImageFileId: 'cloud://release-b86096.7265-release-b86096-1258211818/demo.jpg',
  demoVideoFileId: 'cloud://release-b86096.7265-release-b86096/demo.mp4',

  // DocAI 后端 API 地址
  // 开发者工具本机调试可使用 127.0.0.1，真机请改为可访问的局域网或公网地址。
  apiBaseUrl: 'http://127.0.0.1:8080/api/v1',
  requestTimeout: 120000,
}

module.exports = config
