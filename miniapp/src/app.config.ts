export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/login/protocol',
    'pages/orders/index',
    'pages/orders/detail',
    'pages/customers/index',
    'pages/customers/detail',
    'pages/follow-ups/index',
    'pages/schedules/index',
    'pages/profile/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#6366f1',
    navigationBarTitleText: '基米网小程序',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#666666',
    selectedColor: '#6366f1',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/orders/index',
        text: '安装登记',
        iconPath: 'assets/tab/order.png',
        selectedIconPath: 'assets/tab/order-active.png',
      },
      {
        pagePath: 'pages/customers/index',
        text: '客户',
        iconPath: 'assets/tab/customer.png',
        selectedIconPath: 'assets/tab/customer-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png',
      },
    ],
  },
})
