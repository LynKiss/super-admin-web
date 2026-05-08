# Central Super Admin Web

Frontend deploy rieng cho Super Admin. App nay chi quan ly console trung tam, khong nam trong frontend cua tung bai.

## Local

```bash
npm install
npm run dev
```

Mac dinh app goi:

```txt
http://localhost:8100/api/super-admin
```

Tao `.env` neu can doi API:

```txt
VITE_SUPER_ADMIN_API_BASE_URL=https://your-super-admin-service.onrender.com/api/super-admin
```

## Deploy Vercel

- Root Directory: `super-admin-web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable:

```txt
VITE_SUPER_ADMIN_API_BASE_URL=https://your-super-admin-service.onrender.com/api/super-admin
```

Backend `super-admin-service` can cho phep CORS tu domain Vercel:

```txt
SUPER_ADMIN_CORS_ORIGIN=https://your-super-admin-web.vercel.app
NODE_ENV=production
SUPER_ADMIN_COOKIE_SAME_SITE=none
SUPER_ADMIN_COOKIE_SECURE=true
```
