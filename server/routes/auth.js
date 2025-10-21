const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

// ===============================
// LOGIN (GET)
// ===============================
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// ===============================
// LOGIN (POST)
// ===============================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Agora buscamos também a coluna ROLE
    const [rows] = await pool.query(
      'SELECT UsuarioID, Nome, NomeUsuario, Senha, Role, Email FROM Usuarios WHERE NomeUsuario = ? AND Ativo = 1',
      [username]
    );

    if (!rows || rows.length === 0) {
      return res.render('login', { error: 'Usuário não encontrado.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.Senha);

    if (!match) {
      return res.render('login', { error: 'Senha incorreta.' });
    }

    // 🔥 Corrigido: role vem direto do banco!
    req.session.user = {
      id: user.UsuarioID,
      nome: user.Nome,
      nomeUsuario: user.NomeUsuario,
      email: user.Email,
      role: user.Role // <-- ESSENCIAL
    };

    console.log('Usuário logado:', req.session.user);

    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Erro no login:', err);
    res.render('login', { error: 'Erro interno ao fazer login.' });
  }
});

// ===============================
// REGISTRO (GET)
// ===============================
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// ===============================
// REGISTRO (POST)
// ===============================
router.post('/register', async (req, res) => {
  const { nome, cpf, email, telefone, usuario, senha, confirmarSenha } = req.body;

  if (!nome || !usuario || !senha || !confirmarSenha) {
    return res.render('register', { error: 'Preencha todos os campos obrigatórios.' });
  }

  if (senha !== confirmarSenha) {
    return res.render('register', { error: 'As senhas não coincidem.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      `INSERT INTO Usuarios (Nome, CPF, Email, Telefone, NomeUsuario, Senha, Role) VALUES (?, ?, ?, ?, ?, ?, 'user')`,
      [nome, cpf, email, telefone, usuario, hash]
    );

    res.redirect('/login');
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.render('register', { error: 'Usuário ou CPF já cadastrado.' });
    }
    res.render('register', { error: 'Erro no registro. Tente novamente.' });
  }
});

// ===============================
// LOGOUT
// ===============================
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

// ===============================
// ESQUECEU A SENHA (GET)
// ===============================
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null });
});

// ===============================
// ESQUECEU A SENHA (POST)
// ===============================
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
    await pool.query('UPDATE Usuarios SET Senha = ? WHERE NomeUsuario = ?', [hash, username]);

    res.render('forgot-password', { message: 'Senha alterada com sucesso!', error: null });
  } catch (err) {
    console.error(err);
    res.render('forgot-password', { error: 'Erro ao alterar senha.', message: null });
  }
});

module.exports = router;
