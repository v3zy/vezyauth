# 🚀 VezyAuth Discord Bot (Render.com + UptimeRobot 7/24 Host Rehberi)

Bu bot, VezyAuth hilesinin lisans sistemini Discord üzerinden yönetir ve Render.com + UptimeRobot ile 7/24 tamamen ücretsiz çalışacak şekilde tasarlanmıştır.

---

## 🛠️ 1. Yerelde Çalıştırma ve Test Etme (Local Test)

1. Masaüstündeki `bot` klasöründe terminal açın (`cmd` veya `powershell`).
2. Gerekli kütüphaneleri yükleyin:
   ```bash
   npm install
   ```
3. `.env` dosyasını açın ve Discord Bot Token'ınızı girin:
   ```env
   DISCORD_TOKEN=MTA... (Discord Developer Portal'dan aldığınız Bot Token)
   PORT=3000
   ```
4. Botu başlatın:
   ```bash
   node index.js
   ```

---

## 🌐 2. Render.com Üzerinde 7/24 Ücretsiz Host Etme (GitHub Yüklemesi)

1. Masaüstündeki `bot` klasörünü yeni bir **GitHub Repository** oluşturup push edin:
   ```bash
   git init
   git add .
   git commit -m "VezyAuth Bot Initial Commit"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADI/vezyauth-bot.git
   git push -u origin main
   ```

2. [Render.com](https://render.com) sitesine ücretsiz üye olun ve giriş yapın.
3. **New +** butonuna basıp **Web Service** seçeneğini seçin.
4. GitHub hesabınızı bağlayın ve `vezyauth-bot` projenizi seçin.
5. Ayarları şu şekilde yapın:
   - **Name:** `vezyauth-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
6. **Environment Variables** kısmına gidin:
   - Key: `DISCORD_TOKEN`, Value: `[Discord Bot Token'ınız]`
7. **Create Web Service** butonuna basın. Render.com projenizi derleyip yayınlayacak ve size bir URL verecektir (Örnek: `https://vezyauth-bot.onrender.com`).

---

## ⏰ 3. UptimeRobot ile Botu 7/24 Kesintisiz Açık Tutma

1. [UptimeRobot.com](https://uptimerobot.com) sitesine gidin (Ücretsiz).
2. **Add New Monitor** butonuna tıklayın:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `VezyAuth Bot`
   - **URL (or IP):** `https://vezyauth-bot.onrender.com` (Render.com'un verdiği URL)
   - **Monitoring Interval:** `5 minutes`
3. **Create Monitor** butonuna basın.
4. Artık UptimeRobot her 5 dakikada bir botunuza HTTP isteği atarak Render.com'un uyumasını engelleyecek ve botunuz **7/24 kesintisiz çalışacaktır**!

---

## 💬 4. Discord Bot Komutları

| Komut | Açıklama | Örnek |
|---|---|---|
| `.keyolustur @kullanici <sure>` | Etiketlenen kullanıcıya özel key oluşturur. | `.keyolustur @deneme 10gün` / `.keyolustur @user 1saat` / `5dakika` / `1hafta` / `1yıl` / `süresiz` |
| `.keybilgi <key>` | Key'in kime ait olduğunu ve kalan süresini gösterir. | `.keybilgi VEZY-A1B2-C3D4-E5F6` |
| `.keysil <key>` | Belirtilen key'i veritabanından siler. | `.keysil VEZY-A1B2-C3D4-E5F6` |
| `.keyliste` | Kayıtlı tüm key'leri listeler. | `.keyliste` |

---

## 🔒 5. VezyAuth Client Entegrasyonu

C++ Client (`Lyra.dll`) içerisindeki `AuthManager.cpp`, botun sunduğu `/api/checkkey?key=...` uç noktasına otomatik istek atarak girilen key'in geçerliliğini ve süresini doğrular.
