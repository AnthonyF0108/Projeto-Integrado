-- =====================================================
-- BANCO DE DADOS: Agrovale
-- Versão corrigida com triggers funcionais
-- =====================================================

DROP DATABASE IF EXISTS agrovale;
CREATE DATABASE agrovale CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agrovale;

-- =======================
-- TABELA: CLIENTE
-- =======================
CREATE TABLE Cliente (
  ClienteID INT AUTO_INCREMENT PRIMARY KEY,
  Nome VARCHAR(100) NOT NULL,
  Tipo ENUM('PF','PJ') NOT NULL DEFAULT 'PF',
  CPF_CNPJ VARCHAR(18),
  Email VARCHAR(100),
  Telefone VARCHAR(20),
  Endereco VARCHAR(200),
  Cidade VARCHAR(50),
  Estado CHAR(2),
  LimiteCredito DECIMAL(10,2) DEFAULT 0.00,
  DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  Ativo TINYINT(1) DEFAULT 1,
  UNIQUE (CPF_CNPJ)
) ENGINE=InnoDB;

-- =======================
-- TABELA: FORMAPAGAMENTO
-- =======================
CREATE TABLE FormaPagamento (
  PagamentoID INT AUTO_INCREMENT PRIMARY KEY,
  Nome VARCHAR(50) NOT NULL,
  Descricao VARCHAR(100),
  Parcelamento TINYINT(1) DEFAULT 0,
  Taxa DECIMAL(5,2) DEFAULT 0.00,
  DiasRecebimento INT DEFAULT 0,
  UNIQUE (Nome)
) ENGINE=InnoDB;

-- =======================
-- TABELA: USUÁRIOS
-- =======================
CREATE TABLE Usuarios (
  UsuarioID INT AUTO_INCREMENT PRIMARY KEY,
  Nome VARCHAR(100) NOT NULL,
  CPF VARCHAR(14),
  Email VARCHAR(100),
  Telefone VARCHAR(20),
  Comissao DECIMAL(5,2) DEFAULT 0.00,
  NomeUsuario VARCHAR(50) NOT NULL UNIQUE,
  Senha VARCHAR(255) NOT NULL,
  Role ENUM('user','admin') DEFAULT 'admin',
  Ativo TINYINT(1) DEFAULT 1,
  DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =======================
-- TABELA: DIMTEMPO
-- =======================
CREATE TABLE DimTempo (
  TempoID INT AUTO_INCREMENT PRIMARY KEY,
  DataCompleta DATE NOT NULL UNIQUE,
  Dia INT NOT NULL,
  Mes INT NOT NULL,
  Ano INT NOT NULL,
  Trimestre INT NOT NULL,
  Semana INT NOT NULL,
  DiaSemana VARCHAR(15) NOT NULL,
  Feriado TINYINT(1) DEFAULT 0,
  FinalSemana TINYINT(1) DEFAULT 0
) ENGINE=InnoDB;

-- =======================
-- TABELA: PRODUTO
-- =======================
CREATE TABLE Produto (
  ProdutoID INT AUTO_INCREMENT PRIMARY KEY,
  Codigo VARCHAR(10) UNIQUE,
  Nome VARCHAR(100) NOT NULL,
  Categoria VARCHAR(50),
  Subcategoria VARCHAR(50),
  PrecoCusto DECIMAL(10,2) DEFAULT 0.00,
  PrecoVenda DECIMAL(10,2) DEFAULT 0.00,
  UnidadeMedida VARCHAR(20) DEFAULT 'un',
  EstoqueAtual INT DEFAULT 0,
  EstoqueMinimo INT DEFAULT 5,
  FornecedorID VARCHAR(100),
  Ativo TINYINT(1) DEFAULT 1,
  DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =======================
-- TABELA: VENDA
-- =======================
CREATE TABLE Venda (
  VendaID INT AUTO_INCREMENT PRIMARY KEY,
  DataVenda DATETIME DEFAULT CURRENT_TIMESTAMP,
  ClienteID INT NOT NULL,
  UsuarioID INT NOT NULL,
  TempoID INT DEFAULT 1,
  FormaPagamentoID INT NOT NULL,
  Status ENUM('Orçamento','Confirmada','Faturada','Cancelada') DEFAULT 'Confirmada',
  ValorBruto DECIMAL(10,2) NOT NULL,
  Desconto DECIMAL(10,2) DEFAULT 0.00,
  ValorLiquido DECIMAL(10,2) DEFAULT 0.00,
  Frete DECIMAL(10,2) DEFAULT 0.00,
  Observacoes TEXT,
  FOREIGN KEY (ClienteID) REFERENCES Cliente(ClienteID),
  FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
  FOREIGN KEY (TempoID) REFERENCES DimTempo(TempoID),
  FOREIGN KEY (FormaPagamentoID) REFERENCES FormaPagamento(PagamentoID)
) ENGINE=InnoDB;

-- =======================
-- TABELA: ITEMVENDA
-- =======================
CREATE TABLE ItemVenda (
  ItemID INT AUTO_INCREMENT PRIMARY KEY,
  VendaID INT NOT NULL,
  ProdutoID INT NOT NULL,
  Quantidade INT NOT NULL,
  PrecoUnitario DECIMAL(10,2) NOT NULL,
  DescontoItem DECIMAL(10,2) DEFAULT 0.00,
  TotalItem DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (VendaID) REFERENCES Venda(VendaID) ON DELETE CASCADE,
  FOREIGN KEY (ProdutoID) REFERENCES Produto(ProdutoID)
) ENGINE=InnoDB;

-- =======================
-- TABELA: LOGAUDITORIA
-- =======================
CREATE TABLE LogAuditoria (
  LogID INT AUTO_INCREMENT PRIMARY KEY,
  UsuarioID INT NOT NULL,
  Acao VARCHAR(100) NOT NULL,
  TabelaAfetada VARCHAR(50) NOT NULL,
  RegistroID INT,
  Descricao TEXT,
  DataHora DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID)
) ENGINE=InnoDB;

-- =======================
-- TABELA: SESSIONS
-- =======================
CREATE TABLE Sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT
) ENGINE=InnoDB;

-- =====================================================
-- 🔥 TRIGGERS CORRIGIDAS
-- =====================================================

DELIMITER $$

-- Trigger: Calcula ValorLiquido na Venda
CREATE TRIGGER trg_venda_before_insert
BEFORE INSERT ON Venda
FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0), 2);
END$$

CREATE TRIGGER trg_venda_before_update
BEFORE UPDATE ON Venda
FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0), 2);
END$$

-- Trigger: Gera código automático do produto
CREATE TRIGGER trg_auto_codigo_produto
BEFORE INSERT ON Produto
FOR EACH ROW
BEGIN
  DECLARE proxCodigo INT;
  DECLARE codigoFormatado VARCHAR(10);

  SELECT IFNULL(MAX(CAST(Codigo AS UNSIGNED)), 0) + 1 INTO proxCodigo FROM Produto;
  SET codigoFormatado = LPAD(proxCodigo, 5, '0');

  IF NEW.Codigo IS NULL OR NEW.Codigo = '' THEN
    SET NEW.Codigo = codigoFormatado;
  END IF;
END$$

-- Trigger: Calcula Total do Item de Venda
CREATE TRIGGER trg_itemvenda_before_insert
BEFORE INSERT ON ItemVenda
FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)), 2);
END$$

CREATE TRIGGER trg_itemvenda_before_update
BEFORE UPDATE ON ItemVenda
FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)), 2);
END$$

DELIMITER ;

-- ==============================
-- INSERÇÕES INICIAIS
-- ==============================

-- Formas de Pagamento
INSERT INTO FormaPagamento (Nome, Descricao, Parcelamento, Taxa, DiasRecebimento) VALUES
('Dinheiro', 'Pagamento em espécie', 0, 0.00, 0),
('Cartão de Crédito', 'Visa, Master, etc.', 1, 2.99, 30),
('Cartão de Débito', 'Transação imediata', 0, 1.50, 0),
('Pix', 'Pagamento instantâneo', 0, 0.00, 0),
('Boleto', 'Vencimento em até 3 dias úteis', 0, 0.00, 3);

-- Usuário Admin
INSERT INTO Usuarios (Nome, NomeUsuario, Senha, Role)
VALUES ('Administrador', 'admin', '$2a$10$qX4KlHLHC/yCj8v7HjLbmOHeKHvJTLrKxg3hzgViCrBrK/K1I9WCy', 'admin');
-- (senha: 1234, hash gerado com bcrypt)
