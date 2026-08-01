import os
import json
import random
import string
import time
import re
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import discord
from discord.ext import commands

# =========================================================================
#  EXPRESS/FLASK SERVER FOR RENDER.COM & UPTIME ROBOT + CLIENT KEY API
# =========================================================================
app = Flask(__name__)
CORS(app)

KEYS_FILE = os.path.join(os.path.dirname(__file__), 'keys.json')

def load_keys():
    if not os.path.exists(KEYS_FILE):
        with open(KEYS_FILE, 'w', encoding='utf-8') as f:
            json.dump({"keys": {}}, f, indent=2)
    try:
        with open(KEYS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading keys: {e}")
        return {"keys": {}}

def save_keys(data):
    try:
        with open(KEYS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving keys: {e}")

@app.route('/')
def home():
    return "VezyAuth Bot Server is 24/7 Active & Running!", 200

@app.route('/api/checkkey', methods=['GET'])
def check_key():
    key_query = request.args.get('key')
    if not key_query:
        return jsonify({"valid": False, "reason": "Key parameter missing"}), 400

    db = load_keys()
    key_data = db.get("keys", {}).get(key_query)

    if not key_data:
        return jsonify({"valid": False, "reason": "Key not found"}), 200

    now = time.time() * 1000
    expires_at = key_data.get("expiresAt")

    if expires_at != "lifetime" and now > float(expires_at):
        return jsonify({"valid": False, "reason": "Key expired"}), 200

    return jsonify({
        "valid": True,
        "user": key_data.get("userTag"),
        "expiresAt": expires_at,
        "durationLabel": key_data.get("durationLabel")
    }), 200

def run_flask():
    port = int(os.environ.get("PORT", 3000))
    app.run(host='0.0.0.0', port=port)

# Start Flask in background thread
threading.Thread(target=run_flask, daemon=True).start()

// --- TIME PARSER ---
def parse_duration(input_str):
    if not input_str:
        return None
    s = input_str.lower().strip()

    if s in ['suresiz', 'unlimited', 'lifetime']:
        return {"ms": float('inf'), "label": "Süresiz (Lifetime)"}

    match = re.match(r'^(\d+)\s*([a-zçğıöşü]+)$', s)
    if not match:
        return None

    amount = int(match.group(1))
    unit = match.group(2)

    ms = 0
    label = f"{amount} "

    if 'dak' in unit or unit in ['m', 'min']:
        ms = amount * 60 * 1000
        label += "Dakika"
    elif 'saat' in unit or unit in ['h', 'hour']:
        ms = amount * 60 * 60 * 1000
        label += "Saat"
    elif 'gun' in unit or 'gün' in unit or unit in ['d', 'day']:
        ms = amount * 24 * 60 * 60 * 1000
        label += "Gün"
    elif 'hafta' in unit or unit in ['w', 'week']:
        ms = amount * 7 * 24 * 60 * 60 * 1000
        label += "Hafta"
    elif 'ay' in unit or unit in ['mo', 'month']:
        ms = amount * 30 * 24 * 60 * 60 * 1000
        label += "Ay"
    elif 'yil' in unit or 'yıl' in unit or unit in ['y', 'year']:
        ms = amount * 365 * 24 * 60 * 60 * 1000
        label += "Yıl"
    else:
        return None

    return {"ms": ms, "label": label}

def generate_key():
    chars = string.ascii_uppercase + string.digits
    seg = lambda l: ''.join(random.choice(chars) for _ in range(l))
    return f"VEZY-{seg(4)}-{seg(4)}-{seg(4)}"

# =========================================================================
#  DISCORD BOT (DISCORD.PY)
# =========================================================================
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='.', intents=intents)

@bot.event
async def on_ready():
    print(f"[+] Discord Bot ready as {bot.user}")
    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.watching, name="VezyAuth Keys | .keyolustur"))

@bot.command(name='keyolustur')
async def keyolustur(ctx, member: discord.Member = None, duration: str = None):
    if not member:
        await ctx.reply("❌ **Kullanım Hatası!** Lütfen bir kullanıcı etiketleyin.\n**Örnek:** `.keyolustur @deneme 10gün` veya `.keyolustur @user 1saat`")
        return
    if not duration:
        await ctx.reply("❌ **Kullanım Hatası!** Lütfen bir süre belirtin.\n**Örnekler:** `5dakika`, `1saat`, `10gün`, `1hafta`, `1ay`, `1yıl`, `süresiz`")
        return

    parsed = parse_duration(duration)
    if not parsed:
        await ctx.reply("❌ **Geçersiz Süre Formatı!**\nGeçerli Örnekler: `5dakika`, `30dakika`, `1saat`, `10gün`, `2hafta`, `1yıl`, `süresiz`")
        return

    new_key = generate_key()
    now = time.time() * 1000
    expires_at = "lifetime" if parsed["ms"] == float('inf') else (now + parsed["ms"])

    db = load_keys()
    if "keys" not in db:
        db["keys"] = {}

    db["keys"][new_key] = {
        "key": new_key,
        "userId": str(member.id),
        "userTag": str(member),
        "createdAt": now,
        "expiresAt": expires_at,
        "durationLabel": parsed["label"],
        "createdBy": str(ctx.author)
    }
    save_keys(db)

    embed = discord.Embed(title="✨ VezyAuth — Yeni Key Oluşturuldu!", color=0x00FF66)
    embed.add_field(name="👤 Kullanıcı", value=f"<@{member.id}> ({member})", inline=True)
    embed.add_field(name="⏳ Süre", value=f"{parsed['label']}", inline=True)
    embed.add_field(name="🔑 Lisans Key", value=f"```\n{new_key}\n```", inline=False)
    
    if expires_at == "lifetime":
        embed.add_field(name="📅 Son Kullanma", value="Süresiz (Lifetime)", inline=False)
    else:
        exp_ts = int(expires_at / 1000)
        embed.add_field(name="📅 Son Kullanma", value=f"<t:{exp_ts}:F> (<t:{exp_ts}:R>)", inline=False)
    
    embed.set_footer(text=f"Oluşturan: {ctx.author}")
    await ctx.send(embed=embed)

    try:
        await member.send(f"🎉 **Merhaba {member.name}!** Sana özel VezyAuth Lisans Key'in oluşturuldu:\n\n🔑 **Key:** `{new_key}`\n⏳ **Süre:** {parsed['label']}\n\nClient girerken bu key'i kullanabilirsin.")
    except Exception:
        pass

@bot.command(name='keybilgi')
async def keybilgi(ctx, key_str: str = None):
    if not key_str:
        await ctx.reply("❌ Lütfen sorgulanacak key'i girin. **Örnek:** `.keybilgi VEZY-XXXX-XXXX-XXXX`__")
        return

    db = load_keys()
    key_data = db.get("keys", {}).get(key_str)

    if not key_data:
        await ctx.reply("❌ Sistemde bu key bulunamadı!")
        return

    now = time.time() * 1000
    is_expired = key_data.get("expiresAt") != "lifetime" and now > float(key_data.get("expiresAt"))
    status_str = "🔴 Süresi Dolmuş (Expired)" if is_expired else "🟢 Aktif (Active)"

    embed = discord.Embed(title="🔍 VezyAuth Key Bilgisi", color=0xFF0033 if is_expired else 0x00AAFF)
    embed.add_field(name="🔑 Key", value=f"`{key_data['key']}`", inline=False)
    embed.add_field(name="👤 Sahibi", value=f"<@{key_data['userId']}> ({key_data['userTag']})", inline=True)
    embed.add_field(name="📌 Durum", value=status_str, inline=True)
    embed.add_field(name="⏳ Tanımlı Süre", value=key_data.get('durationLabel', 'Bilinmiyor'), inline=True)

    await ctx.send(embed=embed)

@bot.command(name='keysil')
async def keysil(ctx, key_str: str = None):
    if not key_str:
        await ctx.reply("❌ Lütfen silinecek key'i girin. **Örnek:** `.keysil VEZY-XXXX-XXXX-XXXX`__")
        return

    db = load_keys()
    if key_str not in db.get("keys", {}):
        await ctx.reply("❌ Silinecek key bulunamadı!")
        return

    del db["keys"][key_str]
    save_keys(db)
    await ctx.reply(f"✅ `{key_str}` key'i başarıyla sistemden silindi!")

@bot.command(name='keyliste')
async def keyliste(ctx):
    db = load_keys()
    keys_arr = list(db.get("keys", {}).values())

    if not keys_arr:
        await ctx.reply("ℹ️ Sistemde kayıtlı hiçbir key bulunmuyor.")
        return

    list_str = ""
    now = time.time() * 1000
    for idx, k in enumerate(keys_arr[-15:], 1):
        is_exp = k.get("expiresAt") != "lifetime" and now > float(k.get("expiresAt"))
        list_str += f"{idx}. `{k['key']}` — <@{k['userId']}> ({k.get('durationLabel')}) [{'EXPIRED' if is_exp else 'ACTIVE'}]\n"

    embed = discord.Embed(title=f"📜 VezyAuth Kayıtlı Key Listesi ({len(keys_arr)})", color=0xAA00FF, description=list_str)
    await ctx.send(embed=embed)

TOKEN = os.environ.get("DISCORD_TOKEN", "BOT_TOKENINIZI_BURAYA_YAZIN")
if TOKEN and TOKEN != "BOT_TOKENINIZI_BURAYA_YAZIN":
    bot.run(TOKEN)
else:
    print("[!] Lutfen .env dosyasina veya environment variables'a DISCORD_TOKEN giriniz!")
