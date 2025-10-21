-- ===================================================
-- BANCO DE DADOS AGROVALE - ESTRUTURA COMPLETA 2025
-- Inclui controle de usuário admin e role-based access
-- ===================================================

-- DROP + CREATE DATABASE
DROP DATABASE IF EXISTS agrovale;
CREATE DATABASE agrovale CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agrovale;

-- ===============================
-- TABELA: DimTempo
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

-- ===============================
-- TABELA: Cliente
-- ===============================
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

-- ===============================
-- TABELA: Produto
-- ===============================
CREATE TABLE Produto (
    ProdutoID INT PRIMARY KEY AUTO_INCREMENT,
    Codigo VARCHAR(32) UNIQUE NOT NULL,
    Nome VARCHAR(100) NOT NULL,
    Categoria VARCHAR(50) NOT NULL,
    Subcategoria VARCHAR(50),
    PrecoCusto DECIMAL(10,2),
    PrecoVenda DECIMAL(10,2) NOT NULL,
    UnidadeMedida VARCHAR(20),
    EstoqueAtual INT DEFAULT 0,
    EstoqueMinimo INT DEFAULT 5,
    FornecedorID VARCHAR(100),
    Ativo TINYINT(1) DEFAULT 1,
    DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_produto_categoria (Categoria),
    INDEX idx_produto_nome (Nome)
);

-- ===============================
-- TABELA: FormaPagamento
-- ===============================
CREATE TABLE FormaPagamento (
    PagamentoID INT PRIMARY KEY AUTO_INCREMENT,
    Nome VARCHAR(50) NOT NULL UNIQUE,
    Descricao VARCHAR(100),
    Parcelamento TINYINT(1) DEFAULT 0,
    Taxa DECIMAL(5,2) DEFAULT 0,
    DiasRecebimento INT DEFAULT 0
);

-- ===============================
-- TABELA: Usuarios
-- ===============================
CREATE TABLE Usuarios (
    UsuarioID INT PRIMARY KEY AUTO_INCREMENT,
    Nome VARCHAR(100) NOT NULL,
    CPF VARCHAR(14) UNIQUE,
    Email VARCHAR(100),
    Telefone VARCHAR(20),
    Comissao DECIMAL(5,2) DEFAULT 0,
    NomeUsuario VARCHAR(50) UNIQUE NOT NULL,
    Senha VARCHAR(255) NOT NULL,
    Role ENUM('user','admin') NOT NULL DEFAULT 'user',
    Ativo TINYINT(1) DEFAULT 1,
    DataCadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- TABELA: Venda
-- ===============================
CREATE TABLE Venda (
    VendaID INT PRIMARY KEY AUTO_INCREMENT,
    NumeroPedido VARCHAR(20) UNIQUE,
    DataVenda DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ClienteID INT NOT NULL,
    UsuarioID INT NOT NULL,
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

-- ===============================
-- TABELA: ItemVenda
-- ===============================
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

-- ===============================
-- TABELA: Parcela
-- ===============================
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

-- ===============================
-- TABELA: HistoricoStatusVenda
-- ===============================
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
-- TABELA: LogAuditoria
-- ===============================
CREATE TABLE LogAuditoria (
    LogID INT PRIMARY KEY AUTO_INCREMENT,
    UsuarioID INT NOT NULL,
    Acao VARCHAR(100) NOT NULL,
    TabelaAfetada VARCHAR(50) NOT NULL,
    RegistroID INT,
    Descricao TEXT,
    DataHora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID)
);

-- ===============================
-- DADOS EXEMPLO
-- ===============================
INSERT INTO Cliente (Nome, Tipo, CPF_CNPJ, Email, Telefone, Endereco, Cidade, Estado)
VALUES 
  ('Cliente A', 'PF', '000.000.000-00', 'clientea@email.com', '11911111111', 'Rua 1', 'São Paulo', 'SP'),
  ('Cliente B', 'PJ', '11.111.111/0001-11', 'clienteb@email.com', '11922222222', 'Rua 2', 'Campinas', 'SP');

INSERT INTO DimTempo (DataCompleta, Dia, Mes, Ano, Trimestre, Semana, DiaSemana, Feriado, FinalSemana)
VALUES ('2025-10-20', 20, 10, 2025, 4, 43, 'Segunda', 0, 0);

INSERT INTO FormaPagamento (Nome, Descricao, Parcelamento, Taxa, DiasRecebimento)
VALUES ('Dinheiro', 'Pagamento à vista', 0, 0, 0);

-- ===============================
-- USUÁRIOS PADRÃO
-- ===============================
-- Senha admin123
INSERT INTO Usuarios (Nome, CPF, Email, Telefone, Comissao, NomeUsuario, Senha, Role, Ativo)
VALUES ('Administrador', NULL, 'admin@local', NULL, 0, 'admin',
'$2a$10$2Vy4oQe0v8Zy1HhJb8n0E.6b1z9m7o9c8yQmVJ7Kqk6k2m8Xq7XSO', 'admin', 1);

-- Senha vendedor123
INSERT INTO Usuarios (Nome, CPF, Email, Telefone, Comissao, NomeUsuario, Senha, Role, Ativo)
VALUES ('Vendedor 1', '000.111.222-33', 'vendedor1@local', '11933334444', 5.00, 'vendedor1',
'$2a$10$D/a3qW01zWmTCYbwKrXyVesjQ4A1ImM32F3rwhFyYAZ2yP0j5rqKm', 'user', 1);

-- ===============================
-- PRODUTOS EXEMPLO
-- ===============================
INSERT INTO Produto (Codigo, Nome, Categoria, PrecoCusto, PrecoVenda, UnidadeMedida, EstoqueAtual, EstoqueMinimo, Ativo)
VALUES
('P001', 'Coleira tamanho G', 'Acessórios', 5.00, 8.00, 'Unidade', 15, 2, 1),
('P002', 'Ração Premium 10kg', 'Alimentos', 60.00, 90.00, 'Pacote', 8, 2, 1);

-- ===============================
-- TRIGGERS
-- ===============================
DELIMITER $$

CREATE TRIGGER trg_venda_before_insert
BEFORE INSERT ON Venda FOR EACH ROW
BEGIN
  IF NEW.UsuarioID IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'UsuarioID não pode ser nulo.';
  END IF;
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

-- ===============================
-- 💾 TESTE: VENDA EXEMPLO
-- ===============================
INSERT INTO Venda (NumeroPedido, ClienteID, UsuarioID, TempoID, FormaPagamentoID, ValorBruto, Desconto, ValorLiquido, Frete, Status)
VALUES ('VENDA-TESTE-001', 1, 2, 1, 1, 8.00, 0.00, 8.00, 0.00, 'Confirmada');

INSERT INTO ItemVenda (VendaID, ProdutoID, Quantidade, PrecoUnitario, DescontoItem)
VALUES (1, 1, 1, 8.00, 0.00);
