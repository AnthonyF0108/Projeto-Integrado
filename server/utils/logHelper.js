const pool = require('../db');

async function registrarLog(usuarioId, acao, tabelaAfetada, registroId, descricao) {
  try {
    await pool.query(
      `INSERT INTO LogAuditoria (UsuarioID, Acao, TabelaAfetada, RegistroID, Descricao, DataHora)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [usuarioId, acao, tabelaAfetada, registroId, descricao]
    );
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}

module.exports = { registrarLog };