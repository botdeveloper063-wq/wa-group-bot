const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const express = require("express")
const P = require("pino")

const app = express()
app.get("/", (req, res) => res.send("WA Bot is Live! Check Logs for pairing code."))
app.listen(process.env.PORT || 3000, () => console.log("Web server running"))

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false
  })

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode("2349168666082")
        console.log("\n======================")
        console.log("PAIRING CODE: " + code)
        console.log("Go to WhatsApp > Linked Devices > Link with phone number > Enter code")
        console.log("======================\n")
      } catch(e) { console.log("Pairing error", e) }
    }, 3000)
  }

  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    } else if (connection === "open") {
      console.log("Bot connected to WhatsApp!")
    }
  })
}

startBot()