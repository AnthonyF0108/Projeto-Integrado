class Cliente:
    def __init__(self, id_cliente, nome, cpf_cnpj, contato, limite_credito=0):
        self.id_cliente = id_cliente
        self.nome = nome
        self.cpf_cnpj = cpf_cnpj
        self.contato = contato
        self.limite_credito = limite_credito
