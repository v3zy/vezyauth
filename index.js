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

// --- DATABASE HELPER FUNCTIONS ---
function loadKeys() {
    try {
        if (!fs.existsSync(KEYS_FILE)) {
            fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: {} }, null, 2));
        }
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Database load error:", err);
        return { keys: {} };
    }
}

function saveKeys(data) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Database save error:", err);
    }
}

// --- TIME PARSER FUNCTION ---
// Supports: 10dakika, 5dakika, 30dakika, 1saat, 10saat, 1gun, 10gun, 1hafta, 10hafta, 1ay, 1yil, 10yil, etc.
function parseDuration(input) {
    if (!input) return null;
    const str = input.toLowerCase().trim();

    if (str === 'suresiz' || str === 'unlimited' || str === 'lifetime') {
        return { ms: Infinity, label: 'Süresiz (Lifetime)' };
    }

    const match = str.match(/^(\d+)\s*([a-zçğıöşü]+)$/i);
    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit = match[2];

    let ms = 0;
    let label = `${amount} `;

    if (unit.includes('dak') || unit === 'm' || unit === 'min') {
        ms = amount * 60 * 1000;
        label += 'Dakika';
    } else if (unit.includes('saat') || unit === 'h' || unit === 'hour') {
        ms = amount * 60 * 60 * 1000;
        label += 'Saat';
    } else if (unit.includes('gun') || unit.includes('gün') || unit === 'd' || unit === 'day') {
        ms = amount * 24 * 60 * 60 * 1000;
        label += 'Gün';
    } else if (unit.includes('hafta') || unit === 'w' || unit === 'week') {
        ms = amount * 7 * 24 * 60 * 60 * 1000;
        label += 'Hafta';
    } else if (unit.includes('ay') || unit === 'mo' || unit === 'month') {
        ms = amount * 30 * 24 * 60 * 60 * 1000;
        label += 'Ay';
    } else if (unit.includes('yil') || unit.includes('yıl') || unit === 'y' || unit === 'year') {
        ms = amount * 365 * 24 * 60 * 60 * 1000;
        label += 'Yıl';
    } else {
        return null;
    }

    return { ms, label };
}

// --- GENERATE RANDOM KEY ---
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = (len) => Array.from({ length: len }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `VEZY-${segment(4)}-${segment(4)}-${segment(4)}`;
}

// =========================================================================
//  EXPRESS WEB SERVER FOR RENDER.COM & UPTIME ROBOT + CLIENT KEY API
// =========================================================================

// UptimeRobot / Render Ping Endpoint (Keep Alive)
app.get('/', (req, res) => {
    res.status(200).send('VezyAuth Bot Server is 24/7 Active & Running!');
});

// Client Key Verification Endpoint (Called by VezyAuth in Client)
app.get('/api/checkkey', (req, res) => {
    const keyQuery = req.query.key;
    if (!keyQuery) {
        return res.status(400).json({ valid: false, reason: 'Key parameter missing' });
    }

    const db = loadKeys();
    const keyData = db.keys[keyQuery];

    if (!keyData) {
        return res.status(200).json({ valid: false, reason: 'Key not found' });
    }

    const now = Date.now();
    if (keyData.expiresAt !== 'lifetime' && now > keyData.expiresAt) {
        return res.status(200).json({ valid: false, reason: 'Key expired' });
    }

    return res.status(200).json({
        valid: true,
        user: keyData.userTag,
        expiresAt: keyData.expiresAt,
        durationLabel: keyData.durationLabel
    });
});

app.listen(PORT, () => {
    console.log(`[+] Express Server started on port ${PORT} for Render.com & UptimeRobot!`);
});

// =========================================================================
//  DISCORD BOT (DISCORD.JS v14)
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
    console.log(`[+] Discord Bot logged in as ${client.user.tag}!`);
    client.user.setActivity('VezyAuth Keys | .keyolustur', { type: 3 }); // Watching
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // -------------------------------------------------------------------------
    // COMMAND: .keyolustur @kullanici <sure>
    // Örnek: .keyolustur @deneme 10gun / .keyolustur @kullanici 1saat / 5dakika
    // -------------------------------------------------------------------------
    if (command === 'keyolustur' || command === 'createkey') {
        const targetUser = message.mentions.users.first();
        const durationInput = args[1] || args[0];

        if (!targetUser) {
            return message.reply('❌ **Kullanım Hatası!** Lütfen bir kullanıcı etiketleyin.\n**Örnek:** `.keyolustur @deneme 10gün` veya `.keyolustur @kullanici 1saat`');
        }

        if (!durationInput) {
            return message.reply('❌ **Kullanım Hatası!** Lütfen bir süre belirtin.\n**Örnekler:** `5dakika`, `1saat`, `10gün`, `1hafta`, `1ay`, `1yıl`, `süresiz`');
        }

        const parsed = parseDuration(durationInput);
        if (!parsed) {
            return message.reply('❌ **Geçersiz Süre Formatı!**\nGeçerli Örnekler: `5dakika`, `30dakika`, `1saat`, `10gün`, `2hafta`, `1yıl`, `süresiz`');
        }

        const newKey = generateKey();
        const now = Date.now();
        const expiresAt = (parsed.ms === Infinity) ? 'lifetime' : (now + parsed.ms);

        const db = loadKeys();
        db.keys[newKey] = {
            key: newKey,
            userId: targetUser.id,
            userTag: targetUser.tag,
            createdAt: now,
            expiresAt: expiresAt,
            durationLabel: parsed.label,
            createdBy: message.author.tag
        };
        saveKeys(db);

        const embed = new EmbedBuilder()
            .setTitle('✨ VezyAuth — Yeni Key Oluşturuldu!')
            .setColor(0x00FF66)
            .addFields(
                { name: '👤 Kullanıcı', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                { name: '⏳ Süre', value: `${parsed.label}`, inline: true },
                { name: '🔑 Lisans Key', value: `\`\`\`${newKey}\`\`\``, inline: false },
                { name: '📅 Son Kullanma', value: expiresAt === 'lifetime' ? 'Süresiz (Lifetime)' : `<t:${Math.floor(expiresAt / 1000)}:F> (<t:${Math.floor(expiresAt / 1000)}:R>)`, inline: false }
            )
            .setFooter({ text: `Oluşturan: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });

        // Try sending via DM as well
        try {
            await targetUser.send({
                content: `🎉 **Merhaba ${targetUser.username}!** Sana özel VezyAuth Lisans Key'in oluşturuldu:\n\n🔑 **Key:** \`${newKey}\`\n⏳ **Süre:** ${parsed.label}\n\nClient girerken bu key'i kullanabilirsin.`
            });
        } catch (e) {
            // User DM closed
        }
    }

    // -------------------------------------------------------------------------
    // COMMAND: .keybilgi <key>
    // -------------------------------------------------------------------------
    if (command === 'keybilgi' || command === 'keyinfo') {
        const keyArg = args[0];
        if (!keyArg) return message.reply('❌ Lütfen sorgulanacak key\'i girin. **Örnek:** `.keybilgi VEZY-XXXX-XXXX-XXXX`');

        const db = loadKeys();
        const keyData = db.keys[keyArg];

        if (!keyData) return message.reply('❌ Sistemde bu key bulunamadı!');

        const isExpired = keyData.expiresAt !== 'lifetime' && Date.now() > keyData.expiresAt;
        const statusStr = isExpired ? '🔴 Süresi Dolmuş (Expired)' : '🟢 Aktif (Active)';

        const embed = new EmbedBuilder()
            .setTitle('🔍 VezyAuth Key Bilgisi')
            .setColor(isExpired ? 0xFF0033 : 0x00AAFF)
            .addFields(
                { name: '🔑 Key', value: `\`${keyData.key}\``, inline: false },
                { name: '👤 Sahibi', value: `<@${keyData.userId}> (${keyData.userTag})`, inline: true },
                { name: '📌 Durum', value: statusStr, inline: true },
                { name: '⏳ Tanımlı Süre', value: keyData.durationLabel || 'Bilinmiyor', inline: true },
                { name: '📅 Son Kullanma', value: keyData.expiresAt === 'lifetime' ? 'Süresiz' : `<t:${Math.floor(keyData.expiresAt / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    // -------------------------------------------------------------------------
    // COMMAND: .keysil <key>
    // -------------------------------------------------------------------------
    if (command === 'keysil' || command === 'deletekey') {
        const keyArg = args[0];
        if (!keyArg) return message.reply('❌ Lütfen silinecek key\'i girin. **Örnek:** `.keysil VEZY-XXXX-XXXX-XXXX`');

        const db = loadKeys();
        if (!db.keys[keyArg]) return message.reply('❌ Silinecek key bulunamadı!');

        delete db.keys[keyArg];
        saveKeys(db);

        message.reply(`✅ \`${keyArg}\` key'i başarıyla sistemden silindi!`);
    }

    // -------------------------------------------------------------------------
    // COMMAND: .keyliste
    // -------------------------------------------------------------------------
    if (command === 'keyliste' || command === 'keylist') {
        const db = loadKeys();
        const keysArr = Object.values(db.keys);

        if (keysArr.length === 0) return message.reply('ℹ️ Sistemde kayıtlı hiçbir key bulunmuyor.');

        let listStr = '';
        keysArr.slice(-15).forEach((k, idx) => {
            const isExp = k.expiresAt !== 'lifetime' && Date.now() > k.expiresAt;
            listStr += `${idx + 1}. \`${k.key}\` — <@${k.userId}> (${k.durationLabel}) [${isExp ? 'EXPIRED' : 'ACTIVE'}]\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle(`📜 VezyAuth Kayıtlı Key Listesi (${keysArr.length})`)
            .setColor(0xAA00FF)
            .setDescription(listStr)
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// LOGIN BOT
if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'BOT_TOKENINIZI_BURAYA_YAZIN') {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error("Bot Login Error:", err.message);
    });
} else {
    console.log("[!] Lutfen .env dosyasina DISCORD_TOKEN giriniz!");
}
