# Docker Quick Start - Single Compose File

One `docker-compose.yml` file for **both local development and DigitalOcean production**.

---

## 🚀 Local Development (Your Laptop)

### Start Everything

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/otl_staffing_bk.git
cd otl_staffing_bk

# Start with local development config
docker-compose --env-file .env.local up

# Or shorthand (uses .env.local by default if it exists):
docker-compose up
```

**What starts:**
- MongoDB on `localhost:27017` (data in local named volume)
- Node.js app on `http://localhost:3000`
- Live reload enabled (any code change triggers restart)

### Check It's Working

```bash
# In another terminal:

# API is running
curl http://localhost:3000/health

# MongoDB is running
docker exec otl_staffing_mongo mongosh -u mongoadmin -p localpassword123 --eval "db.adminCommand('ping')"
```

### Stop Everything

```bash
docker-compose down
# Data persists in named volume, reuse next time
```

---

## 🌐 DigitalOcean Production Deployment

### Prerequisites

1. **DigitalOcean account** with:
   - Droplet (Ubuntu 22.04, 4GB RAM minimum)
   - 2 Persistent volumes:
     - `otl-staffing-mongo-data` (100GB)
     - `otl-staffing-mongo-config` (10GB)

2. **SSH access to droplet** and installed:
   - Docker & Docker Compose
   - Git

### Step 1: Prepare Environment

```bash
# On your laptop, set up production secrets
cp .env.production .env.prod.local
nano .env.prod.local

# Fill in all production values:
# - MONGO_ROOT_PASSWORD (strong password)
# - MONGO_APP_PASSWORD (strong password)  
# - JWT_SECRET (random string, 32+ chars)
# - JWT_REFRESH_SECRET (random string, 32+ chars)
# - CLOUDINARY_* credentials
# - FIREBASE_* credentials
# - SMTP_* credentials
# - PAPERTRAIL_* credentials
```

### Step 2: Deploy to DigitalOcean

```bash
# SSH into droplet
ssh root@<YOUR_DROPLET_IP>

# On droplet:
cd /root
git clone https://github.com/YOUR_USERNAME/otl_staffing_bk.git
cd otl_staffing_bk

# Copy your production .env file (or create it on droplet)
# Option A: Copy from laptop via scp
# scp .env.prod.local root@<IP>:/root/otl_staffing_bk/.env.production

# Option B: Create on droplet and edit
nano .env.production
# (paste all production secrets)

# Mount volumes (first time only)
mkdir -p /mnt/otl_staffing_data /mnt/otl_staffing_config
# Format volumes (if new - see DEPLOYMENT_DIGITALOCEAN.md for details)
```

### Step 3: Start Production Services

```bash
# On droplet, start with production config
docker-compose --env-file .env.production up -d

# Watch logs
docker-compose logs -f app
docker-compose logs -f mongodb

# Verify health
curl http://localhost:3000/health
```

### Step 4: Verify MongoDB Data Persistence

```bash
# Data is on persistent volume
df -h /mnt/otl_staffing_data

# Show MongoDB is running and has data
docker exec otl_staffing_mongo mongosh -u otl_user -p <PASSWORD> mongodb://localhost:27017/otl_staffing --eval "db.stats()"
```

---

## 🔄 Updating Code (Push to Production)

### Simple Update (SSH Method)

```bash
# On droplet
cd /root/otl_staffing_bk
git pull origin main
docker-compose --env-file .env.production pull
docker-compose --env-file .env.production up -d

# Verify
docker-compose logs app
```

### Automated Updates (GitHub Actions)

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Deploy to DigitalOcean
  env:
    DROPLET_IP: ${{ secrets.DROPLET_IP }}
    DROPLET_SSH_KEY: ${{ secrets.DROPLET_SSH_KEY }}
  run: |
    mkdir -p ~/.ssh
    echo "$DROPLET_SSH_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    
    ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no root@$DROPLET_IP << 'EOF'
      cd /root/otl_staffing_bk
      git pull origin main
      docker-compose --env-file .env.production pull
      docker-compose --env-file .env.production up -d
    EOF
```

---

## 🛡️ Data Safety Guarantee

### When You Push Code → **Data Stays Safe**

```
git push → Docker pulls new images → Containers restart
          ↓
     MongoDB container restarts
     ↓
     Mounts /mnt/otl_staffing_data (persistent volume)
     ↓
     All data still there ✅
```

### Why Data is Safe
- **App container** is stateless (can restart anytime)
- **MongoDB data** lives on persistent volume (not in container)
- **Volume mounts:** `/mnt/otl_staffing_data` survives container restarts

---

## 📋 Environment Variables Reference

### Use `.env.local` for Development

```bash
NODE_ENV=development              # Use npm run dev
BUILD_TARGET=development          # Build with dev dependencies
COMMAND=npm run dev              # Run dev server
MONGODB_DATA_PATH=mongo_data     # Local named volume
```

### Use `.env.production` for DigitalOcean

```bash
NODE_ENV=production              # Use node src/app.js
BUILD_TARGET=production          # Lean production image
COMMAND=node src/app.js         # Run production server
MONGODB_DATA_PATH=/mnt/...      # Persistent volume path
```

### Variables Auto-Detected

- `MONGO_APP_USER` → Sets MongoDB auth user
- `MONGO_APP_PASSWORD` → Sets MongoDB auth password
- `MONGODB_URI` → Automatically built from above
- `PORT` → Defaults to 3000 if not set

---

## 🐛 Troubleshooting

### "Connection refused" to MongoDB

```bash
# Check MongoDB is running
docker-compose ps

# Check logs
docker-compose logs mongodb

# Test connection
docker-compose exec app mongosh mongodb://mongodb:27017/otl_staffing
```

### "Permission denied" on /mnt/otl_staffing_data

```bash
# On production droplet:
chmod 755 /mnt/otl_staffing_data
chown 999:999 /mnt/otl_staffing_data  # Docker user
```

### Volume not persisting

```bash
# Check volume is mounted correctly
docker inspect otl_staffing_mongo | grep -A 10 Mounts

# Should show:
# "Source": "/mnt/otl_staffing_data"
# "Destination": "/data/db"
```

### Data disappeared after restart

```bash
# Check if using wrong env file
docker-compose --env-file .env.local config | grep mongo_data
docker-compose --env-file .env.production config | grep /mnt

# Make sure you're using correct env file!
```

---

## 📊 One-File Architecture

```
docker-compose.yml (single file)
    ↓
Uses environment variables
    ↓
    ├── LOCAL: .env.local
    │   ├── BUILD_TARGET=development
    │   ├── MONGODB_DATA_PATH=mongo_data (named volume)
    │   ├── COMMAND=npm run dev
    │   └── RESTART_POLICY=no
    │
    └── PRODUCTION: .env.production
        ├── BUILD_TARGET=production
        ├── MONGODB_DATA_PATH=/mnt/otl_staffing_data (persistent volume)
        ├── COMMAND=node src/app.js
        └── RESTART_POLICY=unless-stopped
```

---

## 📝 Quick Commands

```bash
# Local Development
docker-compose up                          # Start
docker-compose down                        # Stop
docker-compose logs -f app                # Watch app logs
docker-compose exec app npm test          # Run tests

# Production (on Droplet)
docker-compose --env-file .env.production up -d
docker-compose --env-file .env.production ps
docker-compose --env-file .env.production logs app
docker-compose --env-file .env.production down  # Only if needed!
```

---

## Next Steps

1. **Local dev:** `docker-compose up` and start coding
2. **Deploy to DO:** Follow "DigitalOcean Production Deployment" section above
3. **Backups:** See `DEPLOYMENT_DIGITALOCEAN.md` for backup setup
4. **Monitoring:** Enable DigitalOcean monitoring on Droplet

That's it! One compose file, two environments. 🎉
