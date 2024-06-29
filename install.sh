#!/bin/bash

# Solicitar informações do usuário
read -p "Digite o endereço IP da VPS: " SERVER_IP
read -p "Digite o nome de usuário da VPS: " SERVER_USER
read -p "Digite o domínio do frontend (ex. www.seudominio.com): " FRONTEND_DOMAIN
read -p "Digite o domínio do backend (ex. api.seudominio.com): " BACKEND_DOMAIN

# Solicitar senha da VPS
read -sp "Digite a senha da VPS: " SERVER_PASSWORD
echo

# Comandos remotos para configurar o servidor
REMOTE_COMMANDS=$(cat <<'EOF'
# Atualizar pacotes do sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 nginx sshpass git
sudo npm install -g pm2

# Criar diretórios da aplicação
mkdir -p ~/apps/pes-politica

# Clonar o repositório
git clone https://github.com/yourusername/yourrepository.git ~/apps/pes-politica

# Navegar até o diretório da aplicação
cd ~/apps/pes-politica

# Instalar dependências da aplicação
npm install
cd client
npm install
npm run build
cd ..

# Configurar PM2
pm2 start server.js --name "pes-politica"
pm2 save
pm2 startup

# Configurar Nginx
sudo tee /etc/nginx/sites-available/$FRONTEND_DOMAIN > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name $FRONTEND_DOMAIN;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /static {
        alias /home/$SERVER_USER/apps/pes-politica/client/build/static;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_CONF

# Habilitar nova configuração no Nginx
sudo ln -s /etc/nginx/sites-available/$FRONTEND_DOMAIN /etc/nginx/sites-enabled/
sudo systemctl restart nginx

EOF
)

# Conectar na VPS e executar comandos
sshpass -p $SERVER_PASSWORD ssh $SERVER_USER@$SERVER_IP "$REMOTE_COMMANDS"

echo "Instalação concluída. Acesse o seu domínio para verificar a aplicação."
#!/bin/bash

# Solicitar informações do usuário
read -p "Digite o endereço IP da VPS: " SERVER_IP
read -p "Digite o nome de usuário da VPS: " SERVER_USER
read -p "Digite o domínio do frontend (ex. www.seudominio.com): " FRONTEND_DOMAIN
read -p "Digite o domínio do backend (ex. api.seudominio.com): " BACKEND_DOMAIN

# Solicitar senha da VPS
read -sp "Digite a senha da VPS: " SERVER_PASSWORD
echo

# Comandos remotos para configurar o servidor
REMOTE_COMMANDS=$(cat <<EOF
# Atualizar pacotes do sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 nginx sshpass git
sudo npm install -g pm2

# Criar diretórios da aplicação
mkdir -p ~/apps/pes-politica

# Clonar o repositório
git clone https://github.com/pablooliveiraweb/pesquisa.git ~/apps/pes-politica

# Navegar até o diretório da aplicação
cd ~/apps/pes-politica

# Instalar dependências da aplicação
npm install
cd client
npm install
npm run build
cd ..

# Configurar PM2
pm2 start server.js --name "pes-politica"
pm2 save
pm2 startup

# Configurar Nginx
sudo tee /etc/nginx/sites-available/$FRONTEND_DOMAIN > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name $FRONTEND_DOMAIN;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /static {
        alias /home/$SERVER_USER/apps/pes-politica/client/build/static;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_CONF

# Habilitar nova configuração no Nginx
sudo ln -s /etc/nginx/sites-available/$FRONTEND_DOMAIN /etc/nginx/sites-enabled/
sudo systemctl restart nginx

EOF

# Conectar na VPS e executar comandos
sshpass -p $SERVER_PASSWORD ssh $SERVER_USER@$SERVER_IP "$REMOTE_COMMANDS"

echo "Instalação concluída. Acesse o seu domínio para verificar a aplicação."

