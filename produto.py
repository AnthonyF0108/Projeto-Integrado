class Produto:
    def __init__(self, codigo, nome, categoria, preco, estoque, validade=None):
        self.codigo = codigo
        self.nome = nome
        self.categoria = categoria
        self.preco = preco
        self.estoque = estoque
        self.validade = validade

    def atualizar_estoque(self, quantidade):
        self.estoque += quantidade

    def remover_estoque(self, quantidade):
        if quantidade <= self.estoque:
            self.estoque -= quantidade
        else:
            raise ValueError("Estoque insuficiente.")
