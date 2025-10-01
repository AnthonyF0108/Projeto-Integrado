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
git clone https://github.com/seu-usuario/projeto-agrovale.git
cd projeto-agrovale
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
DB_USER=root
DB_PASS=sua_senha
DB_NAME=agrovale
PORT=3000
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

Se quiser rodar com **nodemon** (recomendado):

```bash
npx nodemon index.js
```

A aplicação ficará disponível em:

```
http://localhost:3000
```

---

## 🤝 Contribuição

1. Faça um fork do projeto  
2. Crie uma branch: `git checkout -b minha-feature`  
3. Commit suas alterações: `git commit -m 'feat: minha nova feature'`  
4. Push para a branch: `git push origin minha-feature`  
5. Abra um Pull Request  

---

## 📜 Licença

Este projeto está sob a licença MIT.  
