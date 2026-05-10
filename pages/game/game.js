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
    this.spiritParticles = []

    this.player = {
      x: 0, y: 0, vy: 0,
      size: 20,
      gravity: 0.4,
      jumpForce: -7,
      baseY: 0
    }

    this.obstacles = []
    this.obstacleSpeed = 1.5
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
    try {
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
      this.player.y = this.h * 0.45
      this.player.baseY = this.player.y
      this.player.size = Math.min(this.w, this.h) * 0.032
      // 微重力，跳跃响应适中
      this.player.gravity = this.h * 0.00015
      this.player.jumpForce = -this.h * 0.0062

      this.initBackground()
      this.gameLoop()
    } catch (e) {
      console.error('initCanvas error:', e)
    }
  },

  initBackground() {
    this.stars = []
    for (let i = 0; i < 35; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.5,
        r: 0.3 + Math.random() * 1.2,
        a: 0.3 + Math.random() * 0.7
      })
    }

    this.spiritParticles = []
    for (let i = 0; i < 12; i++) {
      this.spiritParticles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 1 + Math.random() * 2.5,
        speed: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      })
    }

    this.clouds = []
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.w * 1.2 - this.w * 0.2,
        y: 30 + Math.random() * this.h * 0.3,
        w: 50 + Math.random() * 70,
        speed: 0.15 + Math.random() * 0.2,
        a: 0.04 + Math.random() * 0.04
      })
    }

    this.mountains = []
    const mCount = Math.ceil(this.w / 100) + 2
    for (let i = 0; i < mCount; i++) {
      this.mountains.push({
        x: i * (90 + Math.random() * 50) - 40,
        h: 50 + Math.random() * 80,
        w: 90 + Math.random() * 50
      })
    }
  },

  gameLoop() {
    try {
      this.update()
      this.render()
    } catch (e) {
      console.error('gameLoop error:', e)
    }
    this.animationId = this.canvas.requestAnimationFrame(this.gameLoop.bind(this))
  },

  update() {
    if (this.isGameOver) return

    const p = this.player
    const h = this.h

    // 缓和的物理效果
    p.vy += p.gravity
    p.y += p.vy

    // 撞顶
    if (p.y < p.size) {
      p.y = p.size
      p.vy = 0
    }

    // 落地即结束
    if (p.y > h - p.size) {
      this.endGame()
      return
    }

    // 障碍物生成（降低频率）
    this.frameCount++
    if (this.frameCount > 60 && this.frameCount % 95 === 0) {
      this.spawnObstacle()
    }

    // 更新障碍物
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x -= this.obstacleSpeed

      if (!obs.passed && obs.x + obs.w < p.x) {
        obs.passed = true
        this.score++
        this.setData({ score: this.score })
      }

      if (obs.x + obs.w < -20) {
        this.obstacles.splice(i, 1)
      }
    }

    this.checkCollision()

    // 更新云朵
    for (const c of this.clouds) {
      c.x -= c.speed
      if (c.x + c.w < -60) {
        c.x = this.w + 40
        c.y = 30 + Math.random() * this.h * 0.3
        c.a = 0.04 + Math.random() * 0.04
      }
    }

    // 更新山脉（慢速滚动）
    for (const m of this.mountains) {
      m.x -= 0.3
      if (m.x + m.w < -50) {
        m.x = this.w + 30
        m.h = 50 + Math.random() * 80
      }
    }

    // 灵气粒子浮动
    for (const sp of this.spiritParticles) {
      sp.y -= sp.speed
      if (sp.y + sp.r < 0) {
        sp.y = this.h + 5
        sp.x = Math.random() * this.w
      }
    }
  },

  spawnObstacle() {
    // 间隙宽度根据玩家跳跃能力动态设计
    const gap = 100 + Math.random() * 25
    // 通道位置分布更均匀，避免过于靠边
    const margin = this.h * 0.12
    const topMin = margin
    const topMax = this.h - gap - margin
    const topH = topMin + Math.random() * (topMax - topMin)

    const obsW = 22 + Math.random() * 6

    this.obstacles.push({
      x: this.w,
      topH: topH,
      bottomY: topH + gap,
      w: obsW,
      passed: false,
      // 用于符文动画
      phase: Math.random() * Math.PI * 2
    })
  },

  checkCollision() {
    const p = this.player
    const hitR = p.size * 0.5

    for (const obs of this.obstacles) {
      if (p.x + hitR > obs.x && p.x - hitR < obs.x + obs.w) {
        if (p.y - hitR < obs.topH + 5 || p.y + hitR > obs.bottomY - 5) {
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

    // === 天空背景（修仙风格渐变） ===
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#0a0a1a')
    grad.addColorStop(0.25, '#14142e')
    grad.addColorStop(0.5, '#1a1a3e')
    grad.addColorStop(0.75, '#1e1830')
    grad.addColorStop(1, '#0f0c1a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // === 星辰 ===
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.a * 0.5})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // === 灵气粒子（上浮光点） ===
    for (const sp of this.spiritParticles) {
      const alpha = 0.2 + 0.3 * Math.sin(sp.phase + this.frameCount * 0.02)
      ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`
      ctx.shadowColor = 'rgba(180, 220, 255, 0.3)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // === 远山（多层） ===
    ctx.shadowBlur = 0
    for (let layer = 0; layer < 2; layer++) {
      const offset = layer * 30
      const alpha = layer === 0 ? 0.15 : 0.25
      ctx.fillStyle = `rgba(30, 35, 60, ${alpha})`
      for (const m of this.mountains) {
        ctx.beginPath()
        ctx.moveTo(m.x - offset, h)
        ctx.lineTo(m.x + m.w * 0.5 - offset, h - m.h)
        ctx.lineTo(m.x + m.w - offset, h)
        ctx.closePath()
        ctx.fill()
      }
    }

    // === 云雾 ===
    for (const c of this.clouds) {
      ctx.fillStyle = `rgba(200, 215, 240, ${c.a})`
      this.drawCloud(ctx, c.x, c.y, c.w)
    }

    // === 障碍物（修仙石门） ===
    for (const obs of this.obstacles) {
      this.drawObstacle(ctx, obs, h)
    }

    // === 玩家（御剑飞仙） ===
    this.drawPlayer(ctx)

    // === 地面微光 ===
    ctx.fillStyle = 'rgba(100, 130, 200, 0.03)'
    ctx.fillRect(0, h - 2, w, 2)
  },

  // 祥云（传统如意云纹简化版）
  drawCloud(ctx, x, y, w) {
    const r = w * 0.2
    // 主云头
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    // 左云头
    ctx.beginPath()
    ctx.arc(x - r * 0.8, y + r * 0.1, r * 0.7, 0, Math.PI * 2)
    ctx.fill()
    // 右云头
    ctx.beginPath()
    ctx.arc(x + r * 0.7, y + r * 0.05, r * 0.65, 0, Math.PI * 2)
    ctx.fill()
    // 上云头
    ctx.beginPath()
    ctx.arc(x - r * 0.2, y - r * 0.35, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    // 云尾
    ctx.beginPath()
    ctx.arc(x + r * 1.3, y + r * 0.25, r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  },

  drawObstacle(ctx, obs, h) {
    const { x, topH, bottomY, w, phase } = obs

    // 石柱主色渐变
    const pillarGrad = ctx.createLinearGradient(x, 0, x + w, 0)
    pillarGrad.addColorStop(0, '#2a3a45')
    pillarGrad.addColorStop(0.15, '#3d5060')
    pillarGrad.addColorStop(0.5, '#4a6075')
    pillarGrad.addColorStop(0.85, '#3d5060')
    pillarGrad.addColorStop(1, '#2a3a45')
    ctx.fillStyle = pillarGrad

    // === 上柱（悬空仙门） ===
    ctx.fillRect(x, 0, w, topH)

    // 柱顶装饰（古瓦檐）
    ctx.fillStyle = '#3a4a55'
    ctx.fillRect(x - 4, topH - 20, w + 8, 20)
    ctx.fillStyle = '#4a6a7a'
    ctx.fillRect(x - 2, topH - 20, w + 4, 4)
    ctx.fillStyle = '#2a3a45'
    ctx.fillRect(x - 2, topH - 4, w + 4, 4)

    // 柱身石刻纹理
    ctx.fillStyle = 'rgba(200, 220, 240, 0.06)'
    for (let i = 0; i < 4; i++) {
      const yy = 10 + i * 22
      if (yy < topH - 25) {
        ctx.fillRect(x + 3, yy, w - 6, 1)
      }
    }

    // === 下柱 ===
    ctx.fillStyle = pillarGrad
    ctx.fillRect(x, bottomY, w, h - bottomY)

    // 柱顶装饰
    ctx.fillStyle = '#3a4a55'
    ctx.fillRect(x - 4, bottomY, w + 8, 20)
    ctx.fillStyle = '#4a6a7a'
    ctx.fillRect(x - 2, bottomY + 16, w + 4, 4)
    ctx.fillStyle = '#2a3a45'
    ctx.fillRect(x - 2, bottomY, w + 4, 4)

    // 符文（动态发光）
    if (!this.isGameOver) {
      const glow = 0.15 + 0.1 * Math.sin(this.frameCount * 0.03 + (phase || 0))
      ctx.fillStyle = `rgba(180, 220, 255, ${glow})`

      // 上柱符文
      ctx.fillRect(x + w * 0.3, topH - 45, 2.5, 14)
      ctx.fillRect(x + w * 0.55, topH - 35, 2.5, 14)

      // 下柱符文
      ctx.fillRect(x + w * 0.3, bottomY + 25, 2.5, 14)
      ctx.fillRect(x + w * 0.55, bottomY + 35, 2.5, 14)

      // 符文光点
      ctx.shadowColor = 'rgba(180, 220, 255, 0.4)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(x + w * 0.5, topH - 38, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + w * 0.5, bottomY + 38, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // 门框侧边装饰线
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 4, 0)
    ctx.lineTo(x + 4, topH)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w - 4, 0)
    ctx.lineTo(x + w - 4, topH)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 4, bottomY)
    ctx.lineTo(x + 4, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w - 4, bottomY)
    ctx.lineTo(x + w - 4, h)
    ctx.stroke()
  },

  drawPlayer(ctx) {
    const p = this.player
    ctx.save()
    ctx.translate(p.x, p.y)

    const s = p.size
    const tilt = Math.min(Math.max(p.vy * 0.015, -0.25), 0.25)
    ctx.rotate(tilt)

    // === 御剑灵光 ===
    ctx.shadowColor = 'rgba(150, 180, 255, 0.25)'
    ctx.shadowBlur = s * 0.6

    // === 飞剑 ===
    // 剑身
    const bladeGrad = ctx.createLinearGradient(-s * 1.5, 0, s * 1.4, 0)
    bladeGrad.addColorStop(0, '#6a7a90')
    bladeGrad.addColorStop(0.2, '#a0b4d0')
    bladeGrad.addColorStop(0.5, '#c0d4ec')
    bladeGrad.addColorStop(0.8, '#a0b4d0')
    bladeGrad.addColorStop(1, '#6a7a90')
    ctx.strokeStyle = bladeGrad
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.moveTo(-s * 1.5, 0)
    ctx.lineTo(s * 1.4, 0)
    ctx.stroke()
    // 剑刃高光
    ctx.strokeStyle = 'rgba(220, 240, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-s * 1.3, -1)
    ctx.lineTo(s * 1.1, -1)
    ctx.stroke()

    // 剑灵气
    ctx.shadowBlur = s * 0.8
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.06)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(-s * 1.5, 0)
    ctx.lineTo(s * 1.4, 0)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 剑格
    ctx.fillStyle = '#5a4030'
    ctx.fillRect(-s * 1.65, -s * 0.14, s * 0.2, s * 0.28)
    ctx.fillStyle = '#8a7050'
    ctx.fillRect(-s * 1.6, -s * 0.08, s * 0.1, s * 0.16)
    // 剑穗（飘动）
    const tasselPhase = this.frameCount * 0.08
    ctx.strokeStyle = '#c04040'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-s * 1.6, s * 0.14)
    ctx.quadraticCurveTo(
      -s * 1.8 + Math.sin(tasselPhase) * s * 0.1,
      s * 0.4 + Math.sin(tasselPhase + 0.5) * s * 0.1,
      -s * 1.5 + Math.sin(tasselPhase * 1.2) * s * 0.15,
      s * 0.65
    )
    ctx.stroke()

    // === 道袍衣摆（飘动） ===
    const robeWave = Math.sin(this.frameCount * 0.05) * s * 0.06
    ctx.fillStyle = '#3d5070'
    ctx.beginPath()
    ctx.moveTo(-s * 0.4, -s * 0.4)
    ctx.lineTo(-s * 0.55, s * 0.15 + robeWave * 0.5)
    ctx.lineTo(-s * 0.35, s * 0.25 + robeWave)
    ctx.lineTo(-s * 0.1, s * 0.15 + robeWave * 0.7)
    ctx.lineTo(s * 0.1, s * 0.15 + robeWave * 0.7)
    ctx.lineTo(s * 0.35, s * 0.25 + robeWave)
    ctx.lineTo(s * 0.55, s * 0.15 + robeWave * 0.5)
    ctx.lineTo(s * 0.4, -s * 0.4)
    ctx.closePath()
    ctx.fill()

    // 衣襟交领
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.12)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(-s * 0.12, -s * 0.4)
    ctx.lineTo(-s * 0.08, s * 0.15)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s * 0.12, -s * 0.4)
    ctx.lineTo(s * 0.08, s * 0.15)
    ctx.stroke()
    // 腰带
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(-s * 0.4, -s * 0.22, s * 0.8, s * 0.07)
    ctx.fillStyle = '#6a5a4a'
    ctx.fillRect(-s * 0.35, -s * 0.21, s * 0.7, s * 0.05)

    // === 身体 ===
    ctx.fillStyle = '#e8d5b7'
    ctx.fillRect(-s * 0.3, -s * 1.2, s * 0.6, s * 0.85)

    // === 头部 ===
    ctx.beginPath()
    ctx.arc(0, -s * 1.45, s * 0.32, 0, Math.PI * 2)
    ctx.fill()
    // 发髻
    ctx.fillStyle = '#1a1010'
    ctx.beginPath()
    ctx.arc(0, -s * 1.55, s * 0.32, Math.PI, 0)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, -s * 1.68, s * 0.11, 0, Math.PI * 2)
    ctx.fill()
    // 鬓发飘动
    const hairWave = this.frameCount * 0.04
    ctx.beginPath()
    ctx.moveTo(-s * 0.28, -s * 1.5)
    ctx.quadraticCurveTo(
      -s * 0.55 + Math.sin(hairWave) * s * 0.08,
      -s * 1.2 + Math.sin(hairWave + 0.3) * s * 0.05,
      -s * 0.3 + Math.sin(hairWave * 1.1) * s * 0.1,
      -s * 0.9
    )
    ctx.lineTo(-s * 0.18, -s * 0.95)
    ctx.quadraticCurveTo(-s * 0.35, -s * 1.2, -s * 0.15, -s * 1.45)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * 0.28, -s * 1.5)
    ctx.quadraticCurveTo(
      s * 0.55 + Math.sin(hairWave + 1) * s * 0.08,
      -s * 1.2 + Math.sin(hairWave + 1.3) * s * 0.05,
      s * 0.3 + Math.sin(hairWave + 1.1) * s * 0.1,
      -s * 0.9
    )
    ctx.lineTo(s * 0.18, -s * 0.95)
    ctx.quadraticCurveTo(s * 0.35, -s * 1.2, s * 0.15, -s * 1.45)
    ctx.closePath()
    ctx.fill()

    // === 右臂前伸（御剑诀） ===
    ctx.strokeStyle = '#e8d5b7'
    ctx.lineWidth = s * 0.13
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(s * 0.2, -s * 0.85)
    ctx.quadraticCurveTo(s * 0.5, -s * 1.05, s * 0.72, -s * 0.92)
    ctx.stroke()
    // 袖子
    ctx.strokeStyle = '#3d5070'
    ctx.lineWidth = s * 0.22
    ctx.beginPath()
    ctx.moveTo(s * 0.15, -s * 0.78)
    ctx.quadraticCurveTo(s * 0.52, -s * 1.1, s * 0.78, -s * 0.85)
    ctx.stroke()
    // 袖口飘带
    const ribbonWave = this.frameCount * 0.06
    ctx.strokeStyle = 'rgba(180, 200, 240, 0.2)'
    ctx.lineWidth = s * 0.08
    ctx.beginPath()
    ctx.moveTo(s * 0.7, -s * 0.9)
    ctx.quadraticCurveTo(
      s * 1.0 + Math.sin(ribbonWave) * s * 0.1,
      -s * 0.75 + Math.sin(ribbonWave + 0.5) * s * 0.1,
      s * 1.1 + Math.sin(ribbonWave * 1.3) * s * 0.15,
      -s * 0.55
    )
    ctx.stroke()
    ctx.lineCap = 'butt'

    // === 左臂负手 ===
    ctx.strokeStyle = '#3d5070'
    ctx.lineWidth = s * 0.17
    ctx.beginPath()
    ctx.moveTo(-s * 0.25, -s * 0.78)
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.58, -s * 0.42, -s * 0.25)
    ctx.stroke()

    // === 飞剑拖尾剑气 ===
    if (!this.isGameOver) {
      ctx.shadowBlur = 0
      // 剑光拖尾
      const trail = 0.08 + 0.06 * Math.sin(this.frameCount * 0.08)
      ctx.fillStyle = `rgba(160, 210, 255, ${trail})`

      // 主拖尾光点
      for (let i = 0; i < 3; i++) {
        const tx = -s * (1.8 + i * 0.4)
        const ty = Math.sin(this.frameCount * 0.1 + i * 0.8) * s * 0.15
        const tr = s * (0.25 - i * 0.06)
        ctx.beginPath()
        ctx.arc(tx, ty, tr, 0, Math.PI * 2)
        ctx.fill()
      }

      // 灵气粒子
      ctx.fillStyle = `rgba(200, 230, 255, ${trail * 0.5})`
      for (let i = 0; i < 4; i++) {
        const px = -s * (2 + Math.random() * 1.5)
        const py = Math.sin(this.frameCount * 0.05 + i * 1.2) * s * 0.3
        ctx.beginPath()
        ctx.arc(px, py, s * 0.1, 0, Math.PI * 2)
        ctx.fill()
      }
    }

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
    this.player.y = this.h * 0.45
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
    if (this.animationId && this.canvas) {
      this.canvas.cancelAnimationFrame(this.animationId)
    }
  }
})
