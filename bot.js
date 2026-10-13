import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import express from 'express'
import P from 'pino'

const app = express()
const PORT = process.env.PORT || 10000

app.get('/', (req, res) => res.send('Bot is running! Check Render logs for pairing code.'))
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Chrome (Linux)', 'Chrome', ''],
        syncFullHistory: false,
    })

    sock.ev.on('creds.update', saveCreds)

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const phoneNumber = '2349166866082' // <--- CHANGE TO YOUR NUMBER WITHOUT + 
            try {
                let code = await sock.requestPairingCode(phoneNumber)
                console.log(`

PAIRING CODE: ${code}
Go to WhatsApp > Linked Devices > Link with phone number > Enter this code

`)
            } catch (err) {
                console.log('Pairing error', err.message)
            }
        }, 3000)
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Connection closed, reconnecting:', shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp!')
        }
    })

    // Your group commands here
    sock.ev.on('messages.upsert', async ({ messages }) => {
        // add your bot logic
    })
}

startBot()