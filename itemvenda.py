class ItemVenda:
    def __init__(self, produto, quantidade):
        self.produto = produto
        self.quantidade = quantidade
        self.subtotal = produto.preco * quantidade
