const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('./auth');
const adminUsuarios = require('./admin.usuarios');
const { registrarLog } = require('../utils/logHelper');

// 🔐 Autenticação e rotas administrativas
router.use('/', auth);
router.use('/admin/usuarios', adminUsuarios);

// 🔒 Middleware para proteger rotas apenas de administradores
function verificarAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.render('acesso-negado', { usuario: req.session.user });
  }

  next();
}

/* ===============================
   ROTA RAIZ
=============================== */
router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

/* ===============================
   DASHBOARD (com busca de produtos)
=============================== */
router.get('/dashboard', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  const termo = (req.query.termo || '').trim();

  try {
    const [[{ totalProdutos }]] = await pool.query(
      'SELECT COUNT(*) AS totalProdutos FROM Produto'
    );
    const [[{ totalVendas }]] = await pool.query(
      'SELECT COUNT(*) AS totalVendas FROM Venda'
    );
    const [[{ totalVendido }]] = await pool.query(
      'SELECT IFNULL(SUM(ValorLiquido), 0) AS totalVendido FROM Venda'
    );

    let produtos = [];
    if (termo) {
      const [rows] = await pool.query(
        `
        SELECT ProdutoID, Codigo, Nome, PrecoVenda, EstoqueAtual
        FROM Produto
        WHERE Nome LIKE ? OR Codigo LIKE ?
        ORDER BY Nome
      `,
        [`%${termo}%`, `%${termo}%`]
      );
      produtos = rows.map(r => ({
        ...r,
        PrecoVenda: Number(r.PrecoVenda || 0),
        EstoqueAtual: Number(r.EstoqueAtual || 0),
      }));
    }

    res.render('dashboard', {
      termo,
      produtos, // sempre definido
      totalProdutos,
      totalVendas,
      totalVendido,
      user: req.session.user,
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    res.status(500).send('Erro ao carregar dashboard: ' + err.message);
  }
});

/* ===============================
   PRODUTOS
=============================== */
router.get('/produtos', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const [rows] = await pool.query(`
      SELECT 
        ProdutoID, Codigo, Nome, Categoria, Subcategoria,
        PrecoCusto, PrecoVenda, UnidadeMedida,
        EstoqueAtual, EstoqueMinimo, FornecedorID, Ativo
      FROM Produto
      ORDER BY Nome
    `);

    const produtos = rows.map(p => ({
      ...p,
      PrecoVenda: Number(p.PrecoVenda || 0),
      PrecoCusto: Number(p.PrecoCusto || 0),
      EstoqueAtual: Number(p.EstoqueAtual || 0),
      Ativo: Number(p.Ativo || 0),
    }));

    res.render('produtos', { produtos });
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    res.status(500).send('Erro ao buscar produtos: ' + err.message);
  }
});

/* -------- Formulário: novo produto -------- */
router.get('/produtos/criar', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  res.render('produto-form', {
    produto: null,
    title: 'Novo Produto',
    action: '/produtos/criar'
  });
});


/* -------- Criar produto -------- */
router.post('/produtos/criar', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const {
      nome_produto,
      categoria,
      subcategoria,
      preco_custo,
      margem_lucro,
      unidade_medida,
      quantidade_estoque,
      estoque_minimo,
      fornecedor_id,
    } = req.body;

    const precoCusto = Number(preco_custo || 0);
    const margem = Number(margem_lucro || 0);
    const precoVenda = precoCusto * (1 + margem / 100);

    const [result] = await pool.query(
      `
      INSERT INTO Produto 
        (Codigo, Nome, Categoria, Subcategoria, PrecoCusto, PrecoVenda, UnidadeMedida,
        EstoqueAtual, EstoqueMinimo, FornecedorID, Ativo)
      VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      [
        nome_produto,
        categoria || '',
        subcategoria || null,
        precoCusto,
        precoVenda,
        unidade_medida || 'un',
        Number(quantidade_estoque || 0),
        Number(estoque_minimo || 0),
        fornecedor_id || null,
      ]
    );

    await registrarLog(
      req.session.user.id,
      'Cadastro de Produto',
      'Produto',
      result.insertId,
      `Produto "${nome_produto}" criado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).send('Erro ao criar produto: ' + err.message);
  }
});

/* -------- Formulário: editar produto -------- */
router.get('/produtos/editar/:id', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const produtoId = req.params.id;
    const [[produto]] = await pool.query(
      `SELECT * FROM Produto WHERE ProdutoID = ?`,
      [produtoId]
    );

    if (!produto) return res.status(404).send('Produto não encontrado');

      const precoCusto = Number(produto.PrecoCusto) || 0;
      const precoVenda = Number(produto.PrecoVenda) || 0;

      if (precoCusto > 0) {
        produto.margem_lucro = (((precoVenda - precoCusto) / precoCusto) * 100).toFixed(2);
      } else {
        produto.margem_lucro = 0;
      }

    res.render('produto-form', {
      produto,
      title: 'Editar Produto',
      action: `/produtos/editar/${produtoId}`,
    });
  } catch (err) {
    console.error('Erro ao carregar produto:', err);
    res.status(500).send('Erro ao carregar produto: ' + err.message);
  }
});

/* -------- Atualizar produto -------- */
router.post('/produtos/editar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const produtoId = req.params.id;
    const {
      nome_produto,
      categoria,
      subcategoria,
      preco_custo,
      margem_lucro,
      unidade_medida,
      fornecedor_id,
    } = req.body;

    const precoCusto = Number(preco_custo || 0);
    const margem = Number(margem_lucro || 0);
    const precoVenda = precoCusto * (1 + margem / 100);

    await pool.query(
      `
      UPDATE Produto SET
        Nome = ?,
        Categoria = ?,
        Subcategoria = ?,
        PrecoCusto = ?,
        PrecoVenda = ?,
        UnidadeMedida = ?,
        FornecedorID = ?
      WHERE ProdutoID = ?
    `,
      [
        nome_produto,
        categoria || '',
        subcategoria || null,
        precoCusto,
        precoVenda,
        unidade_medida || 'un',
        fornecedor_id || null,
        produtoId,
      ]
    );

    await registrarLog(
      req.session.user.id,
      'Atualização de Produto',
      'Produto',
      produtoId,
      `Produto "${nome_produto}" atualizado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).send('Erro ao atualizar produto: ' + err.message);
  }
});

/* -------- Inativar produto -------- */
router.post('/produtos/inativar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const produtoId = req.params.id;
    const [[produto]] = await pool.query(
      `SELECT Nome FROM Produto WHERE ProdutoID = ?`,
      [produtoId]
    );

    await pool.query(`UPDATE Produto SET Ativo = 0 WHERE ProdutoID = ?`, [produtoId]);

    await registrarLog(
      req.session.user.id,
      'Inativação de Produto',
      'Produto',
      produtoId,
      `Produto "${(produto && produto.Nome) || produtoId}" inativado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error('Erro ao inativar produto:', err);
    res.status(500).send('Erro ao inativar produto: ' + err.message);
  }
});

/* -------- Reativar produto -------- */
router.post('/produtos/ativar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const produtoId = req.params.id;

    await pool.query(`UPDATE Produto SET Ativo = 1 WHERE ProdutoID = ?`, [produtoId]);

    await registrarLog(
      req.session.user.id,
      'Reativação de Produto',
      'Produto',
      produtoId,
      `Produto ${produtoId} reativado por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error('Erro ao reativar produto:', err);
    res.status(500).send('Erro ao reativar produto: ' + err.message);
  }
});

/* ===============================
   CLIENTES
=============================== */
router.get('/clientes', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  try {
    const [clientes] = await pool.query(`
      SELECT 
        ClienteID,
        Nome,
        CPF_CNPJ,
        Email,
        Telefone,
        Endereco,
        COALESCE(Ativo, 1) AS Ativo
      FROM Cliente
      ORDER BY Nome
    `);

    res.render('clientes', { clientes });
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).send('Erro ao buscar clientes: ' + err.message);
  }
});

/* -------- Formulário: Novo Cliente -------- */
router.get('/clientes/novo', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  res.render('cliente-form', {
    cliente: null,
    title: 'Novo Cliente',
    action: '/clientes/novo'
  });
});

/* -------- Criar Cliente -------- */
router.post('/clientes/novo', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    const [result] = await pool.query(
      `
      INSERT INTO Cliente (Nome, CPF_CNPJ, Email, Telefone, Endereco, Ativo)
      VALUES (?, ?, ?, ?, ?, 1)
    `,
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
    console.error('Erro ao cadastrar cliente:', err);
    res.status(500).send('Erro ao cadastrar cliente: ' + err.message);
  }
});

/* -------- Formulário: Editar Cliente -------- */
router.get('/clientes/editar/:id', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const clienteId = req.params.id;
    const [[cliente]] = await pool.query(
      `SELECT * FROM Cliente WHERE ClienteID = ?`,
      [clienteId]
    );

    if (!cliente) return res.status(404).send('Cliente não encontrado.');

    res.render('cliente-form', {
      cliente,
      title: 'Editar Cliente',
      action: `/clientes/editar/${clienteId}`
    });
  } catch (err) {
    console.error('Erro ao buscar cliente:', err);
    res.status(500).send('Erro ao buscar cliente: ' + err.message);
  }
});

/* -------- Atualizar Cliente -------- */
router.post('/clientes/editar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const clienteId = req.params.id;
    const { nome, cpf_cnpj, email, telefone, endereco } = req.body;

    await pool.query(
      `
      UPDATE Cliente
      SET Nome = ?, CPF_CNPJ = ?, Email = ?, Telefone = ?, Endereco = ?
      WHERE ClienteID = ?
    `,
      [nome, cpf_cnpj, email, telefone, endereco, clienteId]
    );

    await registrarLog(
      req.session.user.id,
      'Alteração de Cliente',
      'Cliente',
      clienteId,
      `Cliente "${nome}" atualizado por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error('Erro ao atualizar cliente:', err);
    res.status(500).send('Erro ao atualizar cliente: ' + err.message);
  }
});

/* -------- Inativar Cliente -------- */
router.post('/clientes/inativar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const clienteId = req.params.id;
    const [[cliente]] = await pool.query(
      `SELECT Nome FROM Cliente WHERE ClienteID = ?`,
      [clienteId]
    );

    if (!cliente) return res.status(404).send('Cliente não encontrado.');

    await pool.query(`UPDATE Cliente SET Ativo = 0 WHERE ClienteID = ?`, [clienteId]);

    await registrarLog(
      req.session.user.id,
      'Inativação de Cliente',
      'Cliente',
      clienteId,
      `Cliente "${cliente.Nome}" inativado por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error('Erro ao inativar cliente:', err);
    res.status(500).send('Erro ao inativar cliente: ' + err.message);
  }
});

/* -------- Reativar Cliente -------- */
router.post('/clientes/ativar/:id', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  try {
    const clienteId = req.params.id;

    await pool.query(`UPDATE Cliente SET Ativo = 1 WHERE ClienteID = ?`, [clienteId]);

    await registrarLog(
      req.session.user.id,
      'Reativação de Cliente',
      'Cliente',
      clienteId,
      `Cliente ${clienteId} reativado por ${req.session.user.nome}`
    );

    res.redirect('/clientes');
  } catch (err) {
    console.error('Erro ao reativar cliente:', err);
    res.status(500).send('Erro ao reativar cliente: ' + err.message);
  }
});

/* ===============================
   ESTATÍSTICAS
=============================== */
router.get('/estatisticas', verificarAdmin, async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  const filtro = req.query.periodo || 'mes';
  const dataSelecionada = req.query.data || new Date().toISOString().split('T')[0];

  let whereClause = '';
  if (filtro === 'dia') {
    whereClause = `DATE(v.DataVenda) = DATE('${dataSelecionada}')`;
  } else if (filtro === 'mes') {
    whereClause = `MONTH(v.DataVenda) = MONTH('${dataSelecionada}') AND YEAR(v.DataVenda) = YEAR('${dataSelecionada}')`;
  } else {
    whereClause = `YEAR(v.DataVenda) = YEAR('${dataSelecionada}')`;
  }

  try {
    // 🔹 Total de vendas e valor total vendido
    const [[{ totalVendas, totalValor }]] = await pool.query(`
      SELECT 
        COUNT(v.VendaID) AS totalVendas,
        COALESCE(SUM(v.ValorLiquido), 0) AS totalValor
      FROM Venda v
      WHERE ${whereClause};
    `);

    // 🔹 Ticket médio (média de valor líquido por venda)
    const [[{ ticketMedio }]] = await pool.query(`
      SELECT 
        COALESCE(AVG(v.ValorLiquido), 0) AS ticketMedio
      FROM Venda v
      WHERE ${whereClause};
    `);

    // 🔹 Produtos mais vendidos
    const [topProdutos] = await pool.query(`
      SELECT p.Nome AS nome_produto, SUM(iv.Quantidade) AS qtd
      FROM ItemVenda iv
      JOIN Produto p ON p.ProdutoID = iv.ProdutoID
      JOIN Venda v ON v.VendaID = iv.VendaID
      WHERE ${whereClause}
      GROUP BY p.Nome
      ORDER BY qtd DESC
      LIMIT 5;
    `);

    // 🔹 Formas de pagamento (gráfico de pizza)
    const [formasPagamento] = await pool.query(`
      SELECT fp.Nome AS nome, COALESCE(SUM(v.ValorLiquido), 0) AS total
      FROM Venda v
      JOIN FormaPagamento fp ON fp.PagamentoID = v.FormaPagamentoID
      WHERE ${whereClause}
      GROUP BY fp.Nome;
    `);

    res.render('estatisticas', {
      title: 'Estatísticas',
      totalVendas: Number(totalVendas) || 0,
      totalValor: Number(totalValor) || 0,
      ticketMedio: Number(ticketMedio) || 0,
      topProdutos,
      formasPagamento,
      filtro,
      dataSelecionada
    });
  } catch (err) {
    console.error('Erro ao gerar estatísticas:', err);
    res.status(500).send('Erro ao gerar estatísticas: ' + err.message);
  }
});

/* ===============================
   VENDAS
=============================== */
router.get('/vendas', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const [vendas] = await pool.query(`
      SELECT 
        v.VendaID,
        v.DataVenda,
        v.ValorLiquido,
        c.Nome AS ClienteNome,
        u.Nome AS VendedorNome
      FROM Venda v
      INNER JOIN Cliente c ON v.ClienteID = c.ClienteID
      INNER JOIN Usuarios u ON v.UsuarioID = u.UsuarioID
      ORDER BY v.DataVenda DESC
      LIMIT 20
    `);

    const [clientes] = await pool.query(
      `SELECT ClienteID, Nome FROM Cliente ORDER BY Nome`
    );
    const [produtos] = await pool.query(
      `SELECT ProdutoID, Nome, PrecoVenda FROM Produto WHERE Ativo = 1 OR Ativo IS NULL ORDER BY Nome`
    );
    const [formasPagamento] = await pool.query(
      `SELECT PagamentoID, Nome FROM FormaPagamento ORDER BY Nome`
    );

    res.render('vendas', {
      vendas: vendas || [],
      clientes,
      produtos,
      formasPagamento,
    });
  } catch (err) {
    console.error('Erro ao carregar página de vendas:', err);
    res.status(500).send('Erro ao carregar página de vendas: ' + err.message);
  }
});

router.get('/vendas/nova', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const [clientes] = await pool.query(
      `SELECT ClienteID, Nome, CPF_CNPJ FROM Cliente ORDER BY Nome`
    );
    const [produtos] = await pool.query(
      `
      SELECT ProdutoID, Nome, PrecoVenda, UnidadeMedida
      FROM Produto
      WHERE Ativo = 1 OR Ativo IS NULL
      ORDER BY Nome
    `
    );
    const [formasPagamento] = await pool.query(
      `SELECT PagamentoID, Nome FROM FormaPagamento ORDER BY Nome`
    );

    res.render('venda-nova', { clientes, produtos, formasPagamento });
  } catch (err) {
    console.error('Erro ao carregar página de nova venda:', err);
    res.status(500).send('Erro ao carregar página de nova venda: ' + err.message);
  }
});

router.post('/vendas/criar', async (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).send('Não autorizado');

  let {
    clienteId,
    formaPagamentoId,
    produtos,
    quantidades,
    valores_unitarios,
    valores_totais,
    valor_bruto,
    desconto,
    valor_liquido,
    observacoes,
  } = req.body;

  const usuarioId = req.session.user.id;

  try {
    valor_bruto = Number(valor_bruto || 0);
    desconto = Number(desconto || 0); // %
    valor_liquido = Number(valor_liquido || 0);

    const descontoEmReais = (valor_bruto * desconto) / 100;
    valor_liquido = valor_bruto - descontoEmReais;

    const [resultVenda] = await pool.query(
      `
      INSERT INTO Venda
        (ClienteID, UsuarioID, DataVenda, ValorBruto, Desconto, ValorLiquido, FormaPagamentoID, Observacoes)
      VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
    `,
      [
        clienteId,
        usuarioId,
        valor_bruto,
        descontoEmReais,
        valor_liquido,
        formaPagamentoId,
        observacoes || null,
      ]
    );

    const vendaId = resultVenda.insertId;

    for (let i = 0; i < produtos.length; i++) {
      const produtoId = produtos[i];
      const qtd = Number(quantidades[i] || 0);
      const preco = Number(valores_unitarios[i] || 0);
      const total = Number(valores_totais[i] || 0);

      await pool.query(
        `
        INSERT INTO ItemVenda (VendaID, ProdutoID, Quantidade, PrecoUnitario, TotalItem)
        VALUES (?, ?, ?, ?, ?)
      `,
        [vendaId, produtoId, qtd, preco, total]
      );

      await pool.query(
        `UPDATE Produto SET EstoqueAtual = EstoqueAtual - ? WHERE ProdutoID = ?`,
        [qtd, produtoId]
      );
    }

    await registrarLog(
      usuarioId,
      'Cadastro de Venda',
      'Venda',
      vendaId,
      `Venda ${vendaId} registrada pelo usuário ${req.session.user.nome}`
    );

    res.redirect(`/vendas/detalhes/${vendaId}`);
  } catch (err) {
    console.error('Erro ao registrar venda:', err);
    res.status(500).send('Erro ao registrar venda: ' + err.message);
  }
});

router.get('/vendas/detalhes/:id', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  const vendaId = req.params.id;

  try {
    const [[venda]] = await pool.query(
      `
      SELECT 
        v.VendaID, v.DataVenda,
        v.ValorBruto, v.Desconto, v.ValorLiquido, v.Status, v.Observacoes,
        c.Nome AS ClienteNome, c.Email AS ClienteEmail, c.Telefone AS ClienteTelefone,
        u.Nome AS VendedorNome
      FROM Venda v
      INNER JOIN Cliente c ON v.ClienteID = c.ClienteID
      INNER JOIN Usuarios u ON v.UsuarioID = u.UsuarioID
      WHERE v.VendaID = ?
    `,
      [vendaId]
    );

    if (!venda) return res.status(404).send('Venda não encontrada.');

    const [itens] = await pool.query(
      `
      SELECT 
        iv.ItemID, p.Nome AS ProdutoNome,
        iv.Quantidade, iv.PrecoUnitario, iv.DescontoItem, iv.TotalItem
      FROM ItemVenda iv
      INNER JOIN Produto p ON iv.ProdutoID = p.ProdutoID
      WHERE iv.VendaID = ?
    `,
      [vendaId]
    );

    res.render('venda-detalhes', { venda, itens });
  } catch (err) {
    console.error('Erro ao carregar detalhes da venda:', err);
    res.status(500).send('Erro ao carregar detalhes da venda: ' + err.message);
  }
});

/* ===============================
   RELATÓRIOS / AUDITORIA
=============================== */
router.get('/relatorios/auditoria', verificarAdmin, async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  return res.send(`
    <script>
      alert('🚫 Acesso negado! Apenas administradores podem visualizar o relatório de auditoria.');
      window.location.href = '/dashboard';
    </script>
  `);

  try {
    const filtroUsuario = req.query.usuario || '';
    const filtroAcao = req.query.acao || '';
    const filtroInicio = req.query.dataInicio || '';
    const filtroFim = req.query.dataFim || '';

    const where = [];
    const params = [];

    if (filtroUsuario) {
      where.push('u.Nome LIKE ?');
      params.push('%' + filtroUsuario + '%');
    }
    if (filtroAcao) {
      where.push('l.Acao = ?');
      params.push(filtroAcao);
    }
    if (filtroInicio) {
      where.push('l.DataHora >= ?');
      params.push(filtroInicio);
    }
    if (filtroFim) {
      where.push('l.DataHora <= ?');
      params.push(filtroFim);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [logs] = await pool.query(
      `
      SELECT 
        l.LogID, l.UsuarioID, u.Nome AS Usuario,
        l.Acao, l.TabelaAfetada, l.RegistroID, l.Descricao, l.DataHora
      FROM LogAuditoria l
      INNER JOIN Usuarios u ON l.UsuarioID = u.UsuarioID
      ${whereClause}
      ORDER BY l.DataHora DESC
      LIMIT 100
    `,
      params
    );

    res.render('relatorio-auditoria', {
      logs,
      filtroUsuario,
      filtroAcao,
      filtroInicio,
      filtroFim,
    });
  } catch (err) {
    console.error('Erro ao carregar auditoria:', err);
    res.status(500).send('Erro ao carregar auditoria: ' + err.message);
  }
});

/* -------- Tela de entrada -------- */
router.get('/produtos/entrada', verificarAdmin, async (req, res) => {
  try {
    const [produtos] = await pool.query(`
      SELECT ProdutoID, Nome, Codigo, EstoqueAtual, PrecoCusto 
      FROM Produto 
      WHERE Ativo = 1
      ORDER BY Nome;
    `);

    const produtosFormatados = produtos.map(p => ({
      ...p,
      PrecoCusto: Number(p.PrecoCusto) || 0,
      EstoqueAtual: Number(p.EstoqueAtual) || 0
    }));

    res.render('entrada-mercadoria', {
      title: 'Entrada de Mercadorias',
      produtos: produtosFormatados,
      usuario: req.session.user
    });
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    res.status(500).send('Erro ao carregar produtos: ' + err.message);
  }
});

/* -------- Registrar entrada -------- */
router.post('/produtos/entrada', verificarAdmin, async (req, res) => {
  try {
    const { produto_id, quantidade, preco_custo, margem_lucro } = req.body;

    const qtd = Number(quantidade || 0);
    const custo = Number(preco_custo || 0);
    const margem = Number(margem_lucro || 0);

    if (qtd <= 0 || custo <= 0) throw new Error('Quantidade ou custo inválido');

    const precoVenda = custo * (1 + margem / 100);

    await pool.query(
      `UPDATE Produto 
       SET EstoqueAtual = EstoqueAtual + ?, 
           PrecoCusto = ?, 
           PrecoVenda = ? 
       WHERE ProdutoID = ?`,
      [qtd, custo, precoVenda, produto_id]
    );

    await registrarLog(
      req.session.user.id,
      'Entrada de Mercadoria',
      'Produto',
      produto_id,
      `Entrada de ${qtd} unidades — custo R$${custo.toFixed(2)}, margem ${margem.toFixed(2)}% — atualizada por ${req.session.user.nome}`
    );

    res.redirect('/produtos');
  } catch (err) {
    console.error('Erro ao registrar entrada:', err);
    res.status(500).send('Erro ao registrar entrada: ' + err.message);
  }
});

module.exports = router;