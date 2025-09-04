from itemvenda import ItemVenda

class Venda:
    def __init__(self, id_venda, cliente, vendedor, forma_pagamento):
        self.id_venda = id_venda
        self.cliente = cliente
        self.vendedor = vendedor
        self.forma_pagamento = forma_pagamento
        self.itens = []
        self.valor_total = 0

    def adicionar_item(self, produto, quantidade):
        if produto.estoque >= quantidade:
            item = ItemVenda(produto, quantidade)
            self.itens.append(item)
            self.valor_total += item.subtotal
            produto.remover_estoque(quantidade)
        else:
            raise ValueError("Estoque insuficiente para este produto.")
