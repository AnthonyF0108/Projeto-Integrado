class HistoricoVendas:
    def __init__(self):
        self.vendas = []

    def registrar_venda(self, venda):
        self.vendas.append(venda)

    def listar_vendas(self):
        return [str(venda) for venda in self.vendas]

    def vendas_por_cliente(self, cliente_id):
        return [venda for venda in self.vendas if venda.cliente.id_cliente == cliente_id]
