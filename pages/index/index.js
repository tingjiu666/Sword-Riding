Page({
  data: {
    highScore: 0,
    stars: []
  },

  onLoad() {
    const stars = []
    for (let i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 50,
        s: 0.8 + Math.random() * 2,
        d: Math.random() * 3,
        o: 0.2 + Math.random() * 0.5
      })
    }
    this.setData({ stars })
  },

  onShow() {
    const score = wx.getStorageSync('highScore') || 0
    this.setData({ highScore: score })
  },

  onStart() {
    wx.navigateTo({ url: '/pages/game/game' })
  }
})
