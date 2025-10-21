// ================================================
//  ARQUIVO: index.js
//  Controle de rotas principal do sistema AGROVALE
//  (corrigido para permitir que admin veja tudo)
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('./auth');
const adminUsuarios = require('./admin.usuarios');

// Rotas de autenticação e admin
router.use('/', auth);
router.use('/admin/usuarios', adminUsuarios);

// Redirecionamento padrão
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
    // Se for admin → vê tudo; senão → apenas suas vendas
    const whereUser = isAdmin ? '' : 'WHERE v.UsuarioID = ?';
    const params = isAdmin ? [] : [userId];

    // Buscar dados principais
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

    res.render('dashboard', {
      user: req.session.user,
      totalVendas: Number(totalVendasRow.total || 0),
      totalValor: parseFloat(totalValorRow.total || 0),
      totalClientes: Number(totalClientesRow.total || 0),
      estoqueBaixo: Number(estoqueBaixoRow.total || 0),
      vendas: vendasRows,
      isAdmin, // <-- ESSENCIAL para o EJS saber o modo
    });
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
    
    // Obter os produtos e preços do banco
    const produtosIds = produtos.map(id => parseInt(id));
    const [produtosData] = await connection.query(
      `SELECT ProdutoID, PrecoVenda FROM Produto WHERE ProdutoID IN (?)`,
      [produtosIds]
    );

    const produtosMap = new Map();
    produtosData.forEach(p => produtosMap.set(p.ProdutoID, p.PrecoVenda));
    
    let valorBruto = 0;
    
    // Cálculo do valor bruto
    for (let i = 0; i < produtos.length; i++) {
      const produtoId = parseInt(produtos[i]);
      const quantidade = parseFloat(quantidades[i]);
      const precoUnitario = produtosMap.get(produtoId);
      
      if (precoUnitario) {
        valorBruto += quantidade * precoUnitario;
      }
    }

    // Número do pedido (simples, pode melhorar depois)
    const numeroPedido = `VENDA-${Date.now()}`;
    
    // 🔹 Cálculo do desconto percentual
    const descontoPerc = parseFloat(desconto) || 0;
    const descontoValor = valorBruto * (descontoPerc / 100);
    const valorLiquido = valorBruto - descontoValor;
    
    // Inserir a venda principal
    const [vendaResult] = await connection.query(
      `INSERT INTO Venda (
          NumeroPedido, DataVenda, ClienteID, UsuarioID, TempoID, FormaPagamentoID,
          ValorBruto, Desconto, ValorLiquido, Frete, Observacoes
       ) VALUES (?, NOW(), ?, ?, 1, ?, ?, ?, ?, 0, ?)`,
      [numeroPedido, clienteId, userId, formaPagamentoId, valorBruto, descontoValor, valorLiquido, observacoes]
    );
    const vendaId = vendaResult.insertId;

    // Inserir os itens da venda
    for (let i = 0; i < produtos.length; i++) {
      const produtoId = parseInt(produtos[i]);
      const quantidade = parseFloat(quantidades[i]);
      const precoUnitario = produtosMap.get(produtoId);

      await connection.query(
        `INSERT INTO ItemVenda (VendaID, ProdutoID, Quantidade, PrecoUnitario, TotalItem) 
         VALUES (?, ?, ?, ?, ?)`,
        [vendaId, produtoId, quantidade, precoUnitario, quantidade * precoUnitario]
      );
      
      // Atualizar o estoque
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

    // Totais
    const [[totalVendasRow]] = await pool.query(`SELECT COUNT(*) AS totalVendas FROM Venda v ${whereUser}`, params);
    const [[totalValorRow]]  = await pool.query(`SELECT IFNULL(SUM(v.ValorLiquido), 0) AS totalValor FROM Venda v ${whereUser}`, params);

    // Top produtos
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

    await pool.query(
      `INSERT INTO Produto (Codigo, Nome, Categoria, Subcategoria, PrecoCusto, PrecoVenda, UnidadeMedida, EstoqueAtual, EstoqueMinimo, FornecedorID) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id]
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
      `UPDATE Produto SET Codigo=?, Nome=?, Categoria=?, Subcategoria=?, PrecoCusto=?, PrecoVenda=?, UnidadeMedida=?, EstoqueAtual=?, EstoqueMinimo=?, FornecedorID=? WHERE ProdutoID=?`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id, produtoId]
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
    await pool.query(`DELETE FROM Produto WHERE ProdutoID = ?`, [produtoId]);
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

// ================================================
// EXPORT
// ================================================
module.exports = router;
