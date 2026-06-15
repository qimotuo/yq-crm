export default {
  mini: {},
  h5: {
    router: { mode: 'browser' },
  },
  defineConstants: {
    API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'https://your-domain.com/api'),
  },
}
