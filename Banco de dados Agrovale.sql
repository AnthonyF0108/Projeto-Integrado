SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema agrovale
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `agrovale` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ;
USE `agrovale` ;

-- -----------------------------------------------------
-- Table `agrovale`.`cliente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`cliente` (
  `ClienteID` INT NOT NULL AUTO_INCREMENT,
  `Nome` VARCHAR(100) NOT NULL,
  `Tipo` ENUM('PF', 'PJ') NOT NULL DEFAULT 'PF',
  `CPF_CNPJ` VARCHAR(18) NULL DEFAULT NULL,
  `Email` VARCHAR(100) NULL DEFAULT NULL,
  `Telefone` VARCHAR(20) NULL DEFAULT NULL,
  `Endereco` VARCHAR(200) NULL DEFAULT NULL,
  `Cidade` VARCHAR(50) NULL DEFAULT NULL,
  `Estado` CHAR(2) NULL DEFAULT NULL,
  `LimiteCredito` DECIMAL(10,2) NULL DEFAULT '0.00',
  `DataCadastro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `Ativo` TINYINT(1) NULL DEFAULT '1',
  PRIMARY KEY (`ClienteID`),
  UNIQUE INDEX `CPF_CNPJ` (`CPF_CNPJ` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`dimtempo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`dimtempo` (
  `TempoID` INT NOT NULL AUTO_INCREMENT,
  `DataCompleta` DATE NOT NULL,
  `Dia` INT NOT NULL,
  `Mes` INT NOT NULL,
  `Ano` INT NOT NULL,
  `Trimestre` INT NOT NULL,
  `Semana` INT NOT NULL,
  `DiaSemana` VARCHAR(15) NOT NULL,
  `Feriado` TINYINT(1) NULL DEFAULT '0',
  `FinalSemana` TINYINT(1) NULL DEFAULT '0',
  PRIMARY KEY (`TempoID`),
  UNIQUE INDEX `DataCompleta` (`DataCompleta` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`formapagamento`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`formapagamento` (
  `PagamentoID` INT NOT NULL AUTO_INCREMENT,
  `Nome` VARCHAR(50) NOT NULL,
  `Descricao` VARCHAR(100) NULL DEFAULT NULL,
  `Parcelamento` TINYINT(1) NULL DEFAULT '0',
  `Taxa` DECIMAL(5,2) NULL DEFAULT '0.00',
  `DiasRecebimento` INT NULL DEFAULT '0',
  PRIMARY KEY (`PagamentoID`),
  UNIQUE INDEX `Nome` (`Nome` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`usuarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`usuarios` (
  `UsuarioID` INT NOT NULL AUTO_INCREMENT,
  `Nome` VARCHAR(100) NOT NULL,
  `CPF` VARCHAR(14) NULL DEFAULT NULL,
  `Email` VARCHAR(100) NULL DEFAULT NULL,
  `Telefone` VARCHAR(20) NULL DEFAULT NULL,
  `Comissao` DECIMAL(5,2) NULL DEFAULT '0.00',
  `NomeUsuario` VARCHAR(50) NOT NULL,
  `Senha` VARCHAR(255) NOT NULL,
  `Role` ENUM('user', 'admin') NULL DEFAULT 'admin',
  `Ativo` TINYINT(1) NULL DEFAULT '1',
  `DataCadastro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UsuarioID`),
  UNIQUE INDEX `NomeUsuario` (`NomeUsuario` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`venda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`venda` (
  `VendaID` INT NOT NULL AUTO_INCREMENT,
  `DataVenda` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `ClienteID` INT NOT NULL,
  `UsuarioID` INT NOT NULL,
  `TempoID` INT NULL DEFAULT '1',
  `FormaPagamentoID` INT NOT NULL,
  `Status` ENUM('Orçamento', 'Confirmada', 'Faturada', 'Cancelada') NULL DEFAULT 'Confirmada',
  `ValorBruto` DECIMAL(10,2) NOT NULL,
  `Desconto` DECIMAL(10,2) NULL DEFAULT '0.00',
  `ValorLiquido` DECIMAL(10,2) NULL DEFAULT '0.00',
  `Frete` DECIMAL(10,2) NULL DEFAULT '0.00',
  `Observacoes` TEXT NULL DEFAULT NULL,
  PRIMARY KEY (`VendaID`),
  INDEX `ClienteID` (`ClienteID` ASC) VISIBLE,
  INDEX `UsuarioID` (`UsuarioID` ASC) VISIBLE,
  INDEX `TempoID` (`TempoID` ASC) VISIBLE,
  INDEX `FormaPagamentoID` (`FormaPagamentoID` ASC) VISIBLE,
  CONSTRAINT `venda_ibfk_1`
    FOREIGN KEY (`ClienteID`)
    REFERENCES `agrovale`.`cliente` (`ClienteID`),
  CONSTRAINT `venda_ibfk_2`
    FOREIGN KEY (`UsuarioID`)
    REFERENCES `agrovale`.`usuarios` (`UsuarioID`),
  CONSTRAINT `venda_ibfk_3`
    FOREIGN KEY (`TempoID`)
    REFERENCES `agrovale`.`dimtempo` (`TempoID`),
  CONSTRAINT `venda_ibfk_4`
    FOREIGN KEY (`FormaPagamentoID`)
    REFERENCES `agrovale`.`formapagamento` (`PagamentoID`))
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`produto`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`produto` (
  `ProdutoID` INT NOT NULL AUTO_INCREMENT,
  `Codigo` VARCHAR(10) NULL DEFAULT NULL,
  `Nome` VARCHAR(100) NOT NULL,
  `Categoria` VARCHAR(50) NULL DEFAULT NULL,
  `Subcategoria` VARCHAR(50) NULL DEFAULT NULL,
  `PrecoCusto` DECIMAL(10,2) NULL DEFAULT '0.00',
  `PrecoVenda` DECIMAL(10,2) NULL DEFAULT '0.00',
  `UnidadeMedida` VARCHAR(20) NULL DEFAULT 'un',
  `EstoqueAtual` INT NULL DEFAULT '0',
  `EstoqueMinimo` INT NULL DEFAULT '5',
  `FornecedorID` VARCHAR(100) NULL DEFAULT NULL,
  `Ativo` TINYINT(1) NULL DEFAULT '1',
  `DataCadastro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProdutoID`),
  UNIQUE INDEX `Codigo` (`Codigo` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`itemvenda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`itemvenda` (
  `ItemID` INT NOT NULL AUTO_INCREMENT,
  `VendaID` INT NOT NULL,
  `ProdutoID` INT NOT NULL,
  `Quantidade` INT NOT NULL,
  `PrecoUnitario` DECIMAL(10,2) NOT NULL,
  `DescontoItem` DECIMAL(10,2) NULL DEFAULT '0.00',
  `TotalItem` DECIMAL(10,2) NULL DEFAULT '0.00',
  PRIMARY KEY (`ItemID`),
  INDEX `VendaID` (`VendaID` ASC) VISIBLE,
  INDEX `ProdutoID` (`ProdutoID` ASC) VISIBLE,
  CONSTRAINT `itemvenda_ibfk_1`
    FOREIGN KEY (`VendaID`)
    REFERENCES `agrovale`.`venda` (`VendaID`)
    ON DELETE CASCADE,
  CONSTRAINT `itemvenda_ibfk_2`
    FOREIGN KEY (`ProdutoID`)
    REFERENCES `agrovale`.`produto` (`ProdutoID`))
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`logauditoria`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`logauditoria` (
  `LogID` INT NOT NULL AUTO_INCREMENT,
  `UsuarioID` INT NOT NULL,
  `Acao` VARCHAR(100) NOT NULL,
  `TabelaAfetada` VARCHAR(50) NOT NULL,
  `RegistroID` INT NULL DEFAULT NULL,
  `Descricao` TEXT NULL DEFAULT NULL,
  `DataHora` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`LogID`),
  INDEX `UsuarioID` (`UsuarioID` ASC) VISIBLE,
  CONSTRAINT `logauditoria_ibfk_1`
    FOREIGN KEY (`UsuarioID`)
    REFERENCES `agrovale`.`usuarios` (`UsuarioID`))
ENGINE = InnoDB
AUTO_INCREMENT = 18
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table `agrovale`.`sessions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `agrovale`.`sessions` (
  `session_id` VARCHAR(128) NOT NULL,
  `expires` INT UNSIGNED NOT NULL,
  `data` MEDIUMTEXT NULL DEFAULT NULL,
  PRIMARY KEY (`session_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

USE `agrovale`;

DELIMITER $$
USE `agrovale`$$
CREATE
DEFINER=`root`@`localhost`
TRIGGER `agrovale`.`trg_venda_before_insert`
BEFORE INSERT ON `agrovale`.`venda`
FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0), 2);
END$$

USE `agrovale`$$
CREATE
DEFINER=`root`@`localhost`
TRIGGER `agrovale`.`trg_venda_before_update`
BEFORE UPDATE ON `agrovale`.`venda`
FOR EACH ROW
BEGIN
  SET NEW.ValorLiquido = ROUND(NEW.ValorBruto - IFNULL(NEW.Desconto,0), 2);
END$$

USE `agrovale`$$
CREATE
DEFINER=`root`@`localhost`
TRIGGER `agrovale`.`trg_auto_codigo_produto`
BEFORE INSERT ON `agrovale`.`produto`
FOR EACH ROW
BEGIN
  DECLARE novo_codigo INT;

  IF NEW.Codigo IS NULL OR NEW.Codigo = '' THEN
    SELECT IFNULL(MAX(CAST(Codigo AS UNSIGNED)), 0) + 1 INTO novo_codigo FROM produto;
    SET NEW.Codigo = LPAD(novo_codigo, 5, '0');
  END IF;
END$$

USE `agrovale`$$
CREATE
DEFINER=`root`@`localhost`
TRIGGER `agrovale`.`trg_itemvenda_before_insert`
BEFORE INSERT ON `agrovale`.`itemvenda`
FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)), 2);
END$$

USE `agrovale`$$
CREATE
DEFINER=`root`@`localhost`
TRIGGER `agrovale`.`trg_itemvenda_before_update`
BEFORE UPDATE ON `agrovale`.`itemvenda`
FOR EACH ROW
BEGIN
  IF NEW.Quantidade <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade deve ser maior que 0';
  END IF;
  SET NEW.TotalItem = ROUND(NEW.Quantidade * (NEW.PrecoUnitario - IFNULL(NEW.DescontoItem,0)), 2);
END$$


DELIMITER ;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


INSERT INTO FormaPagamento (Nome, Descricao, Parcelamento, Taxa, DiasRecebimento) VALUES
('Dinheiro', 'Pagamento em espécie', 0, 0.00, 0),
('Cartão de Crédito', 'Visa, Master, etc.', 1, 2.99, 30),
('Cartão de Débito', 'Transação imediata', 0, 1.50, 0),
('Pix', 'Pagamento instantâneo', 0, 0.00, 0),
('Boleto', 'Vencimento em até 3 dias úteis', 0, 0.00, 3);

INSERT INTO Usuarios (Nome, NomeUsuario, Senha, Role)
VALUES ('Administrador', 'admin', '$2a$10$qX4KlHLHC/yCj8v7HjLbmOHeKHvJTLrKxg3hzgViCrBrK/K1I9WCy', 'admin');

INSERT INTO DimTempo (TempoID, DataCompleta, Dia, Mes, Ano, Trimestre, Semana, DiaSemana)
VALUES (1, CURDATE(), DAY(CURDATE()), MONTH(CURDATE()), YEAR(CURDATE()), QUARTER(CURDATE()), WEEK(CURDATE()), DAYNAME(CURDATE()));