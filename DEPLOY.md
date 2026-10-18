# Pasang di VPS (tanpa Node di server)
1. Upload folder `dist/` ke VPS:  scp -r dist ubuntu@IP:/tmp/univoxia-dist
2. sudo mkdir -p /var/www/univoxia && sudo cp -r /tmp/univoxia-dist/* /var/www/univoxia/
3. Salin nginx-univoxia.conf ke /etc/nginx/sites-available/univoxia, ganti server_name
4. sudo ln -s /etc/nginx/sites-available/univoxia /etc/nginx/sites-enabled/
5. sudo nginx -t && sudo systemctl reload nginx
6. sudo certbot --nginx -d univoxia.IP-DENGAN-STRIP.sslip.io

# Pengembangan
npm install && npm run dev      (proxy /health ke 127.0.0.1:4000)
npm run build                   (hasil di dist/)
