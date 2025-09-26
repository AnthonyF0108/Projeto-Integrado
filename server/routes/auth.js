const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

// Rota de Login (GET)
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Rota de Login (POST)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT UsuarioID, Nome, NomeUsuario, Senha FROM Usuarios WHERE NomeUsuario = ?',
      [username]
    );

    if (!rows || rows.length === 0) {
      return res.render('login', { error: 'Usuário não encontrado' });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.Senha);
    if (!match) {
      return res.render('login', { error: 'Senha inválida' });
    }

    req.session.user = { 
      id: user.UsuarioID, 
      username: user.NomeUsuario, 
      nome: user.Nome 
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Erro no login' });
  }
});

// Rota de Registro (GET)
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// Rota de Registro (POST)
router.post('/register', async (req, res) => {
  const { nome, cpf, email, telefone, usuario, senha } = req.body;
  
  // Adicionamos este log para debug
  console.log("Dados recebidos no formulário:", req.body);
  
  // Verificação básica para garantir que os dados principais não estão vazios
  if (!nome || !usuario || !senha) {
    return res.render('register', { error: 'Nome, usuário e senha são obrigatórios.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      `INSERT INTO Usuarios (Nome, CPF, Email, Telefone, NomeUsuario, Senha) VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, email, telefone, usuario, hash]
    );

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.render('register', { error: 'Erro: Nome de usuário ou CPF já cadastrado.' });
    }
    res.render('register', { error: 'Erro no registro. Tente novamente mais tarde.' });
  }
});

// Rota de Logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// Esqueceu a senha - GET
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null });
});

// Esqueceu a senha - POST
router.post('/forgot-password', async (req, res) => {
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.render('forgot-password', { error: 'Preencha todos os campos', message: null });
  }

  try {
    const [rows] = await pool.query(
      'SELECT UsuarioID FROM Usuarios WHERE NomeUsuario = ?',
      [username]
    );

    if (!rows || rows.length === 0) {
      return res.render('forgot-password', { error: 'Usuário não encontrado', message: null });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE Usuarios SET Senha = ? WHERE NomeUsuario = ?',
      [hash, username]
    );

    res.render('forgot-password', { message: 'Senha alterada com sucesso!', error: null });
  } catch (err) {
    console.error(err);
    res.render('forgot-password', { error: 'Erro ao alterar a senha.', message: null });
  }
});

// Rota de Registro (POST)
router.post('/register', async (req, res) => {
  const { nome, cpf, email, telefone, usuario, senha, confirmarSenha } = req.body;
  
  console.log("Dados recebidos no formulário:", req.body);

  // Verifica campos obrigatórios
  if (!nome || !usuario || !senha || !confirmarSenha) {
    return res.render('register', { error: 'Preencha todos os campos obrigatórios.' });
  }

  // 🔴 Verifica se as senhas coincidem
  if (senha !== confirmarSenha) {
    return res.render('register', { error: 'As senhas não coincidem.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      `INSERT INTO Usuarios (Nome, CPF, Email, Telefone, NomeUsuario, Senha) VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, email, telefone, usuario, hash]
    );

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.render('register', { error: 'Erro: Nome de usuário ou CPF já cadastrado.' });
    }
    res.render('register', { error: 'Erro no registro. Tente novamente mais tarde.' });
  }
});


module.exports = router;