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
    this.inkSplashes = []

    this.player = {
      x: 0, y: 0, vy: 0,
      size: 20,
      gravity: 0.4,
      jumpForce: -7,
      baseY: 0
    }

    this.obstacles = []
    this.obstacleSpeed = 2.0
    this.obstaclesPassed = 0
    this.clouds = []
    this.mountains = []
    this.gameStarted = false
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
      this.player.y = this.h * 0.5
      this.player.baseY = this.player.y
      this.player.size = Math.min(this.w, this.h) * 0.035

      // 快速点击模式：重力适中，跳跃力适中，适合高频点击
      this.player.gravity = this.h * 0.00026
      this.player.jumpForce = -this.h * 0.005

      this.initBackground()
      this.gameLoop()
    } catch (e) {
      console.error('initCanvas error:', e)
    }
  },

  initBackground() {
    this.stars = []
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.55,
        r: 0.3 + Math.random() * 1.4,
        a: 0.2 + Math.random() * 0.6,
        twinkle: Math.random() * Math.PI * 2
      })
    }

    this.spiritParticles = []
    for (let i = 0; i < 15; i++) {
      this.spiritParticles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.8 + Math.random() * 2.2,
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2
      })
    }

    // 水墨飞溅效果
    this.inkSplashes = []
    for (let i = 0; i < 6; i++) {
      this.inkSplashes.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 15 + Math.random() * 35,
        a: 0.015 + Math.random() * 0.025,
        speed: 0.1 + Math.random() * 0.2
      })
    }

    this.clouds = []
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.w * 1.2 - this.w * 0.2,
        y: 25 + Math.random() * this.h * 0.28,
        w: 55 + Math.random() * 75,
        speed: 0.12 + Math.random() * 0.18,
        a: 0.03 + Math.random() * 0.04
      })
    }

    this.mountains = []
    const mCount = Math.ceil(this.w / 90) + 3
    for (let i = 0; i < mCount; i++) {
      this.mountains.push({
        x: i * (80 + Math.random() * 55) - 40,
        h: 55 + Math.random() * 90,
        w: 80 + Math.random() * 60
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

    p.vy += p.gravity
    p.y += p.vy

    if (p.y < p.size) {
      p.y = p.size
      p.vy = 0
    }

    if (p.y > h - p.size) {
      this.endGame()
      return
    }

    this.frameCount++

    // 首次障碍物更早出现（约1秒），之后间隔生成
    const spawnInterval = 100
    if (!this.gameStarted && this.frameCount > 55) {
      this.gameStarted = true
      this.spawnObstacle()
    } else if (this.gameStarted && this.frameCount % spawnInterval === 0) {
      this.spawnObstacle()
    }

    // 渐进难度：每过20个障碍物加速
    const newSpeed = 2.0 + Math.floor(this.obstaclesPassed / 20) * 0.25
    this.obstacleSpeed = Math.min(newSpeed, 4.5)

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x -= this.obstacleSpeed

      if (!obs.passed && obs.x + obs.w < p.x) {
        obs.passed = true
        this.score++
        this.obstaclesPassed++
        this.setData({ score: this.score })
      }

      if (obs.x + obs.w < -30) {
        this.obstacles.splice(i, 1)
      }
    }

    this.checkCollision()

    for (const c of this.clouds) {
      c.x -= c.speed
      if (c.x + c.w < -60) {
        c.x = this.w + 40
        c.y = 25 + Math.random() * this.h * 0.28
        c.a = 0.03 + Math.random() * 0.04
      }
    }

    for (const m of this.mountains) {
      m.x -= 0.25
      if (m.x + m.w < -50) {
        m.x = this.w + 30
        m.h = 55 + Math.random() * 90
      }
    }

    for (const sp of this.spiritParticles) {
      sp.y -= sp.speed
      if (sp.y + sp.r < 0) {
        sp.y = this.h + 5
        sp.x = Math.random() * this.w
      }
    }

    for (const is of this.inkSplashes) {
      is.y -= is.speed
      if (is.y + is.r < 0) {
        is.y = this.h + 10
        is.x = Math.random() * this.w
        is.a = 0.015 + Math.random() * 0.025
      }
    }
  },

  spawnObstacle() {
    // 更宽的通道
    const gap = 120 + Math.random() * 35
    const margin = this.h * 0.1
    const topMin = margin
    const topMax = this.h - gap - margin
    const topH = topMin + Math.random() * (topMax - topMin)

    // 障碍物更粗大
    const obsW = 28 + Math.random() * 8

    this.obstacles.push({
      x: this.w,
      topH: topH,
      bottomY: topH + gap,
      w: obsW,
      passed: false,
      phase: Math.random() * Math.PI * 2,
      cracks: this.generateCracks(obsW, topH, this.h - (topH + gap))
    })
  },

  generateCracks(w, topH, bottomH) {
    const cracks = []
    // 上柱裂纹
    if (topH > 30) {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        cracks.push({
          side: 'top',
          y: 10 + Math.random() * (topH - 20),
          x: Math.random() * w,
          len: 4 + Math.random() * 8,
          angle: (Math.random() - 0.5) * 1.2
        })
      }
    }
    // 下柱裂纹
    if (bottomH > 30) {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        cracks.push({
          side: 'bottom',
          y: 10 + Math.random() * (bottomH - 20),
          x: Math.random() * w,
          len: 4 + Math.random() * 8,
          angle: (Math.random() - 0.5) * 1.2
        })
      }
    }
    return cracks
  },

  checkCollision() {
    const p = this.player
    const hitR = p.size * 0.45

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

    // === 水墨天空背景 ===
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#1a1008')
    grad.addColorStop(0.2, '#2a1a0a')
    grad.addColorStop(0.5, '#3d2815')
    grad.addColorStop(0.75, '#2a1a0c')
    grad.addColorStop(1, '#1a0e06')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // === 宣纸纹理（底层暖黄光晕） ===
    ctx.fillStyle = 'rgba(180, 140, 100, 0.015)'
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.arc(
        w * (0.1 + Math.random() * 0.8),
        h * (0.05 + Math.random() * 0.9),
        60 + Math.random() * 120,
        0, Math.PI * 2
      )
      ctx.fill()
    }

    // === 星辰（暖金色） ===
    for (const s of this.stars) {
      const twinkle = 0.3 + 0.4 * Math.sin(this.frameCount * 0.015 + s.twinkle)
      ctx.fillStyle = `rgba(220, 180, 120, ${s.a * twinkle})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // === 灵气粒子（金尘） ===
    for (const sp of this.spiritParticles) {
      const alpha = 0.15 + 0.25 * Math.sin(sp.phase + this.frameCount * 0.018)
      ctx.fillStyle = `rgba(220, 180, 100, ${alpha})`
      ctx.shadowColor = 'rgba(200, 150, 80, 0.25)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // === 远山（水墨层次） ===
    for (let layer = 0; layer < 3; layer++) {
      const offset = layer * 25
      const alpha = 0.06 + layer * 0.04
      ctx.fillStyle = `rgba(40, 25, 15, ${alpha})`
      ctx.shadowColor = 'rgba(30, 18, 10, 0.1)'
      ctx.shadowBlur = 15
      for (const m of this.mountains) {
        const mx = m.x - offset * 0.5
        const mh = m.h - layer * 12
        ctx.beginPath()
        ctx.moveTo(mx, h)
        // 山水画风格不规则山形
        ctx.lineTo(mx + m.w * 0.25, h - mh * 0.7)
        ctx.lineTo(mx + m.w * 0.4, h - mh * 1.05)
        ctx.lineTo(mx + m.w * 0.55, h - mh * 0.6)
        ctx.lineTo(mx + m.w * 0.7, h - mh * 0.9)
        ctx.lineTo(mx + m.w * 0.85, h - mh * 0.55)
        ctx.lineTo(mx + m.w, h - mh * 0.3)
        ctx.lineTo(mx + m.w, h)
        ctx.closePath()
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    // === 水墨飞溅 ===
    for (const is of this.inkSplashes) {
      ctx.fillStyle = `rgba(60, 35, 20, ${is.a})`
      ctx.beginPath()
      ctx.arc(is.x, is.y, is.r, 0, Math.PI * 2)
      ctx.fill()
      // 不规则边缘
      ctx.beginPath()
      ctx.arc(is.x + is.r * 0.5, is.y - is.r * 0.3, is.r * 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(is.x - is.r * 0.4, is.y + is.r * 0.4, is.r * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    // === 云雾（淡墨） ===
    for (const c of this.clouds) {
      ctx.fillStyle = `rgba(180, 150, 130, ${c.a})`
      this.drawCloud(ctx, c.x, c.y, c.w)
    }

    // === 障碍物（岩柱） ===
    for (const obs of this.obstacles) {
      this.drawRockPillar(ctx, obs, h)
    }

    // === 玩家 ===
    this.drawPlayer(ctx)

    // === 地面线 ===
    const groundGrad = ctx.createLinearGradient(0, h - 3, 0, h)
    groundGrad.addColorStop(0, 'rgba(120, 80, 40, 0)')
    groundGrad.addColorStop(0.5, 'rgba(120, 80, 40, 0.06)')
    groundGrad.addColorStop(1, 'rgba(120, 80, 40, 0)')
    ctx.fillStyle = groundGrad
    ctx.fillRect(0, h - 3, w, 3)
  },

  drawCloud(ctx, x, y, w) {
    const r = w * 0.2
    // 水墨云纹
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x - r * 0.8, y + r * 0.1, r * 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + r * 0.7, y + r * 0.05, r * 0.65, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x - r * 0.2, y - r * 0.35, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + r * 1.3, y + r * 0.25, r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  },

  // === 岩柱障碍物（武侠风格石刻柱） ===
  drawRockPillar(ctx, obs, h) {
    const { x, topH, bottomY, w, phase, cracks } = obs

    // 岩石主色调（暖灰褐）
    const rockGrad = ctx.createLinearGradient(x, 0, x + w, 0)
    rockGrad.addColorStop(0, '#3a2a18')
    rockGrad.addColorStop(0.15, '#5a4530')
    rockGrad.addColorStop(0.35, '#6b5540')
    rockGrad.addColorStop(0.6, '#5a4530')
    rockGrad.addColorStop(0.85, '#4a3525')
    rockGrad.addColorStop(1, '#3a2a18')

    // === 上岩柱 ===
    ctx.fillStyle = rockGrad
    this.drawRuggedPillar(ctx, x, 0, w, topH)

    // 上柱顶端（断裂岩面）
    ctx.fillStyle = '#4a3828'
    ctx.beginPath()
    ctx.moveTo(x - 3, topH - 6)
    ctx.lineTo(x + w * 0.2, topH - 18)
    ctx.lineTo(x + w * 0.5, topH - 4)
    ctx.lineTo(x + w * 0.8, topH - 14)
    ctx.lineTo(x + w + 3, topH - 8)
    ctx.lineTo(x + w + 3, topH + 6)
    ctx.lineTo(x - 3, topH + 6)
    ctx.closePath()
    ctx.fill()

    // 上柱底部（断裂岩面 - 通道上方）
    ctx.fillStyle = '#3d2d1d'
    ctx.beginPath()
    ctx.moveTo(x - 3, topH - 4)
    ctx.lineTo(x + w * 0.3, topH + 10)
    ctx.lineTo(x + w * 0.5, topH + 3)
    ctx.lineTo(x + w * 0.7, topH + 8)
    ctx.lineTo(x + w + 3, topH + 4)
    ctx.lineTo(x + w + 3, topH - 8)
    ctx.lineTo(x - 3, topH - 8)
    ctx.closePath()
    ctx.fill()

    // === 下岩柱 ===
    ctx.fillStyle = rockGrad
    this.drawRuggedPillar(ctx, x, bottomY, w, h - bottomY)

    // 下柱顶端（断裂岩面）
    ctx.fillStyle = '#4a3828'
    ctx.beginPath()
    ctx.moveTo(x - 3, bottomY + 4)
    ctx.lineTo(x + w * 0.25, bottomY - 10)
    ctx.lineTo(x + w * 0.55, bottomY + 2)
    ctx.lineTo(x + w * 0.75, bottomY - 8)
    ctx.lineTo(x + w + 3, bottomY + 4)
    ctx.lineTo(x + w + 3, bottomY + 8)
    ctx.lineTo(x - 3, bottomY + 8)
    ctx.closePath()
    ctx.fill()

    // === 岩石裂纹 ===
    ctx.strokeStyle = 'rgba(30, 18, 10, 0.3)'
    ctx.lineWidth = 0.8
    for (const crack of (cracks || [])) {
      const baseY = crack.side === 'top' ? 0 : bottomY
      ctx.beginPath()
      ctx.moveTo(x + crack.x, baseY + crack.y)
      ctx.lineTo(
        x + crack.x + Math.cos(crack.angle) * crack.len,
        baseY + crack.y + Math.sin(crack.angle) * crack.len
      )
      ctx.stroke()
    }

    // === 岩石纹理横纹 ===
    ctx.strokeStyle = 'rgba(80, 55, 35, 0.2)'
    ctx.lineWidth = 0.6
    // 上柱横纹
    for (let i = 0; i < Math.floor(topH / 18); i++) {
      const ty = 6 + i * 18 + Math.sin(i * 1.7) * 5
      if (ty < topH - 12) {
        ctx.beginPath()
        ctx.moveTo(x + 3, ty)
        ctx.quadraticCurveTo(x + w * 0.5, ty + Math.sin(i * 0.8) * 2, x + w - 3, ty)
        ctx.stroke()
      }
    }
    // 下柱横纹
    const bottomH = h - bottomY
    for (let i = 0; i < Math.floor(bottomH / 18); i++) {
      const ty = bottomY + 6 + i * 18 + Math.sin(i * 1.7) * 5
      if (ty < h - 10) {
        ctx.beginPath()
        ctx.moveTo(x + 3, ty)
        ctx.quadraticCurveTo(x + w * 0.5, ty + Math.sin(i * 0.8) * 2, x + w - 3, ty)
        ctx.stroke()
      }
    }

    // === 金纹石刻（金色符文） ===
    if (!this.isGameOver) {
      const glow = 0.12 + 0.08 * Math.sin(this.frameCount * 0.03 + (phase || 0))
      ctx.fillStyle = `rgba(200, 150, 80, ${glow})`

      // 上柱符文
      if (topH > 60) {
        const runeY = topH - 42
        ctx.fillRect(x + w * 0.3, runeY, 3, 16)
        ctx.fillRect(x + w * 0.55, runeY + 4, 3, 16)
        // 横向符文
        ctx.fillRect(x + w * 0.25, runeY + 7, 4, 2)
        ctx.fillRect(x + w * 0.5, runeY + 9, 4, 2)
      }

      // 下柱符文
      if (h - bottomY > 60) {
        const runeY = bottomY + 26
        ctx.fillRect(x + w * 0.3, runeY, 3, 16)
        ctx.fillRect(x + w * 0.55, runeY - 4, 3, 16)
        ctx.fillRect(x + w * 0.25, runeY + 4, 4, 2)
        ctx.fillRect(x + w * 0.5, runeY + 6, 4, 2)
      }

      // 符文光点
      ctx.shadowColor = 'rgba(220, 160, 60, 0.35)'
      ctx.shadowBlur = 10
      if (topH > 60) {
        ctx.beginPath()
        ctx.arc(x + w * 0.5, topH - 35, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      if (h - bottomY > 60) {
        ctx.beginPath()
        ctx.arc(x + w * 0.5, bottomY + 32, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    // === 岩柱边缘（不规则凿痕） ===
    ctx.strokeStyle = 'rgba(30, 18, 10, 0.2)'
    ctx.lineWidth = 1.2
    // 左侧
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.quadraticCurveTo(x + 2, topH * 0.3, x - 1, topH * 0.6)
    ctx.quadraticCurveTo(x + 2, topH, x, topH)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, bottomY)
    ctx.quadraticCurveTo(x + 2, bottomY + (h - bottomY) * 0.4, x - 1, bottomY + (h - bottomY) * 0.7)
    ctx.quadraticCurveTo(x + 2, h, x, h)
    ctx.stroke()
    // 右侧
    ctx.beginPath()
    ctx.moveTo(x + w, 0)
    ctx.quadraticCurveTo(x + w - 2, topH * 0.3, x + w + 1, topH * 0.6)
    ctx.quadraticCurveTo(x + w - 2, topH, x + w, topH)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w, bottomY)
    ctx.quadraticCurveTo(x + w - 2, bottomY + (h - bottomY) * 0.4, x + w + 1, bottomY + (h - bottomY) * 0.7)
    ctx.quadraticCurveTo(x + w - 2, h, x + w, h)
    ctx.stroke()
  },

  // 粗糙岩柱侧面
  drawRuggedPillar(ctx, x, y, w, h) {
    if (h <= 0) return
    ctx.beginPath()
    // 左侧不规则
    ctx.moveTo(x, y)
    ctx.lineTo(x + 2, y + h * 0.1)
    ctx.lineTo(x - 1, y + h * 0.25)
    ctx.lineTo(x + 3, y + h * 0.4)
    ctx.lineTo(x, y + h * 0.55)
    ctx.lineTo(x + 2, y + h * 0.7)
    ctx.lineTo(x - 1, y + h * 0.85)
    ctx.lineTo(x + 1, y + h)
    // 右侧不规则
    ctx.lineTo(x + w - 1, y + h)
    ctx.lineTo(x + w + 1, y + h * 0.85)
    ctx.lineTo(x + w - 2, y + h * 0.7)
    ctx.lineTo(x + w, y + h * 0.55)
    ctx.lineTo(x + w + 2, y + h * 0.4)
    ctx.lineTo(x + w - 1, y + h * 0.25)
    ctx.lineTo(x + w + 1, y + h * 0.1)
    ctx.lineTo(x + w, y)
    ctx.closePath()
    ctx.fill()
  },

  drawPlayer(ctx) {
    const p = this.player
    ctx.save()
    ctx.translate(p.x, p.y)

    const s = p.size
    const tilt = Math.min(Math.max(p.vy * 0.018, -0.3), 0.3)
    ctx.rotate(tilt)

    // === 金色剑气光环 ===
    ctx.shadowColor = 'rgba(220, 170, 80, 0.2)'
    ctx.shadowBlur = s * 0.7

    // === 飞剑 ===
    const bladeGrad = ctx.createLinearGradient(-s * 1.5, 0, s * 1.4, 0)
    bladeGrad.addColorStop(0, '#6a5540')
    bladeGrad.addColorStop(0.2, '#a09070')
    bladeGrad.addColorStop(0.5, '#c8b898')
    bladeGrad.addColorStop(0.8, '#a09070')
    bladeGrad.addColorStop(1, '#6a5540')
    ctx.strokeStyle = bladeGrad
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-s * 1.5, 0)
    ctx.lineTo(s * 1.4, 0)
    ctx.stroke()

    // 剑刃暖光高光
    ctx.strokeStyle = 'rgba(240, 220, 180, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-s * 1.3, -1)
    ctx.lineTo(s * 1.1, -1)
    ctx.stroke()

    // 剑气（金色光晕）
    ctx.shadowBlur = s * 0.9
    ctx.strokeStyle = 'rgba(200, 160, 80, 0.06)'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(-s * 1.5, 0)
    ctx.lineTo(s * 1.4, 0)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 剑格
    ctx.fillStyle = '#3d2a15'
    ctx.fillRect(-s * 1.65, -s * 0.15, s * 0.22, s * 0.3)
    ctx.fillStyle = '#8a6040'
    ctx.fillRect(-s * 1.6, -s * 0.09, s * 0.12, s * 0.18)

    // 剑穗（飘动）
    const tasselPhase = this.frameCount * 0.08
    ctx.strokeStyle = '#c04040'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-s * 1.6, s * 0.15)
    ctx.quadraticCurveTo(
      -s * 1.8 + Math.sin(tasselPhase) * s * 0.1,
      s * 0.42 + Math.sin(tasselPhase + 0.5) * s * 0.1,
      -s * 1.5 + Math.sin(tasselPhase * 1.2) * s * 0.15,
      s * 0.7
    )
    ctx.stroke()

    // === 道袍 ===
    const robeWave = Math.sin(this.frameCount * 0.05) * s * 0.06
    // 外袍
    ctx.fillStyle = '#4a4035'
    ctx.beginPath()
    ctx.moveTo(-s * 0.45, -s * 0.35)
    ctx.lineTo(-s * 0.6, s * 0.18 + robeWave * 0.5)
    ctx.lineTo(-s * 0.4, s * 0.28 + robeWave)
    ctx.lineTo(-s * 0.1, s * 0.18 + robeWave * 0.7)
    ctx.lineTo(s * 0.1, s * 0.18 + robeWave * 0.7)
    ctx.lineTo(s * 0.4, s * 0.28 + robeWave)
    ctx.lineTo(s * 0.6, s * 0.18 + robeWave * 0.5)
    ctx.lineTo(s * 0.45, -s * 0.35)
    ctx.closePath()
    ctx.fill()

    // 内襟（米色交领）
    ctx.fillStyle = '#d8c8a8'
    ctx.beginPath()
    ctx.moveTo(-s * 0.18, -s * 0.35)
    ctx.lineTo(-s * 0.06, s * 0.12)
    ctx.lineTo(s * 0.06, s * 0.1)
    ctx.lineTo(s * 0.18, -s * 0.35)
    ctx.closePath()
    ctx.fill()

    // 腰带
    ctx.fillStyle = '#3d2a15'
    ctx.fillRect(-s * 0.45, -s * 0.2, s * 0.9, s * 0.08)
    ctx.fillStyle = '#6a5030'
    ctx.fillRect(-s * 0.38, -s * 0.19, s * 0.76, s * 0.05)
    // 腰佩玉环
    ctx.beginPath()
    ctx.arc(s * 0.35, -s * 0.16, s * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(120, 200, 150, 0.25)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(80, 150, 100, 0.3)'
    ctx.lineWidth = 0.6
    ctx.stroke()

    // === 身体 ===
    ctx.fillStyle = '#e8d5b7'
    ctx.fillRect(-s * 0.3, -s * 1.25, s * 0.6, s * 0.9)

    // === 头部 ===
    ctx.fillStyle = '#e8d5b7'
    ctx.beginPath()
    ctx.arc(0, -s * 1.5, s * 0.34, 0, Math.PI * 2)
    ctx.fill()

    // 发髻
    ctx.fillStyle = '#1a1010'
    ctx.beginPath()
    ctx.arc(0, -s * 1.6, s * 0.34, Math.PI, 0)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, -s * 1.75, s * 0.12, 0, Math.PI * 2)
    ctx.fill()
    // 发簪
    ctx.strokeStyle = '#c8a060'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-s * 0.15, -s * 1.7)
    ctx.lineTo(s * 0.15, -s * 1.78)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s * 0.16, -s * 1.78, s * 0.03, 0, Math.PI * 2)
    ctx.fillStyle = '#c8a060'
    ctx.fill()

    // 鬓发飘动
    const hairWave = this.frameCount * 0.04
    ctx.fillStyle = '#1a1010'
    ctx.beginPath()
    ctx.moveTo(-s * 0.3, -s * 1.55)
    ctx.quadraticCurveTo(
      -s * 0.6 + Math.sin(hairWave) * s * 0.08,
      -s * 1.25 + Math.sin(hairWave + 0.3) * s * 0.05,
      -s * 0.35 + Math.sin(hairWave * 1.1) * s * 0.1,
      -s * 0.95
    )
    ctx.lineTo(-s * 0.18, -s * 1.0)
    ctx.quadraticCurveTo(-s * 0.38, -s * 1.25, -s * 0.16, -s * 1.5)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * 0.3, -s * 1.55)
    ctx.quadraticCurveTo(
      s * 0.6 + Math.sin(hairWave + 1) * s * 0.08,
      -s * 1.25 + Math.sin(hairWave + 1.3) * s * 0.05,
      s * 0.35 + Math.sin(hairWave + 1.1) * s * 0.1,
      -s * 0.95
    )
    ctx.lineTo(s * 0.18, -s * 1.0)
    ctx.quadraticCurveTo(s * 0.38, -s * 1.25, s * 0.16, -s * 1.5)
    ctx.closePath()
    ctx.fill()

    // === 右臂前伸（御剑诀） ===
    ctx.strokeStyle = '#e8d5b7'
    ctx.lineWidth = s * 0.14
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(s * 0.22, -s * 0.88)
    ctx.quadraticCurveTo(s * 0.52, -s * 1.1, s * 0.78, -s * 0.95)
    ctx.stroke()
    // 袖子
    ctx.strokeStyle = '#4a4035'
    ctx.lineWidth = s * 0.24
    ctx.beginPath()
    ctx.moveTo(s * 0.16, -s * 0.8)
    ctx.quadraticCurveTo(s * 0.55, -s * 1.15, s * 0.85, -s * 0.88)
    ctx.stroke()
    // 袖口飘带
    const ribbonWave = this.frameCount * 0.06
    ctx.strokeStyle = 'rgba(200, 170, 120, 0.2)'
    ctx.lineWidth = s * 0.09
    ctx.beginPath()
    ctx.moveTo(s * 0.78, -s * 0.93)
    ctx.quadraticCurveTo(
      s * 1.08 + Math.sin(ribbonWave) * s * 0.1,
      -s * 0.78 + Math.sin(ribbonWave + 0.5) * s * 0.1,
      s * 1.18 + Math.sin(ribbonWave * 1.3) * s * 0.15,
      -s * 0.58
    )
    ctx.stroke()
    ctx.lineCap = 'butt'

    // === 左臂负手 ===
    ctx.strokeStyle = '#4a4035'
    ctx.lineWidth = s * 0.18
    ctx.beginPath()
    ctx.moveTo(-s * 0.28, -s * 0.8)
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.6, -s * 0.45, -s * 0.25)
    ctx.stroke()

    // === 剑光拖尾（金色剑气粒子） ===
    if (!this.isGameOver) {
      ctx.shadowBlur = 0
      const trail = 0.06 + 0.05 * Math.sin(this.frameCount * 0.08)
      ctx.fillStyle = `rgba(220, 180, 100, ${trail})`

      for (let i = 0; i < 3; i++) {
        const tx = -s * (1.8 + i * 0.45)
        const ty = Math.sin(this.frameCount * 0.1 + i * 0.8) * s * 0.15
        const tr = s * (0.28 - i * 0.07)
        ctx.beginPath()
        ctx.arc(tx, ty, tr, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = `rgba(240, 210, 140, ${trail * 0.4})`
      for (let i = 0; i < 5; i++) {
        const px = -s * (2 + Math.random() * 1.8)
        const py = Math.sin(this.frameCount * 0.05 + i * 1.2) * s * 0.35
        ctx.beginPath()
        ctx.arc(px, py, s * 0.12, 0, Math.PI * 2)
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
    this.obstaclesPassed = 0
    this.gameStarted = false
    this.player.y = this.h * 0.5
    this.player.vy = 0
    this.obstacles = []
    this.obstacleSpeed = 2.0
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
