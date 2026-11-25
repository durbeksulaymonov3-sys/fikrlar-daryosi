# Fikrlar Devori

Fikr qoldirish va yoqtirish sahifasi. Sahifa Netlify'da, ma'lumotlar MySQL'da saqlanadi.

## Tuzilishi

```
public/index.html              sahifa
netlify/functions/api.js       MySQL bilan gaplashadigan funksiya
schema.sql                     jadvallar
netlify.toml, package.json     sozlamalar
```

## O'rnatish

1. **MySQL.** Internetdan ulanish mumkin bo'lgan MySQL bazasi kerak (Netlify funksiyalari bulutda ishlaydi, shuning uchun `localhost` ishlamaydi). Bazada `schema.sql` faylini bir marta ishga tushiring.

2. **Yuklash.** Papkani GitHub'ga yuklang va Netlify'da "Add new site, Import an existing project" orqali ulang. Netlify `mysql2` paketini o'zi o'rnatadi. Yoki terminalda:
   ```
   npm install
   npx netlify-cli deploy --prod
   ```

3. **Muhit o'zgaruvchilari.** Netlify'da Site configuration, Environment variables bo'limiga qo'shing:

   | Nomi | Ma'nosi |
   |---|---|
   | `DB_HOST` | MySQL server manzili |
   | `DB_PORT` | port (odatda 3306) |
   | `DB_USER` | foydalanuvchi |
   | `DB_PASSWORD` | parol |
   | `DB_NAME` | baza nomi |
   | `DB_SSL` | faqat server SSL'siz bo'lsa `false` yozing |
   | `ADMIN_KEY` | ixtiyoriy, istalgan fikrni o'chirish uchun maxfiy kalit |

   O'zgaruvchilarni qo'shgach saytni qayta deploy qiling.

## Eslatmalar

- Foydalanuvchilar ro'yxatdan o'tmaydi. Har bir brauzerga tasodifiy anonim identifikator beriladi, shu orqali bir kishi bir fikrni bir marta yoqtira oladi va faqat o'z fikrini o'chira oladi.
- Spamga qarshi: bir brauzerdan 10 soniyada bittadan ko'p fikr qabul qilinmaydi.
- Eng oxirgi 300 ta fikr ko'rsatiladi. Sahifa har 15 soniyada yangilanadi.
- Istalgan fikrni qo'lda o'chirish: `DELETE FROM comments WHERE id = 5;` (yoqtirishlar o'zi o'chadi).
