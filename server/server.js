require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------------
   🧱 Configurações de Views e Arquivos Estáticos
-------------------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, '..', 'public')));

/* -------------------------
   🛡️ Segurança (Helmet)
-------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net"
        ],
        "font-src": [
          "'self'",
          "https://cdn.jsdelivr.net"
        ],
        "img-src": ["'self'", "data:", "https:"]
      },
    },
  })
);

/* -------------------------
   📦 Middlewares de parsing
-------------------------- */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* -------------------------
   💾 Sessões e Banco de Dados
-------------------------- */
const sessionStoreOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(
  session({
    key: process.env.SESSION_KEY || 'agrovale_sess',
    secret: process.env.SESSION_SECRET || 'altera_no_env',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 4, // 4 horas
      httpOnly: true,
      secure: false, // coloque true se for HTTPS
    },
  })
);

/* -------------------------
   🚏 Rotas
-------------------------- */
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

/* -------------------------
   🚀 Inicialização do Servidor
-------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});