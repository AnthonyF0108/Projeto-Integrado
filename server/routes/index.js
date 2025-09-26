const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('./auth');

router.use('/', auth);

router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

router.get('/dashboard', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const userId = req.session.user.id;

    const [vendasRows] = await pool.query(`
      SELECT 
        v.VendaID, 
        v.NumeroPedido, 
        v.DataVenda, 
        v.ValorBruto, 
        v.Desconto, 
        v.ValorLiquido, 
        v.Status,
        u.UsuarioID AS VendedorID,
        u.Nome AS VendedorNome
      FROM Venda v
      INNER JOIN Usuarios u ON v.UsuarioID = u.UsuarioID
      WHERE v.UsuarioID = ?
    `, [userId]);

    const vendas = vendasRows.map(v => ({
      ...v,
      ValorBruto: parseFloat(v.ValorBruto),
      Desconto: parseFloat(v.Desconto),
      ValorLiquido: parseFloat(v.ValorLiquido)
    }));

    const [[{ totalClientes }]] = await pool.query(`SELECT COUNT(*) AS totalClientes FROM Cliente`);

    const [[{ estoqueBaixo }]] = await pool.query(`
      SELECT COUNT(*) AS estoqueBaixo 
      FROM Produto 
      WHERE EstoqueAtual < EstoqueMinimo
    `);

    const [[{ totalVendas }]] = await pool.query(
      `SELECT COUNT(*) AS totalVendas FROM Venda WHERE UsuarioID = ?`,
      [userId]
    );

    const [[{ totalValor }]] = await pool.query(
      `SELECT IFNULL(SUM(ValorLiquido),0) AS totalValor FROM Venda WHERE UsuarioID = ?`,
      [userId]
    );

    res.render('dashboard', { 
      user: req.session.user, 
      vendas, 
      totalClientes: Number(totalClientes) || 0, 
      estoqueBaixo: Number(estoqueBaixo) || 0, 
      totalVendas: Number(totalVendas) || 0, 
      totalValor: parseFloat(totalValor) || 0,
      error: null 
    });

  } catch (err) {
    console.error(err);
    res.render('dashboard', { 
      user: req.session.user, 
      vendas: [], 
      totalClientes: 0, 
      estoqueBaixo: 0, 
      totalVendas: 0, 
      totalValor: 0, 
      error: 'Erro ao carregar dashboard' 
    });
  }
});

// Rotas de Produtos
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

    res.render("produtos", { produtos: produtos });
  } catch (err) {
    console.error("Erro ao buscar produtos:", err);
    res.status(500).send("Erro ao buscar produtos: " + err.message);
  }
});

// Rota para exibir o formulário de novo produto
router.get("/produtos/criar", (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  res.render("produto-form", { produto: null, title: 'Novo Produto' });
});

// Rota para processar a criação de um novo produto
router.post("/produtos/criar", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const { codigo_externo, nome_produto, categoria, subcategoria, preco_custo, margem_lucro, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id } = req.body;
    
    // Cálculo do preço de venda com base na margem de lucro
    const preco_venda_calculado = parseFloat(preco_custo) * (1 + (parseFloat(margem_lucro) / 100));

    await pool.query(
      `INSERT INTO Produto (Codigo, Nome, Categoria, Subcategoria, PrecoCusto, PrecoVenda, UnidadeMedida, EstoqueAtual, EstoqueMinimo, FornecedorID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id]
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error("Erro ao criar produto:", err);
    res.status(500).send("Erro ao criar produto: " + err.message);
  }
});

// Rota para exibir o formulário de edição de produto (pré-preenchido)
router.get("/produtos/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const produtoId = req.params.id;
    const [rows] = await pool.query(`SELECT * FROM Produto WHERE ProdutoID = ?`, [produtoId]);

    if (rows.length === 0) {
      return res.status(404).send('Produto não encontrado');
    }

    const produto = rows[0];
    
    // Calcula a margem de lucro
    if (produto.PrecoCusto > 0) {
        produto.margem_lucro = ((parseFloat(produto.PrecoVenda) - parseFloat(produto.PrecoCusto)) / parseFloat(produto.PrecoCusto)) * 100;
    } else {
        produto.margem_lucro = 0; // Evita divisão por zero
    }
    
    // Limita o valor a duas casas decimais
    produto.margem_lucro = produto.margem_lucro.toFixed(2);
    
    res.render("produto-form", { produto: produto, title: 'Alterar Produto' });
  } catch (err) {
    console.error("Erro ao buscar produto para alteração:", err);
    res.status(500).send("Erro ao buscar produto: " + err.message);
  }
});

// Rota para processar a alteração de um produto
router.post("/produtos/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const produtoId = req.params.id;
    const { codigo_externo, nome_produto, categoria, subcategoria, preco_custo, margem_lucro, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id } = req.body;
    
    // Cálculo do preço de venda com base na margem de lucro
    const preco_venda_calculado = parseFloat(preco_custo) * (1 + (parseFloat(margem_lucro) / 100));
    
    await pool.query(
      `UPDATE Produto SET Codigo = ?, Nome = ?, Categoria = ?, Subcategoria = ?, PrecoCusto = ?, PrecoVenda = ?, UnidadeMedida = ?, EstoqueAtual = ?, EstoqueMinimo = ?, FornecedorID = ? WHERE ProdutoID = ?`,
      [codigo_externo, nome_produto, categoria, subcategoria, preco_custo, preco_venda_calculado, unidade_medida, quantidade_estoque, estoque_minimo, fornecedor_id, produtoId]
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error("Erro ao alterar produto:", err);
    res.status(500).send("Erro ao alterar produto: " + err.message);
  }
});

// Rota para excluir um produto
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

// =========================
// Estatísticas
// =========================
router.get("/estatisticas", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const userId = req.session.user.id;

    // Total de vendas do usuário
    const [[{ totalVendas }]] = await pool.query(
      `SELECT COUNT(*) AS totalVendas FROM Venda WHERE UsuarioID = ?`,
      [userId]
    );

    // Valor total vendido
    const [[{ totalValor }]] = await pool.query(
      `SELECT IFNULL(SUM(ValorLiquido),0) AS totalValor FROM Venda WHERE UsuarioID = ?`,
      [userId]
    );

    // Top 5 produtos mais vendidos
    const [topProdutos] = await pool.query(
      `SELECT p.Nome AS nome_produto, SUM(iv.Quantidade) AS qtd
       FROM ItemVenda iv
       INNER JOIN Produto p ON iv.ProdutoID = p.ProdutoID
       INNER JOIN Venda v ON iv.VendaID = v.VendaID
       WHERE v.UsuarioID = ?
       GROUP BY p.ProdutoID
       ORDER BY qtd DESC
       LIMIT 5`,
      [userId]
    );

    res.render("estatisticas", { 
      totalVendas: Number(totalVendas) || 0,
      totalValor: parseFloat(totalValor) || 0,
      topProdutos: topProdutos || []
    });
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
    res.status(500).send("Erro ao carregar estatísticas: " + err.message);
  }
});

// =========================
// Clientes
// =========================

// Listar clientes
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

// Exibir formulário de novo cliente
router.get("/clientes/novo", (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  res.render("clientes-form", { cliente: null, title: 'Novo Cliente' });
});

// Processar criação de cliente
router.post("/clientes/novo", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    await pool.query(
      `INSERT INTO Cliente (Nome, CPF_CNPJ, Email, Telefone, Endereco) VALUES (?, ?, ?, ?, ?)`,
      [nome, cpf_cnpj, email, telefone, endereco]
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao criar cliente:", err);
    res.status(500).send("Erro ao criar cliente: " + err.message);
  }
});

// Exibir formulário de edição
router.get("/clientes/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const clienteId = req.params.id;
    const [rows] = await pool.query(`SELECT * FROM Cliente WHERE ClienteID = ?`, [clienteId]);

    if (rows.length === 0) {
      return res.status(404).send('Cliente não encontrado');
    }

    res.render("clientes-form", { cliente: rows[0], title: 'Alterar Cliente' });
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    res.status(500).send("Erro ao buscar cliente: " + err.message);
  }
});

// Processar edição
router.post("/clientes/alterar/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const clienteId = req.params.id;
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    await pool.query(
      `UPDATE Cliente SET Nome = ?, CPF_CNPJ = ?, Email = ?, Telefone = ?, Endereco = ? WHERE ClienteID = ?`,
      [nome, cpf_cnpj, email, telefone, endereco, clienteId]
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao alterar cliente:", err);
    res.status(500).send("Erro ao alterar cliente: " + err.message);
  }
});

// Excluir cliente
router.post("/clientes/excluir/:id", async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('Não autorizado');
  try {
    const clienteId = req.params.id;
    await pool.query(`DELETE FROM Cliente WHERE ClienteID = ?`, [clienteId]);
    res.redirect('/clientes');
  } catch (err) {
    console.error("Erro ao excluir cliente:", err);
    res.status(500).send("Erro ao excluir cliente: " + err.message);
  }
});

module.exports = router;