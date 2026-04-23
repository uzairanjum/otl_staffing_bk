#!/bin/bash
# Interactive setup for .env.production
# Usage: bash scripts/setup-production-env.sh

set -e

OUTPUT_FILE=".env.production"

echo "🔧 OTL Staffing - Production Environment Setup"
echo "=============================================="
echo ""

# Check if file exists
if [ -f "$OUTPUT_FILE" ]; then
    echo "⚠️  $OUTPUT_FILE already exists!"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

# Helper function
prompt() {
    local var_name=$1
    local prompt_text=$2
    local default=$3

    if [ -z "$default" ]; then
        read -p "  $prompt_text: " value
    else
        read -p "  $prompt_text [$default]: " value
        value=${value:-$default}
    fi

    echo "$var_name=$value"
}

# Generate random secrets
generate_secret() {
    openssl rand -hex 32
}

echo "📝 Step 1: MongoDB Configuration"
echo "================================"
mongodb_root_pass=$(prompt "MONGO_ROOT_PASSWORD" "MongoDB root password (strong!)" "")
mongodb_app_pass=$(prompt "MONGO_APP_PASSWORD" "MongoDB app user password (strong!)" "")

echo ""
echo "🔑 Step 2: JWT Secrets"
echo "===================="
echo "  (Generating random secrets...)"
jwt_secret=$(generate_secret)
jwt_refresh_secret=$(generate_secret)
echo "  JWT_SECRET: $jwt_secret (generated)"
echo "  JWT_REFRESH_SECRET: $jwt_refresh_secret (generated)"

echo ""
echo "☁️  Step 3: Cloudinary (Image Upload)"
echo "===================================="
read -p "  Cloudinary Cloud Name: " cloudinary_name
read -p "  Cloudinary API Key: " cloudinary_key
read -p "  Cloudinary API Secret: " cloudinary_secret

echo ""
echo "🔥 Step 4: Firebase (Push Notifications)"
echo "======================================"
read -p "  Firebase Project ID: " firebase_project_id
read -p "  Firebase Client Email: " firebase_client_email
echo "  Firebase Private Key (paste entire key, then press Ctrl+D):"
firebase_private_key=$(cat)

echo ""
echo "📧 Step 5: SMTP (Email)"
echo "======================"
read -p "  SMTP Host (default: smtp.gmail.com): " smtp_host
smtp_host=${smtp_host:-smtp.gmail.com}
read -p "  SMTP Port (default: 587): " smtp_port
smtp_port=${smtp_port:-587}
read -p "  SMTP User (email): " smtp_user
read -s -p "  SMTP Password (app-specific): " smtp_pass
echo ""

echo ""
echo "📊 Step 6: Papertrail (Logging)"
echo "=============================="
read -p "  Papertrail Host (optional, press enter to skip): " papertrail_host
read -p "  Papertrail Port (optional): " papertrail_port

echo ""
echo "🌐 Step 7: Frontend URL"
echo "======================="
read -p "  Frontend URL (default: https://your-domain.com): " frontend_url
frontend_url=${frontend_url:-https://your-domain.com}

echo ""
echo "💾 Writing to $OUTPUT_FILE..."
echo ""

# Write to file
cat > "$OUTPUT_FILE" << EOF
# DigitalOcean Production Configuration
# Generated: $(date)

NODE_ENV=production
BUILD_TARGET=production
COMMAND=node src/app.js
RESTART_POLICY=unless-stopped
APP_VOLUME_PATH=

# MongoDB (DigitalOcean persistent volumes)
MONGODB_DATA_PATH=/mnt/otl_staffing_data
MONGODB_CONFIG_PATH=/mnt/otl_staffing_config
MONGO_ROOT_USER=mongoadmin
MONGO_ROOT_PASSWORD=$mongodb_root_pass
MONGO_APP_USER=otl_user
MONGO_APP_PASSWORD=$mongodb_app_pass

# Server
PORT=3000

# JWT
JWT_SECRET=$jwt_secret
JWT_REFRESH_SECRET=$jwt_refresh_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=$cloudinary_name
CLOUDINARY_API_KEY=$cloudinary_key
CLOUDINARY_API_SECRET=$cloudinary_secret

# Firebase
FIREBASE_PROJECT_ID=$firebase_project_id
FIREBASE_PRIVATE_KEY=$firebase_private_key
FIREBASE_CLIENT_EMAIL=$firebase_client_email

# SMTP
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_USER=$smtp_user
SMTP_PASS=$smtp_pass

# Papertrail (Optional)
PAPERTRAIL_HOST=$papertrail_host
PAPERTRAIL_PORT=$papertrail_port

# Frontend
FRONTEND_URL=$frontend_url
EOF

# Set secure permissions
chmod 600 "$OUTPUT_FILE"

echo "✅ Created $OUTPUT_FILE with mode 600 (read/write owner only)"
echo ""
echo "📋 Next steps:"
echo "  1. Verify the file: cat $OUTPUT_FILE"
echo "  2. Deploy to DigitalOcean: scp $OUTPUT_FILE root@<IP>:/root/otl_staffing_bk/"
echo "  3. On Droplet: docker-compose --env-file .env.production up -d"
echo ""
echo "🔐 Security reminders:"
echo "  • Never commit .env.production to git"
echo "  • Keep it in a safe, encrypted location"
echo "  • Rotate secrets periodically"
echo "  • Use GitHub Secrets for CI/CD deployment"
echo ""
echo "Done! 🎉"
