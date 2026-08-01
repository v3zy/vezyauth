require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const KEYS_FILE = path.join(__dirname, 'keys.json');

// --- KİM KURABİLİR KONTROLÜ ---
// Sadece sunucu kurucusu (owner) yapabilir
function isOwner(message) {
    if (!message.guild) return false;
    return message.guild.ownerId === message.author.id;
}

// --- DATABASE ---
function loadKeys() {
    try {
        if (!fs.existsSync(KEYS_FILE)) {
            fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: {} }, null, 2));
        }
        return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    } catch (err) {
        return { keys: {} };
    }
}

function saveKeys(data) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Save error:", err);
    }
}

// --- SÜRE AYRIŞTIRICISI ---
function parseDuration(input) {
    if (!input) return null;
    const str = input.toLowerCase().trim();

    if (['suresiz', 'unlimited', 'lifetime'].includes(str)) {
        return { ms: Infinity, label: 'Süresiz (Lifetime)' };
    }

    const match = str.match(/^(\d+)\s*([a-zçğıöşü]+)$/i);
    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit = match[2];
    let ms = 0, label = `${amount} `;

    if (unit.includes('dak') || unit === 'm' || unit === 'min')        { ms = amount * 60 * 1000;                    label += 'Dakika'; }
    else if (unit.includes('saat') || unit === 'h' || unit === 'hour') { ms = amount * 60 * 60 * 1000;               label += 'Saat'; }
    else if (unit.includes('gun') || unit.includes('gün') || unit === 'd') { ms = amount * 24 * 60 * 60 * 1000;     label += 'Gün'; }
    else if (unit.includes('hafta') || unit === 'w')                   { ms = amount * 7 * 24 * 60 * 60 * 1000;     label += 'Hafta'; }
    else if (unit.includes('ay') || unit === 'mo')                     { ms = amount * 30 * 24 * 60 * 60 * 1000;    label += 'Ay'; }
    else if (unit.includes('yil') || unit.includes('yıl') || unit === 'y') { ms = amount * 365 * 24 * 60 * 60 * 1000; label += 'Yıl'; }
    else return null;

    return { ms, label };
}

// --- KEY ÜRETICI ---
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg = (l) => Array.from({ length: l }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `VEZY-${seg(4)}-${seg(4)}-${seg(4)}`;
}

// =========================================================================
//  EXPRESS - RENDER.COM & UPTİMEROBOT + KEY API
// =========================================================================
app.get('/', (req, res) => res.status(200).send('VezyAuth Bot 24/7 Active!'));

app.get('/api/checkkey', (req, res) => {
    const keyQuery = req.query.key;
    if (!keyQuery) return res.status(400).json({ valid: false, reason: 'Key missing' });

    const db = loadKeys();
    const keyData = db.keys[keyQuery];
    if (!keyData) return res.json({ valid: false, reason: 'Key not found' });

    if (keyData.expiresAt !== 'lifetime' && Date.now() > keyData.expiresAt) {
        return res.json({ valid: false, reason: 'Key expired' });
    }

    return res.json({ valid: true, user: keyData.userTag, expiresAt: keyData.expiresAt, durationLabel: keyData.durationLabel });
});

app.listen(PORT, () => console.log(`[+] Server running on port ${PORT}`));

// =========================================================================
//  DISCORD BOT
// =========================================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const PREFIX = '.';

client.once('ready', () => {
    console.log(`[+] Bot aktif: ${client.user.tag}`);
    client.user.setActivity('VezyAuth | .keyolustur', { type: 3 });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // -----------------------------------------------------------------------
    // .keyolustur @kullanici <sure>  →  SADECE KURUCU
    // -----------------------------------------------------------------------
    if (command === 'keyolustur') {
        // Mesajı hemen sil
        try { await message.delete(); } catch {}

        if (!isOwner(message)) {
            try { await message.author.send('❌ Bu komutu sadece **sunucu kurucusu** kullanabilir!'); } catch {}
            return;
        }

        const targetUser = message.mentions.users.first();
        const durationInput = args[1] || args[0];

        if (!targetUser) {
            try { await message.author.send('❌ **Kullanım:** `.keyolustur @kullanici 10gun`'); } catch {}
            return;
        }
        if (!durationInput) {
            try { await message.author.send('❌ **Süre belirt:** `5dakika`, `1saat`, `10gun`, `1hafta`, `1yil`, `suresiz`'); } catch {}
            return;
        }

        const parsed = parseDuration(durationInput);
        if (!parsed) {
            try { await message.author.send('❌ **Geçersiz süre!** Örnek: `5dakika`, `1saat`, `10gun`, `suresiz`'); } catch {}
            return;
        }

        const newKey = generateKey();
        const now = Date.now();
        const expiresAt = parsed.ms === Infinity ? 'lifetime' : now + parsed.ms;

        const db = loadKeys();
        db.keys[newKey] = {
            key: newKey,
            userId: targetUser.id,
            userTag: targetUser.tag,
            createdAt: now,
            expiresAt,
            durationLabel: parsed.label,
            createdBy: message.author.tag
        };
        saveKeys(db);

        const embed = new EmbedBuilder()
            .setTitle('✨ VezyAuth — Yeni Key Oluşturuldu!')
            .setColor(0x00FF66)
            .addFields(
                { name: '👤 Kullanıcı', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                { name: '⏳ Süre', value: parsed.label, inline: true },
                { name: '🔑 Key', value: `\`\`\`${newKey}\`\`\``, inline: false },
                { name: '📅 Son Kullanma', value: expiresAt === 'lifetime' ? 'Süresiz' : `<t:${Math.floor(expiresAt / 1000)}:F> (<t:${Math.floor(expiresAt / 1000)}:R>)`, inline: false }
            )
            .setFooter({ text: `Oluşturan: ${message.author.tag}` })
            .setTimestamp();

        // Sana (kurucu) DM
        try { await message.author.send({ embeds: [embed] }); } catch {}

        // Key alan kullanıcıya DM
        try {
            await targetUser.send(`🎉 **Merhaba ${targetUser.username}!**\n\n🔑 **Key:** \`${newKey}\`\n⏳ **Süre:** ${parsed.label}\n\nVezyAuth ekranına bu key'i gir!`);
        } catch {}
    }

    // -----------------------------------------------------------------------
    // .keybilgi <key>  →  HERKES KULLANABİLİR (sadece kendi key'ini görür)
    //                      Kurucu herkesinkini görebilir
    // -----------------------------------------------------------------------
    if (command === 'keybilgi') {
        try { await message.delete(); } catch {}

        const keyArg = args[0];
        if (!keyArg) {
            try { await message.author.send('❌ Kullanım: `.keybilgi VEZY-XXXX-XXXX-XXXX`'); } catch {}
            return;
        }

        const db = loadKeys();
        const keyData = db.keys[keyArg];

        if (!keyData) {
            try { await message.author.send('❌ Bu key sistemde bulunamadı!'); } catch {}
            return;
        }

        // Kurucu değilse sadece kendi key'ini görebilir
        if (!isOwner(message) && keyData.userId !== message.author.id) {
            try { await message.author.send('❌ Bu key sana ait değil!'); } catch {}
            return;
        }

        const isExpired = keyData.expiresAt !== 'lifetime' && Date.now() > keyData.expiresAt;

        const embed = new EmbedBuilder()
            .setTitle('🔍 VezyAuth Key Bilgisi')
            .setColor(isExpired ? 0xFF0033 : 0x00AAFF)
            .addFields(
                { name: '🔑 Key', value: `\`${keyData.key}\``, inline: false },
                { name: '👤 Sahibi', value: `<@${keyData.userId}> (${keyData.userTag})`, inline: true },
                { name: '📌 Durum', value: isExpired ? '🔴 Süresi Dolmuş' : '🟢 Aktif', inline: true },
                { name: '⏳ Süre', value: keyData.durationLabel || '?', inline: true },
                { name: '📅 Son Kullanma', value: keyData.expiresAt === 'lifetime' ? 'Süresiz' : `<t:${Math.floor(keyData.expiresAt / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        // Sadece DM olarak gönder (kanalda görünmez)
        try { await message.author.send({ embeds: [embed] }); } catch {}
    }

    // -----------------------------------------------------------------------
    // .keysil <key>  →  SADECE KURUCU
    // -----------------------------------------------------------------------
    if (command === 'keysil') {
        try { await message.delete(); } catch {}

        if (!isOwner(message)) {
            try { await message.author.send('❌ Bu komutu sadece **sunucu kurucusu** kullanabilir!'); } catch {}
            return;
        }

        const keyArg = args[0];
        if (!keyArg) {
            try { await message.author.send('❌ Kullanım: `.keysil VEZY-XXXX-XXXX-XXXX`'); } catch {}
            return;
        }

        const db = loadKeys();
        if (!db.keys[keyArg]) {
            try { await message.author.send('❌ Silinecek key bulunamadı!'); } catch {}
            return;
        }

        const deletedUser = db.keys[keyArg].userTag;
        delete db.keys[keyArg];
        saveKeys(db);

        try { await message.author.send(`✅ \`${keyArg}\` key'i silindi! (Sahip: ${deletedUser})`); } catch {}
    }

    // -----------------------------------------------------------------------
    // .keyliste  →  SADECE KURUCU
    // -----------------------------------------------------------------------
    if (command === 'keyliste') {
        try { await message.delete(); } catch {}

        if (!isOwner(message)) {
            try { await message.author.send('❌ Bu komutu sadece **sunucu kurucusu** kullanabilir!'); } catch {}
            return;
        }

        const db = loadKeys();
        const keysArr = Object.values(db.keys);

        if (keysArr.length === 0) {
            try { await message.author.send('ℹ️ Sistemde kayıtlı key yok.'); } catch {}
            return;
        }

        const now = Date.now();
        let listStr = '';
        keysArr.slice(-15).forEach((k, idx) => {
            const isExp = k.expiresAt !== 'lifetime' && now > k.expiresAt;
            listStr += `${idx + 1}. \`${k.key}\` — ${k.userTag} (${k.durationLabel}) [${isExp ? '❌ EXPIRED' : '✅ ACTIVE'}]\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`📜 Key Listesi — Toplam: ${keysArr.length}`)
            .setColor(0xAA00FF)
            .setDescription(listStr)
            .setTimestamp();

        try { await message.author.send({ embeds: [embed] }); } catch {}
    }
});

// LOGIN
const TOKEN = process.env.DISCORD_TOKEN;
if (TOKEN && TOKEN !== 'BOT_TOKENINIZI_BURAYA_YAZIN') {
    client.login(TOKEN).catch(err => console.error("Login Error:", err.message));
} else {
    console.log("[!] .env dosyasına DISCORD_TOKEN gir!");
}
