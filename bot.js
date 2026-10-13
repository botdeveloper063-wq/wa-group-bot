const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const yts = require('yt-search')
const ytdl = require('ytdl-core')
const fs = require('fs')

const OWNERS = ["23407083192726@s.whatsapp.net"]
const PAIR_NUMBER = "2347083192726" // YOUR NUMBER WITHOUT @ - SAME AS OWNER, NO SPACES

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({ logger: P({ level: 'silent' }), auth: state, printQRInTerminal: false, browser: ["Ubuntu","Chrome","20.0"] })
  sock.ev.on('creds.update', saveCreds)

  if (!sock.authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(PAIR_NUMBER)
      console.log(`\n\n========================================\nYOUR PAIRING CODE: ${code}\n========================================\n\nGo to WhatsApp > Linked Devices > Link a device > Link with phone number instead > Enter: ${code}\n\n`)
    } catch(e){ console.log("Failed to get pairing code", e) }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log('Bot Connected ✅')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ''
    if (!body.startsWith('.')) return
    const args = body.slice(1).trim().split(/ +/)
    const command = args.shift().toLowerCase()

    if (command === 'menu' || command === 'help') {
      await sock.sendMessage(from, { text: `*WA GROUP BOT MENU* 🤖\n\n.meme\n.play <song>\n.tagall - tag all members\n.kick @user\n.link - group link\n.hidetag <msg>` })
    }
    if (command === 'tagall') {
      if (!isGroup) return
      const metadata = await sock.groupMetadata(from)
      const participants = metadata.participants.map(p => p.id)
      let text = args.join(' ') || 'Attention Everyone 📢\n\n'
      await sock.sendMessage(from, { text: text, mentions: participants })
    }
    if (command === 'play' || command === 'song') {
      if (!args[0]) return sock.sendMessage(from, { text: 'Give song name. Ex:.play calm down' })
      try {
        const search = await yts(args.join(' '))
        const video = search.videos[0]
        if (!video) return sock.sendMessage(from, { text: 'Not found' })
        await sock.sendMessage(from, { text: `*Found:* ${video.title}\nDownloading... ⏳` })
        const stream = ytdl(video.url, { filter: 'audioonly' })
        const fileName = './song.mp3'
        const write = fs.createWriteStream(fileName)
        stream.pipe(write)
        write.on('finish', async () => {
          await sock.sendMessage(from, { audio: fs.readFileSync(fileName), mimetype: 'audio/mpeg' }, { quoted: m })
        })
      } catch (e) { await sock.sendMessage(from, { text: 'Error downloading song' }) }
    }
    if (command === 'kick') {
      if (!isGroup) return
      const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
      if (!mentioned) return sock.sendMessage(from, { text: 'Tag person to kick' })
      await sock.groupParticipantsUpdate(from, mentioned, 'remove')
      await sock.sendMessage(from, { text: 'Kicked ✅' })
    }
    if (command === 'link') {
      if (!isGroup) return
      const code = await sock.groupInviteCode(from)
      await sock.sendMessage(from, { text: `https://chat.whatsapp.com/${code}` })
    }
  })
}
startBot()