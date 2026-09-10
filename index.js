const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const http = require('http')
const qrcode = require('qrcode-terminal')

// finto server per Render
http.createServer((req, res) => res.end('PAVE BOT ONLINE')).listen(process.env.PORT || 10000)

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['Pave Bot', 'Chrome', '1.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if(qr){
            console.log('--- QR CODE GENERATO, SCANSIONA! ---')
            qrcode.generate(qr, { small: true })
        }

        if(connection === 'close'){
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if(shouldReconnect) startBot()
        } else if(connection === 'open'){
            console.log('PAVE BOT WHATSAPP ONLINE 🔥')
        }
    })
}

startBot()
