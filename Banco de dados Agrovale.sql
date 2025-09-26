-- DROP + CREATE DATABASE
DROP DATABASE IF EXISTS agrovale;
CREATE DATABASE agrovale CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agrovale;

-- ===============================
-- TABELAS
-- ===============================

CREATE TABLE DimTempo (
    TempoID INT PRIMARY KEY AUTO_INCREMENT,
    DataCompleta DATE NOT NULL UNIQUE,
    Dia INT NOT NULL,
    Mes INT NOT NULL,
    Ano INT NOT NULL,
    Trimestre INT NOT NULL,
    Semana INT NOT NULL,
    DiaSemana VARCHAR(15) NOT NULL,
    Feriado TINYINT(1) DEFAULT 0,
    FinalSemana TINYINT(1) DEFAULT 0
);

CREATE TABLE Cliente (
    ClienteID INT PRIMARY KEY AUTO_INCREMENT,
    Nome VARCHAR(100) NOT NULL,
    Tipo ENUM('PF', 'PJ') NOT NULL,
    CPF_CNPJ VARCHAR(18) UNIQUE,
    Email VARCHAR(100),
    Telefone VARCHAR(20),
    Endereco VARCHAR(200),
    Cidade VARCHAR(50),
    Estado CHAR(2),
    LimiteCredito DECIMAL(10,2) DEFAULT 0,
    DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cliente_nome (Nome),
    INDEX idx_cliente_cidade (Cidade)
);

CREATE TABLE Produto (
    ProdutoID INT PRIMARY KEY AUTO_INCREMENT,
    Codigo VARCHAR(32) UNIQUE NOT NULL,
    Nome VARCHAR(100) NOT NULL,
    Categoria VARCHAR(50) NOT NULL,
    Subcategoria VARCHAR(50),
    PrecoCusto DECIMAL(10,2),
    PrecoVenda DECIMAL(10,2) NOT NULL,
    UnidadeMedida VARCHAR(20), -- Coluna Adicionada
    EstoqueAtual INT DEFAULT 0,
    EstoqueMinimo INT DEFAULT 5,
    FornecedorID VARCHAR(100),
    Ativo TINYINT(1) DEFAULT 1,
    DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP, -- Coluna Adicionada
    INDEX idx_produto_categoria (Categoria),
    INDEX idx_produto_nome (Nome)
);

CREATE TABLE FormaPagamento (
    PagamentoID INT PRIMARY KEY AUTO_INCREMENT,
    Nome VARCHAR(50) NOT NULL UNIQUE,
    Descricao VARCHAR(100),
    Parcelamento TINYINT(1) DEFAULT 0,
    Taxa DECIMAL(5,2) DEFAULT 0,
    DiasRecebimento INT DEFAULT 0
);

-- ===============================
-- Agora só existe Usuarios (unifica Vendedor + Usuarios)
-- ===============================
CREATE TABLE Usuarios (
    UsuarioID INT PRIMARY KEY AUTO_INCREMENT,
    Nome VARCHAR(100) NOT NULL,
    CPF VARCHAR(14) UNIQUE,
    Email VARCHAR(100),
    Telefone VARCHAR(20),
    Comissao DECIMAL(5,2) DEFAULT 0, -- herdado de Vendedor
    NomeUsuario VARCHAR(50) UNIQUE NOT NULL,
    Senha VARCHAR(255) NOT NULL,
    Ativo TINYINT(1) DEFAULT 1
);

CREATE TABLE Venda (
    VendaID INT PRIMARY KEY AUTO_INCREMENT,
    NumeroPedido VARCHAR(20) UNIQUE,
    DataVenda DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ClienteID INT NOT NULL,
    UsuarioID INT, -- substitui VendedorID
    TempoID INT NOT NULL,
    FormaPagamentoID INT NOT NULL,
    Status ENUM('Orçamento', 'Confirmada', 'Faturada', 'Cancelada') DEFAULT 'Confirmada',
    ValorBruto DECIMAL(10,2) NOT NULL,
    Desconto DECIMAL(10,2) DEFAULT 0,
    ValorLiquido DECIMAL(10,2) NOT NULL DEFAULT 0,
    Frete DECIMAL(10,2) DEFAULT 0,
    Observacoes TEXT,
    FOREIGN KEY (ClienteID) REFERENCES Cliente(ClienteID),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (TempoID) REFERENCES DimTempo(TempoID),
    FOREIGN KEY (FormaPagamentoID) REFERENCES FormaPagamento(PagamentoID),
    INDEX idx_venda_data (DataVenda),
    INDEX idx_venda_cliente (ClienteID),
    INDEX idx_venda_status (Status)
);

CREATE TABLE ItemVenda (
    ItemID INT PRIMARY KEY AUTO_INCREMENT,
    VendaID INT NOT NULL,
    ProdutoID INT NOT NULL,
    Quantidade INT NOT NULL,
    PrecoUnitario DECIMAL(10,2) NOT NULL,
    DescontoItem DECIMAL(10,2) DEFAULT 0,
    TotalItem DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (VendaID) REFERENCES Venda(VendaID) ON DELETE CASCADE,
    FOREIGN KEY (ProdutoID) REFERENCES Produto(ProdutoID),
    UNIQUE KEY (VendaID, ProdutoID),
    INDEX idx_item_venda (VendaID)
);

CREATE TABLE Parcela (
    ParcelaID INT PRIMARY KEY AUTO_INCREMENT,
    VendaID INT NOT NULL,
    NumeroParcela INT NOT NULL,
    DataVencimento DATE NOT NULL,
    Valor DECIMAL(10,2) NOT NULL,
    Status ENUM('Pendente', 'Paga', 'Atrasada', 'Cancelada') DEFAULT 'Pendente',
    DataPagamento DATE,
    FOREIGN KEY (VendaID) REFERENCES Venda(VendaID) ON DELETE CASCADE,
    INDEX idx_parcela_vencimento (DataVencimento),
    INDEX idx_parcela_status (Status)
);

CREATE TABLE HistoricoStatusVenda (
    HistoricoID INT PRIMARY KEY AUTO_INCREMENT,
    VendaID INT NOT NULL,
    StatusAnterior VARCHAR(50),
    StatusNovo VARCHAR(50) NOT NULL,
    DataAlteracao DATETIME DEFAULT CURRENT_TIMESTAMP,
    Responsavel VARCHAR(100),
    Observacao TEXT,
    FOREIGN KEY (VendaID) REFERENCES Venda(VendaID) ON DELETE CASCADE,
    INDEX idx_historico_venda (VendaID)
);

-- ===============================
-- DADOS EXEMPLO
-- ===============================

INSERT INTO Cliente (Nome, Tipo, CPF_CNPJ, Email, Telefone, Endereco, Cidade, Estado)
VALUES 
  ('Cliente A', 'PF', '000.000.000-00', 'clientea@email.com', '11911111111', 'Rua 1', 'São Paulo', 'SP'),
  ('Cliente B', 'PJ', '11.111.111/0001-11', 'clienteb@email.com', '11922222222', 'Rua 2', 'Campinas', 'SP');

INSERT INTO DimTempo (DataCompleta, Dia, Mes, Ano, Trimestre, Semana, DiaSemana, Feriado, FinalSemana)
VALUES ('2025-09-08', 8, 9, 2025, 3, 37, 'Segunda', 0, 0);

INSERT INTO FormaPagamento (Nome, Descricao, Parcelamento, Taxa, DiasRecebimento)
VALUES ('Dinheiro', 'Pagamento à vista', 0, 0, 0);

-- ===============================
-- TRIGGERS
-- ===============================
DELIMITER $$

CREATE TRIGGER trg_venda_before_insert
BEFORE INSERT ON Venda FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0),2);
END$$

CREATE TRIGGER trg_venda_before_update
BEFORE UPDATE ON Venda FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0),2);
END$$

CREATE TRIGGER trg_itemvenda_before_insert
BEFORE INSERT ON ItemVenda FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)),2);
END$$

CREATE TRIGGER trg_itemvenda_before_update
BEFORE UPDATE ON ItemVenda FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)),2);
END$$

DELIMITER ;
