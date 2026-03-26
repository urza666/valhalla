#!/bin/bash
set -euo pipefail
echo "=== Valhalla Staging Provisioning ==="
hostnamectl set-hostname $VAULT_STAGING_FQDN # From Vault: secret/data/valhalla
echo "✓ Hostname"
dnf update -y -q
if ! command -v docker &>/dev/null; then
    dnf install -y -q dnf-plugins-core
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
fi
echo "✓ Docker"
dnf install -y -q git curl wget jq htop tmux 2>/dev/null || true
if ! id deploy &>/dev/null; then
    useradd -m -G docker deploy
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
fi
echo "✓ Deploy user"
if command -v firewall-cmd &>/dev/null; then
    for p in 80 443 3080 3081 9090 3083; do firewall-cmd --permanent --add-port=${p}/tcp 2>/dev/null || true; done
    firewall-cmd --reload 2>/dev/null || true
fi
echo "✓ Firewall"
REPO=/opt/valhalla
if [ ! -d "$REPO" ]; then
    GIT_SSL_NO_VERIFY=1 git clone $VAULT_GIT_REPO_URL # From Vault: secret/data/valhalla "$REPO"
    chown -R deploy:deploy "$REPO"
else
    cd "$REPO" && GIT_SSL_NO_VERIFY=1 git pull
fi
echo "✓ Repo"
cd "$REPO" && sudo -u deploy bash setup.sh
echo "=== Done: http://$VAULT_STAGING_IP:3080 ==="
