from datetime import date

class Parcela:
    def __init__(self, numero, valor, vencimento):
        self.numero = numero
        self.valor = valor
        self.vencimento = vencimento
        self.paga = False
        self.data_pagamento = None

    def registrar_pagamento(self):
        self.paga = True
        self.data_pagamento = date.today()

    def em_atraso(self):
        return not self.paga and date.today() > self.vencimento
