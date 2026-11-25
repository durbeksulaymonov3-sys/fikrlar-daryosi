# Fikrlar Devori

Fikr qoldirish va yoqtirish sahifasi. Sahifa Netlify'da, ma'lumotlar TiDB Cloud'da (MySQL bilan mos) saqlanadi.

## Tuzilishi

```
public/index.html              sahifa
netlify/functions/api.mjs      TiDB bilan gaplashadigan funksiya (/api)
schema.sql                     jadvallar
netlify.toml, package.json     sozlamalar
```

## O'rnatish

1. **TiDB Cloud.** Bazada `schema.sql` faylini bir marta ishga tushiring (`comments` va `likes` jadvallari).

2. **Muhit o'zgaruvchilari.** Netlify'da quyidagilarni qo'shing:

   | Nomi | Ma'nosi |
   |---|---|
   | `TIDB_HOST` | TiDB server manzili |
   | `TIDB_PORT` | port (odatda 4000) |
   | `TIDB_USER` | foydalanuvchi |
   | `TIDB_PASSWORD` | parol |
   | `TIDB_DATABASE` | baza nomi |
   | `ADMIN_KEY` | ixtiyoriy, istalgan fikrni o'chirish uchun maxfiy kalit |

   Ulanish doim TLS orqali (kamida TLS 1.2, sertifikat tekshiriladi). O'zgaruvchilarni o'zgartirgach saytni qayta deploy qiling.

## Eslatmalar

- Server barcha so'rovlarni parametrli (prepared statement) tarzda bajaradi. Ism 24, fikr 2 dan 280 belgigacha bo'lishi server tomonida tekshiriladi.
- Foydalanuvchilar ro'yxatdan o'tmaydi. Har bir brauzerga tasodifiy anonim identifikator beriladi, shu orqali bir kishi bir fikrni bir marta yoqtira oladi va faqat o'z fikrini o'chira oladi.
- Spamga qarshi: bir brauzerdan 10 soniyada bittadan ko'p fikr qabul qilinmaydi.
- Eng oxirgi 300 ta fikr ko'rsatiladi. Sahifa har 15 soniyada yangilanadi.
- Istalgan fikrni qo'lda o'chirish: `DELETE FROM comments WHERE id = 5;` (yoqtirishlar o'zi o'chadi).
