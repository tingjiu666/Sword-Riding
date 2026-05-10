Page({
  data: {
    highScore: 0
  },

  onShow() {
    const score = wx.getStorageSync('highScore') || 0
    this.setData({ highScore: score })
  },

  onStart() {
    wx.navigateTo({ url: '/pages/game/game' })
  }
})
