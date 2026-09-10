import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const db = { users: {} };
function getUser(id){
  if(!db.users[id]) db.users[id] = { cars: [], slots: [], aura: 0, balance: 1000 };
  return db.users[id];
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if(connection === 'close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    } else if(connection === 'open'){
      console.log('PAVE BOT WHATSAPP ONLINE 🔥');
    }
  });

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;
    const userId = sender;
    const u = getUser(userId);
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
      reply = `ACCOUNT:\nID: ${userId}\nCars: ${u.cars.length}\nAura: ${u.aura}\nBalance: ${u.balance}`;
    }

    if(reply){
      await sock.sendMessage(sender, { text: reply });
    }
  });
}

startBot();
