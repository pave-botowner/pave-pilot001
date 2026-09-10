const http = require('http');
let latestQR = null;

http.createServer((req, res) => {
  if(latestQR){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`<center><h1>SCANSIONA QR PAVE PILOT</h1><img src="${latestQR}" style="width:320px;border:8px solid black"><br><p>WhatsApp > Dispositivi collegati > Collega</p></center><script>setTimeout(()=>location.reload(), 10000)</script>`);
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<h1>PAVE BOT ONLINE 🔥</h1><p>Bot connesso! Se non sei connesso, in attesa di QR...</p>');
  }
}).listen(process.env.PORT || 10000, () => console.log('Web server ON'));

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const QRCode = require('qrcode')

const db = { users: {} };
function getUser(id){
  if(!db.users[id]) db.users[id] = { cars: [], slots: [], aura: 0, balance: 1000 };
  return db.users[id];
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: ['Pave Bot', 'Chrome', '1.0'] });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      console.log('QR GENERATO - Vai su https://pave-pilot001.onrender.com');
      latestQR = await QRCode.toDataURL(qr);
    }
    if(connection === 'close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    } else if(connection === 'open'){
      latestQR = null;
      console.log('PAVE BOT WHATSAPP ONLINE 🔥');
    }
  });

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;
    const u = getUser(sender);
    const lower = text.toLowerCase().trim();
    let reply = '';

    if(lower === '/menu' || lower === 'menu'){
      reply = `🏁 PAVE PILOT - MAIN MENU\n\n/carm - Menu Macchine\n/slotm - Menu Slot\n/funm - Menu Fun\n/utym - Menu Utility`;
    }
    else if(lower.startsWith('/carm')){
      reply = `🚗 CAR MENU\n\n/cars - tue macchine\n/carshop - negozio\n/buycar <nome>\n/sellcar <nome>`;
    }
    else if(lower === '/cars'){
      reply = u.cars.length? `Le tue cars: ${u.cars.join(', ')}` : 'Non hai cars, vai su /carshop';
    }
    else if(lower === '/carshop'){
      reply = `CARSHOP:\n- Panda - 500\n- M3 - 2000\n- Supra - 5000`;
    }
    else if(lower.startsWith('/buycar')){
      const name = text.split(' ')[1] || 'Panda';
      u.cars.push(name);
      reply = `Hai comprato ${name}! 🏁`;
    }
    else if(lower.startsWith('/slotm')){
      reply = `🎰 SLOT MENU\n\n/slot - tuoi slot\n/slotshop\n/buyslot`;
    }
    else if(lower === '/slot'){
      reply = `Hai ${u.slots.length} slot`;
    }
    else if(lower.startsWith('/funm')){
      reply = `🎲 FUN MENU\n\n/luck\n/aura\n/myaura`;
    }
    else if(lower === '/luck'){
      reply = `Fortuna: ${Math.floor(Math.random()*100)}% 🍀`;
    }
    else if(lower === '/aura'){
      const add = Math.floor(Math.random()*50);
      u.aura += add;
      reply = `+${add} aura! Ora hai ${u.aura}`;
    }
    else if(lower === '/myaura'){
      reply = `La tua aura: ${u.aura} ✨`;
    }
    else if(lower.startsWith('/utym')){
      reply = `🛠️ UTY MENU\n\n/stick\n/frame - frame foto profilo\n/pinall - pinna tutto\n/myacc - tuo account`;
    }
    else if(lower === '/frame'){
      reply = `FRAME: manda una foto e ti metto il frame PAVE! 🖼️ (in arrivo)`;
    }
    else if(lower === '/pinall'){
      reply = `PINALL: devo pinnare tutto 😎`;
    }
    else if(lower === '/myacc'){
      reply = `ACCOUNT:\nID: ${sender}\nCars: ${u.cars.length}\nAura: ${u.aura}\nBalance: ${u.balance}`;
    }

    if(reply){
      await sock.sendMessage(sender, { text: reply });
    }
  });
}
startBot();
