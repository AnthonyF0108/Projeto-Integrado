require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db');

async function seedUsers() {
  const usuarios = [
    { nomeUsuario: 'usuario1', vendedorId: 1, senha: '123' },
    { nomeUsuario: 'usuario2', vendedorId: 2, senha: '123' },
    { nomeUsuario: 'usuario3', vendedorId: 3, senha: '123' }
  ];

  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.senha, 10);
    await pool.query(
      `UPDATE Usuarios 
       SET SenhaHash = ? 
       WHERE NomeUsuario = ? AND VendedorID = ?`,
      [hash, u.nomeUsuario, u.vendedorId]
    );
  }

  console.log('Usuários atualizados com senha bcrypt!');
  process.exit();
}

seedUsers().catch(err => {
  console.error(err);
  process.exit(1);
});