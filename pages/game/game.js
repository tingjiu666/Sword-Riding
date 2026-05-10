Page({
  data: {
    score: 0,
    highScore: 0,
    gameOver: false,
    isNewRecord: false
  },

  onLoad() {
    this.score = 0
    this.highScore = wx.getStorageSync('highScore') || 0
    this.isGameOver = false
    this.isNewRecord = false
    this.canvas = null
    this.ctx = null
    this.animationId = null
    this.w = 0
    this.h = 0
    this.frameCount = 0
    this.stars = []

    this.player = { x: 0, y: 0, vy: 0, size: 20 }
    this.player.gravity = 0.4
    this.player.jumpForce = -7

    this.obstacles = []
    this.obstacleSpeed = 3
    this.spawnInterval = 100

    this.clouds = []
    this.mountains = []
  },

  onReady() {
    const query = wx.createSelectorQuery()
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec(this.initCanvas.bind(this))
  },

  initCanvas(res) {
    const canvas = res[0].node
    const ctx = canvas.getContext('2d')
    this.canvas = canvas
    this.ctx = ctx

    const sys = wx.getSystemInfoSync()
    const dpr = sys.pixelRatio
    this.w = res[0].width
    this.h = res[0].height

    canvas.width = this.w * dpr
    canvas.height = this.h * dpr
    ctx.scale(dpr, dpr)

    this.player.x = this.w * 0.25
    this.player.y = this.h * 0.5
    this.player.size = Math.min(this.w, this.h) * 0.035
    this.player.gravity = this.h * 0.0006
    this.player.jumpForce = -this.h * 0.012

    this.initBackground()
    this.gameLoop()
  },

  initBackground() {
    this.stars = []
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.5,
        r: 0.5 + Math.random() * 1.5
      })
    }

    this.clouds = []
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: Math.random() * this.w,
        y: 30 + Math.random() * this.h * 0.35,
        w: 60 + Math.random() * 80,
        speed: 0.2 + Math.random() * 0.3
      })
    }

    this.mountains = []
    const mCount = Math.ceil(this.w / 80) + 2
    for (let i = 0; i < mCount; i++) {
      this.mountains.push({
        x: i * (80 + Math.random() * 40),
        h: 60 + Math.random() * 100,
        w: 80 + Math.random() * 60
      })
    }
  },

  gameLoop() {
    this.update()
    this.render()
    this.animationId = this.canvas.requestAnimationFrame(this.gameLoop.bind(this))
  },

  update() {
    if (this.isGameOver) return

    const p = this.player

    // Player physics
    p.vy += p.gravity
    p.y += p.vy

    // Ceiling
    if (p.y < p.size) {
      p.y = p.size
      p.vy = 0
    }

    // Floor = game over
    if (p.y > this.h - p.size) {
      this.endGame()
      return
    }

    // Spawn obstacles
    this.frameCount++
    if (this.frameCount % 80 === 0) {
      this.spawnObstacle()
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x -= this.obstacleSpeed

      if (!obs.passed && obs.x + obs.w < this.player.x) {
        obs.passed = true
        this.score++
        this.setData({ score: this.score })
      }

      if (obs.x + obs.w < 0) {
        this.obstacles.splice(i, 1)
      }
    }

    // Collision
    this.checkCollision()

    // Update clouds
    for (const c of this.clouds) {
      c.x -= c.speed
      if (c.x + c.w < -50) {
        c.x = this.w + 30
        c.y = 30 + Math.random() * this.h * 0.35
      }
    }

    // Update mountains
    for (const m of this.mountains) {
      m.x -= 0.5
      if (m.x + m.w < -50) {
        m.x = this.w + 30
        m.h = 60 + Math.random() * 100
      }
    }
  },

  spawnObstacle() {
    const gap = 120 + Math.random() * 50
    const minTop = 50
    const maxTop = this.h - gap - 50
    const topH = minTop + Math.random() * (maxTop - minTop)

    this.obstacles.push({
      x: this.w,
      topH: topH,
      bottomY: topH + gap,
      w: 25 + Math.random() * 10,
      passed: false
    })
  },

  checkCollision() {
    const p = this.player
    const hitR = p.size * 0.6

    for (const obs of this.obstacles) {
      if (p.x + hitR > obs.x && p.x - hitR < obs.x + obs.w) {
        if (p.y - hitR < obs.topH || p.y + hitR > obs.bottomY) {
          this.endGame()
          return
        }
      }
    }
  },

  endGame() {
    this.isGameOver = true
    const currentHigh = wx.getStorageSync('highScore') || 0
    const isNew = this.score > currentHigh
    if (isNew) {
      wx.setStorageSync('highScore', this.score)
    }
    this.setData({
      gameOver: true,
      score: this.score,
      highScore: Math.max(this.score, currentHigh),
      isNewRecord: isNew
    })
  },

  render() {
    const ctx = this.ctx
    const w = this.w
    const h = this.h

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#0f0c29')
    grad.addColorStop(0.35, '#1a1a4e')
    grad.addColorStop(0.65, '#24243e')
    grad.addColorStop(1, '#0f0c29')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (const s of this.stars) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Mountains
    for (const m of this.mountains) {
      ctx.beginPath()
      ctx.moveTo(m.x, h)
      ctx.lineTo(m.x + m.w * 0.5, h - m.h)
      ctx.lineTo(m.x + m.w, h)
      ctx.closePath()
      ctx.fillStyle = 'rgba(20, 18, 45, 0.6)'
      ctx.fill()
    }

    // Clouds
    for (const c of this.clouds) {
      ctx.fillStyle = 'rgba(232, 213, 183, 0.06)'
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.w * 0.4, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(c.x - c.w * 0.2, c.y - 6, c.w * 0.3, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(c.x + c.w * 0.15, c.y - 4, c.w * 0.2, 8, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Obstacles
    for (const obs of this.obstacles) {
      // Top pillar
      const pillarGrad = ctx.createLinearGradient(obs.x, 0, obs.x + obs.w, 0)
      pillarGrad.addColorStop(0, '#3a2f5b')
      pillarGrad.addColorStop(0.5, '#5a4a7a')
      pillarGrad.addColorStop(1, '#3a2f5b')
      ctx.fillStyle = pillarGrad
      ctx.fillRect(obs.x, 0, obs.w, obs.topH)

      // Top cap
      ctx.fillStyle = '#6b5b8a'
      ctx.fillRect(obs.x - 4, obs.topH - 18, obs.w + 8, 18)
      ctx.fillStyle = 'rgba(107, 91, 138, 0.3)'
      ctx.fillRect(obs.x - 4, obs.topH - 18, obs.w + 8, 4)

      // Bottom pillar
      ctx.fillStyle = pillarGrad
      ctx.fillRect(obs.x, obs.bottomY, obs.w, h - obs.bottomY)

      // Bottom cap
      ctx.fillStyle = '#6b5b8a'
      ctx.fillRect(obs.x - 4, obs.bottomY, obs.w + 8, 18)
      ctx.fillStyle = 'rgba(107, 91, 138, 0.3)'
      ctx.fillRect(obs.x - 4, obs.bottomY + 14, obs.w + 8, 4)

      // Rune decoration
      ctx.fillStyle = 'rgba(232, 213, 183, 0.1)'
      ctx.fillRect(obs.x + obs.w * 0.3, obs.topH - 40, 2, 20)
      ctx.fillRect(obs.x + obs.w * 0.3, obs.bottomY + 20, 2, 20)
    }

    // Player
    this.drawPlayer(ctx)
  },

  drawPlayer(ctx) {
    const p = this.player
    ctx.save()
    ctx.translate(p.x, p.y)

    const tilt = Math.min(Math.max(p.vy * 0.03, -0.4), 0.4)
    ctx.rotate(tilt)

    const s = p.size

    // Sword glow
    ctx.shadowColor = 'rgba(150, 150, 255, 0.2)'
    ctx.shadowBlur = s * 0.5

    // Sword blade
    ctx.strokeStyle = '#a8b4c8'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-s * 1.4, 0)
    ctx.lineTo(s * 1.2, 0)
    ctx.stroke()

    // Sword center glow
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.15)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(-s * 1.4, 0)
    ctx.lineTo(s * 1.2, 0)
    ctx.stroke()

    ctx.shadowBlur = 0

    // Sword guard
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-s * 1.55, -s * 0.15, s * 0.25, s * 0.3)

    // Character body
    ctx.fillStyle = '#e8d5b7'
    ctx.fillRect(-s * 0.35, -s * 1.3, s * 0.7, s * 0.9)

    // Head
    ctx.beginPath()
    ctx.arc(0, -s * 1.55, s * 0.35, 0, Math.PI * 2)
    ctx.fill()

    // Hair bun
    ctx.fillStyle = '#2c1810'
    ctx.beginPath()
    ctx.arc(0, -s * 1.65, s * 0.35, Math.PI, 0)
    ctx.fill()
    // Top bun
    ctx.beginPath()
    ctx.arc(0, -s * 1.75, s * 0.12, 0, Math.PI * 2)
    ctx.fill()

    // Hair tail
    ctx.beginPath()
    ctx.moveTo(s * 0.15, -s * 1.6)
    ctx.lineTo(s * 0.35, -s * 1.3)
    ctx.lineTo(s * 0.1, -s * 1.35)
    ctx.closePath()
    ctx.fill()

    // Robe
    ctx.fillStyle = '#6b5b8a'
    ctx.beginPath()
    ctx.moveTo(-s * 0.35, -s * 0.4)
    ctx.lineTo(-s * 0.5, s * 0.15)
    ctx.lineTo(s * 0.5, s * 0.15)
    ctx.lineTo(s * 0.35, -s * 0.4)
    ctx.closePath()
    ctx.fill()

    // Robe detail
    ctx.strokeStyle = 'rgba(232, 213, 183, 0.2)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.4)
    ctx.lineTo(0, s * 0.15)
    ctx.stroke()

    // Arm (right - reaching forward)
    ctx.strokeStyle = '#e8d5b7'
    ctx.lineWidth = s * 0.15
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(s * 0.2, -s * 0.9)
    ctx.lineTo(s * 0.7, -s * 1.1)
    ctx.stroke()

    // Sleeve
    ctx.strokeStyle = '#6b5b8a'
    ctx.lineWidth = s * 0.22
    ctx.beginPath()
    ctx.moveTo(s * 0.15, -s * 0.85)
    ctx.lineTo(s * 0.65, -s * 1.05)
    ctx.stroke()

    ctx.restore()
  },

  onTap() {
    if (this.isGameOver) return
    this.player.vy = this.player.jumpForce
  },

  onRestart() {
    this.isGameOver = false
    this.score = 0
    this.frameCount = 0
    this.player.y = this.h * 0.5
    this.player.vy = 0
    this.obstacles = []
    this.setData({
      gameOver: false,
      score: 0,
      isNewRecord: false
    })
  },

  onHome() {
    wx.navigateBack()
  },

  onUnload() {
    if (this.animationId) {
      this.canvas.cancelAnimationFrame(this.animationId)
    }
  }
})
