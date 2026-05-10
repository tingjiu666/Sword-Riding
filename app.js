App({
  onLaunch() {
    wx.cloud?.init?.({ env: 'sword-riding' })
  },
  globalData: {
    highScore: 0
  }
})
