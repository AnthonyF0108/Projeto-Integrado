const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('./auth');
const adminUsuarios = require('./admin.usuarios');
const { registrarLog } = require('../utils/logHelper');

router.use('/', auth);
router.use('/admin/usuarios', adminUsuarios);

router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// ================================================
// DASHBOARD
// ================================================
router.get('/dashboard', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const { id: userId, role } = req.session.user;
  const isAdmin = role === 'admin';

  try {
    const whereUser = isAdmin ? '' : 'WHERE v.UsuarioID = ?';
    const params = isAdmin ? [] : [userId];

    const [vendasRows] = await pool.query(`
      SELECT 
        v.VendaID, v.NumeroPedido, v.DataVenda,
        v.ValorBruto, v.Desconto, v.ValorLiquido, v.Status,
        u.Nome AS VendedorNome
      FROM Venda v
      INNER JOIN Usuarios u ON v.UsuarioID = u.UsuarioID
      ${whereUser}
      ORDER BY v.DataVenda DESC
      LIMIT 20
    `, params);

    const [[totalVendasRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Venda v ${whereUser}`,
      params
    );

    const [[totalValorRow]] = await pool.query(
      `SELECT SUM(v.ValorLiquido) AS total FROM Venda v ${whereUser}`,
      params
    );

    const [[totalClientesRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Cliente`
    );

    const [[estoqueBaixoRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Produto WHERE EstoqueAtual < EstoqueMinimo`
    );

    const flashMessage = req.session.flashMessage;
    req.session.flashMessage = null;

    res.render('dashboard', {
      user: req.session.user,
      totalVendas: Number(totalVendasRow.total || 0),
      totalValor: parseFloat(totalValorRow.total || 0),
      totalClientes: Number(totalClientesRow.total || 0),
      estoqueBaixo: Number(estoqueBaixoRow.total || 0),
      vendas: vendasRows,
      isAdmin,
      flashMessage
    });

    req.session.flashMessage = null;

  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).send('Erro ao carregar dashboard');
  }
});

// =========================
// Criar Venda
// =========================
router.post("/vendas/criar", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { clienteId, formaPagamentoId, desconto, observacoes, produtos, quantidades } = req.body;
    const userId = req.session.user.id;
    
    const produtosIds = produtos.map(id => parseInt(id));
    const [produtosData] = await connection.query(
      `SELECT ProdutoID, PrecoVenda FROM Produto WHERE ProdutoID IN (?)`,
      [produtosIds]
    );

    const produtosMap = new Map();
    produtosData.forEach(p => produtosMap.set(p.ProdutoID, p.PrecoVenda));
    
    let valorBruto = 0;
    
    for (let i = 0; i < produtos.length; i++) {
      const produtoId = parseInt(produtos[i]);
      const quantidade = parseFloat(quantidades[i]);
      const precoUnitario = produtosMap.get(produtoId);
      
      if (precoUnitario) {
        valorBruto += quantidade * precoUnitario;
      }
    }

    const numeroPedido = `VENDA-${Date.now()}`;
    
    const descontoPerc = parseFloat(desconto) || 0;
    const descontoValor = valorBruto * (descontoPerc / 100);
    const valorLiquido = valorBruto - descontoValor;
    
    const [vendaResult] = await connection.query(
      `INSERT INTO Venda (
          NumeroPedido, DataVenda, ClienteID, UsuarioID, TempoID, FormaPagamentoID,
          ValorBruto, Desconto, ValorLiquido, Frete, Observacoes
       ) VALUES (?, NOW(), ?, ?, 1, ?, ?, ?, ?, 0, ?)`,
      [numeroPedido, clienteId, userId, formaPagamentoId, valorBruto, descontoValor, valorLiquido, observacoes]
    );
    const vendaId = vendaResult.insertId;

    for (let i = 0; i < produtos.length; i++) {
      const produtoId = parseInt(produtos[i]);
      const quantidade = parseFloat(quantidades[i]);
      const precoUnitario = produtosMap.get(produtoId);

      await connection.query(
        `INSERT INTO ItemVenda (VendaID, ProdutoID, Quantidade, PrecoUnitario, TotalItem) 
         VALUES (?, ?, ?, ?, ?)`,
        [vendaId, produtoId, quantidade, precoUnitario, quantidade * precoUnitario]
      );
      
      await connection.query(
        `UPDATE Produto SET EstoqueAtual = EstoqueAtual - ? WHERE ProdutoID = ?`,
        [quantidade, produtoId]
      );
    }
    
    await connection.commit();
    res.redirect('/dashboard'); 
    
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao criar venda:", err);
    res.status(500).send("Erro ao finalizar a venda: " + err.message);
  } finally {
    connection.release();
  }

});

router.get("/vendas", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const [clientes] = await pool.query('SELECT ClienteID, Nome, CPF_CNPJ FROM Cliente ORDER BY Nome');
    const [produtos] = await pool.query('SELECT ProdutoID, Nome, PrecoVenda, UnidadeMedida FROM Produto WHERE Ativo = 1 ORDER BY Nome');
    const [formasPagamento] = await pool.query('SELECT PagamentoID, Nome FROM FormaPagamento ORDER BY Nome');
    
    res.render("vendas", { clientes, produtos, formasPagamento });
  } catch (err) {
    console.error("Erro ao carregar dados para a página de vendas:", err);
    res.status(500).send("Erro ao carregar página de vendas: " + err.message);
  }
});

// ================================================
// ESTATÍSTICAS
// ================================================
router.get("/estatisticas", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  
  const { id: userId, role } = req.session.user;
  const isAdmin = role === 'admin';

  try {
    const whereUser = isAdmin ? '' : 'WHERE v.UsuarioID = ?';
    const params = isAdmin ? [] : [userId];

    const [[totalVendasRow]] = await pool.query(`SELECT COUNT(*) AS totalVendas FROM Venda v ${whereUser}`, params);
    const [[totalValorRow]]  = await pool.query(`SELECT IFNULL(SUM(v.ValorLiquido), 0) AS totalValor FROM Venda v ${whereUser}`, params);

    const [topProdutos] = await pool.query(`
      SELECT p.Nome AS nome_produto, SUM(iv.Quantidade) AS qtd
      FROM ItemVenda iv
      INNER JOIN Produto p ON iv.ProdutoID = p.ProdutoID
      INNER JOIN Venda v ON iv.VendaID = v.VendaID
      ${whereUser}
      GROUP BY p.ProdutoID
      ORDER BY qtd DESC
      LIMIT 5
    `, params);

    res.render("estatisticas", { 
      totalVendas: Number(totalVendasRow.totalVendas || 0),
      totalValor: parseFloat(totalValorRow.totalValor || 0),
      topProdutos: topProdutos || []
    });
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
    res.status(500).send("Erro ao carregar estatísticas: " + err.message);
  }
});

// ================================================
// PRODUTOS
// ================================================
router.get("/produtos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ProdutoID AS codigo_interno,
        Codigo AS codigo_externo,
        Nome AS nome_produto,
        PrecoVenda AS valor_venda_vista,
        (PrecoVenda * 1.10) AS valor_venda_prazo,
        EstoqueAtual AS quantidade_estoque
      FROM Produto
      ORDER BY Nome
    `);
    
    const produtos = rows.map(p => ({
      ...p,
      valor_venda_vista: parseFloat(p.valor_venda_vista),
      valor_venda_prazo: parseFloat(p.valor_venda_prazo)
    }));

    res.render("produtos", { produtos });
  } catch (err) {
    console.error("Erro ao buscar produtos:", err);
    res.status(500).send("Erro ao buscar produtos: " + err.message);
  }
});

router.get("/produtos/criar", (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  res.render("produto-form", { produto: null, title: 'Novo Produto' });
});

router.post("/produtos/criar", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  
  try {
    const { codigo_externo, nome_produto, categoria, subcategoria, preco_custo, margem_lucro, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id } = req.body;
    const preco_venda_calculado = parseFloat(preco_custo) * (1 + (parseFloat(margem_lucro) / 100));

    const [result] = await pool.query(
      `INSERT INTO Produto (Codigo, Nome, Categoria, Subcategoria, PrecoCusto, PrecoVenda, UnidadeMedida, EstoqueAtual, EstoqueMinimo, FornecedorID) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id]
    );

    const novoProdutoID = result.insertId;

    await registrarLog(
      req.session.user.id,
      'Cadastro de Produto',
      'Produto',
      novoProdutoID,
      `Produto "${nome_produto}" criado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error("Erro ao criar produto:", err);
    res.status(500).send("Erro ao criar produto: " + err.message);
  }
});

router.get("/produtos/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  
  try {
    const produtoId = req.params.id;
    const [rows] = await pool.query(`SELECT * FROM Produto WHERE ProdutoID = ?`, [produtoId]);
    if (rows.length === 0) return res.status(404).send('Produto não encontrado');

    const produto = rows[0];
    produto.margem_lucro = produto.PrecoCusto > 0
      ? (((produto.PrecoVenda - produto.PrecoCusto) / produto.PrecoCusto) * 100).toFixed(2)
      : 0;

    res.render("produto-form", { produto, title: 'Alterar Produto' });
  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    res.status(500).send("Erro ao buscar produto: " + err.message);
  }
});

router.post("/produtos/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  
  try {
    const produtoId = req.params.id;
    const { codigo_externo, nome_produto, categoria, subcategoria, preco_custo, margem_lucro, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id } = req.body;
    const preco_venda_calculado = parseFloat(preco_custo) * (1 + (parseFloat(margem_lucro) / 100));

    await pool.query(
      `UPDATE Produto 
       SET Codigo=?, Nome=?, Categoria=?, Subcategoria=?, PrecoCusto=?, PrecoVenda=?, UnidadeMedida=?, EstoqueAtual=?, EstoqueMinimo=?, FornecedorID=? 
       WHERE ProdutoID=?`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id, produtoId]
    );

    await registrarLog(
      req.session.user.id,
      'Atualização de Produto',
      'Produto',
      produtoId,
      `Produto "${nome_produto}" alterado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error("Erro ao alterar produto:", err);
    res.status(500).send("Erro ao alterar produto: " + err.message);
  }
});

router.post("/produtos/excluir/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  
  try {
    const produtoId = req.params.id;

    // 🔎 Busca o nome antes de excluir para salvar no log
    const [[produto]] = await pool.query(`SELECT Nome FROM Produto WHERE ProdutoID = ?`, [produtoId]);

    await pool.query(`DELETE FROM Produto WHERE ProdutoID = ?`, [produtoId]);

    await registrarLog(
      req.session.user.id,
      'Exclusão de Produto',
      'Produto',
      produtoId,
      `Produto "${produto ? produto.Nome : produtoId}" excluído por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error("Erro ao excluir produto:", err);
    res.status(500).send("Erro ao excluir produto: " + err.message);
  }
});

// ================================================
// CLIENTES
// ================================================

router.get("/clientes", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const [clientes] = await pool.query(`
      SELECT ClienteID, Nome, CPF_CNPJ, Email, Telefone, Endereco
      FROM Cliente
      ORDER BY Nome
    `);
    res.render("clientes", { clientes });
  } catch (err) {
    console.error("Erro ao buscar clientes:", err);
    res.status(500).send("Erro ao buscar clientes: " + err.message);
  }
});

router.get("/clientes/novo", (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  res.render("clientes-form", { cliente: null, title: 'Novo Cliente' });
});

router.post("/clientes/novo", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    const [result] = await pool.query(
      `INSERT INTO Cliente (Nome, CPF_CNPJ, Email, Telefone, Endereco)
       VALUES (?, ?, ?, ?, ?)`,
      [nome, cpf_cnpj, email, telefone, endereco]
    );

    await registrarLog(
      req.session.user.id,
      'Cadastro de Cliente',
      'Cliente',
      result.insertId,
      `Cliente "${nome}" criado por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao criar cliente:", err);
    res.status(500).send("Erro ao criar cliente: " + err.message);
  }
});

router.get("/clientes/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const clienteId = req.params.id;
    const [[cliente]] = await pool.query(
      `SELECT * FROM Cliente WHERE ClienteID = ?`,
      [clienteId]
    );

    if (!cliente) {
      return res.status(404).send('Cliente não encontrado');
    }

    res.render("clientes-form", { cliente, title: 'Alterar Cliente' });
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    res.status(500).send("Erro ao buscar cliente: " + err.message);
  }
});

router.post("/clientes/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const clienteId = req.params.id;
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    await pool.query(
      `UPDATE Cliente
       SET Nome = ?, CPF_CNPJ = ?, Email = ?, Telefone = ?, Endereco = ?
       WHERE ClienteID = ?`,
      [nome, cpf_cnpj, email, telefone, endereco, clienteId]
    );

    await registrarLog(
      req.session.user.id,
      'Alteração de Cliente',
      'Cliente',
      clienteId,
      `Cliente "${nome}" alterado por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao alterar cliente:", err);
    res.status(500).send("Erro ao alterar cliente: " + err.message);
  }
});

router.post("/clientes/excluir/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const clienteId = req.params.id;

    const [[checkVenda]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Venda WHERE ClienteID = ?`,
      [clienteId]
    );

    if (checkVenda.total > 0) {
      return res.send(`
        <body style="font-family: Arial; text-align:center; padding-top:50px;">
          <h3>⚠️ Não é possível excluir este cliente, pois ele possui vendas registradas.</h3>
          <p><a href="/clientes" style="color: blue; text-decoration: underline;">Voltar à lista de clientes</a></p>
          <script>
            setTimeout(() => { window.location.href = '/clientes'; }, 3500);
          </script>
        </body>
      `);
    }

    const [[cliente]] = await pool.query(`SELECT Nome FROM Cliente WHERE ClienteID = ?`, [clienteId]);
    await pool.query(`DELETE FROM Cliente WHERE ClienteID = ?`, [clienteId]);

    await registrarLog(
      req.session.user.id,
      'Exclusão de Cliente',
      'Cliente',
      clienteId,
      `Cliente "${cliente?.Nome || 'Desconhecido'}" excluído por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao excluir cliente:", err);
    res.status(500).send("Erro ao excluir cliente: " + err.message);
  }
});

// ================================================
// RELATÓRIO DE AUDITORIA
// ================================================
router.get('/relatorios/auditoria', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.flashMessage = {
      tipo: 'erro',
      texto: 'Acesso negado — apenas administradores podem acessar esta área.'
    };
    return res.redirect('/dashboard');
  }

  try {
    const { usuario, acao, dataInicio, dataFim } = req.query;

    let whereClause = [];
    let params = [];

    if (usuario) {
      whereClause.push('u.Nome LIKE ?');
      params.push(`%${usuario}%`);
    }

    if (acao) {
      whereClause.push('l.Acao = ?');
      params.push(acao);
    }

    if (dataInicio) {
      whereClause.push('DATE(l.DataHora) >= ?');
      params.push(dataInicio);
    }

    if (dataFim) {
      whereClause.push('DATE(l.DataHora) <= ?');
      params.push(dataFim);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [logs] = await pool.query(`
      SELECT l.LogID, l.Acao, l.TabelaAfetada, l.RegistroID, l.Descricao, l.DataHora, u.Nome AS Usuario
      FROM LogAuditoria l
      INNER JOIN Usuarios u ON l.UsuarioID = u.UsuarioID
      ${whereSQL}
      ORDER BY l.DataHora DESC
    `, params);

    res.render('relatorio-auditoria', {
      user: req.session.user,
      logs,
      filtroUsuario: usuario || '',
      filtroAcao: acao || '',
      filtroInicio: dataInicio || '',
      filtroFim: dataFim || ''
    });

  } catch (err) {
    console.error('Erro ao carregar relatório de auditoria:', err);
    res.status(500).send('Erro ao carregar relatório de auditoria');
  }
});

module.exports = router;