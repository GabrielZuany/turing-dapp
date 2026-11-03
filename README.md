# Turing dApp

Criptomoeda **Turing (TUR)** e dApp de votação dos projetos finais, rodando na blockchain local do Hardhat.

```
contracts/Turing.sol   contrato (Uncapped Lazy Supply, sem minting no construtor)
test/Turing.js         testes de todos os requires
scripts/deploy.js      deploy + gera frontend/contract.json (endereço + ABI)
scripts/serve.js       servidor estático do frontend (porta 3000)
frontend/              HTML + JS puro com ethers v6
```

## Como rodar

Requer Node 18+ (testado com Node 22).

```bash
npm install
npm test                # opcional: roda os testes do contrato
```

Em um terminal, suba a blockchain local (deixe rodando):

```bash
npm run node
```

Em outro terminal:

```bash
npm run deploy          # implanta o Turing e gera frontend/contract.json
npm run frontend        # abre em http://localhost:3000
```

## Usando o frontend

Há duas formas de escolher a conta:

- **Usar conta do nó local**: escolhe uma das 20 contas do `npx hardhat node` direto na página. Não precisa de MetaMask e é o jeito mais rápido de alternar entre usuários para testar.
- **Conectar MetaMask**: importe na MetaMask as chaves privadas exibidas pelo `npm run node`. O botão adiciona/troca para a rede Hardhat (chainId 31337) sozinho. Se reiniciar o nó, faça *Clear activity tab data* na conta da MetaMask para zerar o nonce.

Perfis:

- **Usuário registrado**: card *Votar* (codinome + quantidade, até 2 TUR).
- **Superusuário** (owner = conta #0, ou a professora): *Votar* + *issueToken*, *votingOn* e *votingOff*.
- A professora não aparece nos selects nem no ranking.

O **ranking** é atualizado por eventos: cada `vote()`/`issueToken()` emite `Transfer`, e a página recarrega os saldos ao recebê-lo.

## Tabela de usuários

O mapping `users` é inicializado no construtor de `contracts/Turing.sol` com a tabela exemplo:

| Codinome | Endereço | Conta do `hardhat node` |
|---|---|---|
| (owner/deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | #0 |
| roberta (professora) | `0x502542668aF09fa7aea52174b9965A7799343Df7` | — |
| nome1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | #1 |
| nome2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | #2 |
| nome3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | #3 |
| nome4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | #4 |
| nome5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | #5 |

O endereço da professora não é uma conta do Hardhat, então localmente as funções de superusuário são testadas com o owner (conta #0). Nos testes automatizados, o endereço dela é usado via *impersonation*.

## Decisões de implementação

- O Turing tem 18 casas decimais, como o Ether. As funções recebem a quantidade nessa unidade (1 TUR = 10¹⁸). O frontend converte com `parseUnits`, então dá para votar com frações, por exemplo 0.5.
- `updateUser` também seta `voting = true`, como a especificação manda.
- `vote` exige que o codinome votado exista, para não cunhar tokens no endereço zero.
- A cada 10 votos, o votante recebe 1 TUR.
- O contrato guarda um mapping inverso `codinomeOf` (endereço → codinome) para identificar quem chama `vote`, e uma lista `getCodinomes()` para o frontend montar os selects e o ranking.
