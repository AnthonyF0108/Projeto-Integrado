class Vendedor:
    def __init__(self, id_vendedor, nome, cargo, salario, comissao=0):
        self.id_vendedor = id_vendedor
        self.nome = nome
        self.cargo = cargo
        self.salario = salario
        self.comissao = comissao
        self.vendas = []

    def registrar_venda(self, venda):
        self.vendas.append(venda)

    def calcular_comissao(self):
        return sum(venda.valor_total for venda in self.vendas) * (self.comissao / 100)
