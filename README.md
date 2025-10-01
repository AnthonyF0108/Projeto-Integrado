# 🌱 Projeto Agrovale

Este projeto é uma aplicação desenvolvida em **Node.js** com integração a banco de dados relacional.  
O objetivo é gerenciar informações ligadas ao domínio agrícola, armazenando e manipulando dados através de uma API e banco de dados.

---

## 🚀 Tecnologias Utilizadas

- [Node.js](https://nodejs.org/)  
- [Express](https://expressjs.com/)  
- [MySQL](https://www.mysql.com/)  
- [dotenv](https://www.npmjs.com/package/dotenv)

---

## 📂 Estrutura do Projeto

- `package.json` → Gerenciamento de dependências  
- `Banco de dados Agrovale.sql` → Script para criação do banco de dados  
- `.env` → Variáveis de ambiente (ex: credenciais do banco)  
- Código-fonte → API e lógica da aplicação

---

## 📦 Instalação

Clone o repositório:

```bash
git clone https://github.com/AnthonyF0108/Projeto-Integrado.git
cd Projeto-Integrado
```

Instale as dependências:

```bash
npm install
```

---

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as variáveis de conexão ao banco:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS="suasenha"
DB_NAME=agrovale

PORT=3000
SESSION_SECRET="trocar_para_algo_secreto"
SESSION_KEY=agrovale_sess
NODE_ENV=development
```

---

## 🗄️ Banco de Dados

1. Crie um banco no MySQL (ou MariaDB).  
2. Importe o script `Banco de dados Agrovale.sql` para criar as tabelas:  

```bash
mysql -u root -p agrovale < "Banco de dados Agrovale.sql"
```

---

## ▶️ Como Rodar o Projeto

Para rodar em modo de desenvolvimento:

```bash
npm start
```

A aplicação ficará disponível em:

```
http://localhost:3000
```

---


## 📜 Licença

Este projeto está sob a licença MIT.  