// server/routes/admin.usuarios.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const authRequired = require('../middleware/authRequired');
const ensureAdmin = require('../middleware/ensureAdmin');

router.use(authRequired, ensureAdmin);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT UsuarioID, Nome, CPF, Email, Telefone, NomeUsuario, Role, Ativo
    FROM Usuarios
    ORDER BY Nome
  `);
  res.render('admin-usuarios', { usuarios: rows, error: null });
});

router.get('/novo', (req, res) => {
  res.render('admin-usuario-form', { usuario: null, error: null });
});

router.post('/', async (req, res) => {
  const { Nome, CPF, Email, Telefone, NomeUsuario, Senha, Role = 'user', Ativo = 1 } = req.body;
  try {
    const hash = await bcrypt.hash(Senha, 10);
    await pool.query(`
      INSERT INTO Usuarios (Nome, CPF, Email, Telefone, NomeUsuario, Senha, Role, Ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [Nome, CPF, Email, Telefone, NomeUsuario, hash, Role, Ativo ? 1 : 0]);
    res.redirect('/admin/usuarios');
  } catch (err) {
    console.error(err);
    res.render('admin-usuario-form', { usuario: null, error: 'Erro ao criar usuário.' });
  }
});

router.get('/:id/editar', async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM Usuarios WHERE UsuarioID = ?`, [req.params.id]);
  if (!rows.length) return res.status(404).send('Usuário não encontrado');
  res.render('admin-usuario-form', { usuario: rows[0], error: null });
});

router.post('/:id', async (req, res) => {
  const { Nome, CPF, Email, Telefone, NomeUsuario, NovaSenha, Role = 'user', Ativo = 1 } = req.body;

  try {
    const updates = [Nome, CPF, Email, Telefone, NomeUsuario, Role, Ativo ? 1 : 0, req.params.id];
    let sql = `
      UPDATE Usuarios
      SET Nome=?, CPF=?, Email=?, Telefone=?, NomeUsuario=?, Role=?, Ativo=?
      WHERE UsuarioID=?
    `;
    await pool.query(sql, updates);

    if (NovaSenha && NovaSenha.trim()) {
      const hash = await bcrypt.hash(NovaSenha, 10);
      await pool.query(`UPDATE Usuarios SET Senha=? WHERE UsuarioID=?`, [hash, req.params.id]);
    }

    res.redirect('/admin/usuarios');
  } catch (err) {
    console.error(err);
    res.render('admin-usuario-form', { usuario: { UsuarioID: req.params.id, Nome, CPF, Email, Telefone, NomeUsuario, Role, Ativo }, error: 'Erro ao atualizar usuário.' });
  }
});

router.post('/:id/excluir', async (req, res) => {
  try {
    await pool.query(`DELETE FROM Usuarios WHERE UsuarioID = ?`, [req.params.id]);
    res.redirect('/admin/usuarios');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir usuário');
  }
});

module.exports = router;
