#!/bin/bash
# EC2 user-data for the KAIRON hackathon deployment.
# Target: t3.micro (or t3.small), Amazon Linux 2023, public subnet, single
# instance. No RDS, no ElastiCache, no ALB — the current MVP runs entirely
# in-memory (see apps/api/src/main.ts), so there is nothing else to provision.
set -euo pipefail

dnf update -y
dnf install -y docker git
systemctl enable --now docker

# Pull the repo (swap for your actual remote once pushed) and build the image
# in place — fastest path for a 22-hour build, no ECR round-trip required.
cd /home/ec2-user
git clone https://github.com/sanaysarthak/kairon-ifih.git app
cd app

# JWT_SECRET should be set via SSM Parameter Store in a real run, not baked
# into user-data (this placeholder is what "Deploy This First" step 3 exists
# to replace before the demo, not after).
docker build -t kairon-api:hackathon .
docker run -d --restart unless-stopped \
  -p 80:3000 \
  -e PORT=3000 \
  -e JWT_SECRET="$(aws ssm get-parameter --name /kairon/jwt-secret --with-decryption --query Parameter.Value --output text 2>/dev/null || echo dev-only-insecure-secret-change-me)" \
  --name kairon-api \
  kairon-api:hackathon
