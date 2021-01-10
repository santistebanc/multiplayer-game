// imports for server
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const path = require('path')

// imports for  phaser
require('@geckos.io/phaser-on-nodejs')
const { SnapshotInterpolation } = require('@geckos.io/snapshot-interpolation')
const SI = new SnapshotInterpolation()
const Phaser = require('phaser')

class Dude extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, '')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body.setSize(32, 48)
    this.setCollideWorldBounds(true)
  }
}

class ServerScene extends Phaser.Scene {
  constructor() {
    super()
    this.tick = 0
    this.players = new Map()
  }

  create() {
    this.physics.world.setBounds(0, 0, 1280, 720)

    io.on('connection', socket => {
      const x = Math.random() * 1200 + 40
      const dude = new Dude(this, x, 200)

      this.players.set(socket.id, {
        socket,
        dude
      })

      socket.on('movement', movement => {
        const { left, right, up, down } = movement
        const speed = 160
        const jump = 330

        if (left) dude.setVelocityX(-speed)
        else if (right) dude.setVelocityX(speed)
        else dude.setVelocityX(0)

        if (up)
          if (dude.body.touching.down || dude.body.onFloor())
            dude.setVelocityY(-jump)
      })

      socket.on('disconnect', reason => {
        const player = this.players.get(socket.id)
        player.dude.destroy()
        this.players.delete(socket.id)
      })
    })
  }

  update() {
    this.tick++

    // only send the update to the client at 30 FPS (save bandwidth)
    if (this.tick % 2 !== 0) return

    // get an array of all dudes
    const dudes = []
    this.players.forEach(player => {
      const { socket, dude } = player
      dudes.push({ id: socket.id, x: dude.x, y: dude.y })
    })

    const snapshot = SI.snapshot.create(dudes)

    // send all dudes to all players
    this.players.forEach(player => {
      const { socket } = player
      socket.emit('snapshot', snapshot)
    })
  }
}

const config = {
  type: Phaser.HEADLESS,
  width: 1280,
  height: 720,
  banner: false,
  audio: false,
  scene: [ServerScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 500 }
    }
  }
}

new Phaser.Game(config)

const PORT = process.env.PORT || 3000;

app.use('/', express.static(path.join(__dirname, '../client')))
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
