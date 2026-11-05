// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// token turing, usado pra votar nos projetos finais
// uncapped lazy supply: nada eh mintado no construtor e nao tem limite maximo
// os tokens so sao criados no issueToken e no vote
// nao eh erc20, so usa alguns nomes parecidos (name, symbol, decimals, balanceOf, Transfer)
contract Turing {
    string public name = "Turing";
    string public symbol = "TUR";
    // 18 casas decimais igual o ether, entao 1 turing = 10**18 unidades
    // o contrato sempre trabalha nessa unidade, o front converte com parseUnits
    uint8 public constant decimals = 18;

    uint256 public constant ONE_TURING = 10 ** 18;
    uint256 public constant MAX_VOTE = 2 * ONE_TURING;
    uint256 public constant VOTES_PER_REWARD = 10;

    // professora e owner sao os superusuarios
    string public constant PROFESSORA = "roberta";

    uint256 public totalSupply;
    address public owner;

    // votacao ja comeca ativa
    bool public voting = true;

    // usuarios autorizados (codinome => endereco), preenchido no construtor
    mapping(string => address) public users;

    // inverso do users, pra saber o codinome de quem chamou o vote
    mapping(address => string) public codinomeOf;

    // mapping nao da pra percorrer, entao guardo os codinomes numa lista pro front
    string[] private codinomes;
    mapping(string => bool) private isListed;

    // chave primaria eh quem vota e a secundaria eh quem recebe
    // ex: hasVote["nome1"]["nome2"] = true quer dizer que nome1 ja votou no nome2
    mapping(string => mapping(string => bool)) public hasVote;

    // quantos votos cada codinome ja deu, usado no bonus
    mapping(string => uint256) public voteCount;

    // saldo de cada carteira
    mapping(address => uint256) private balances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Voted(string voter, string codinome, uint256 amount);
    event VotingStatusChanged(bool voting);
    event UserUpdated(string codinome, address user_addr);

    // require que se repete em updateUser, votingOn, votingOff e issueToken
    modifier onlyOwnerOrProfessora() {
        require(
            msg.sender == owner || msg.sender == users[PROFESSORA],
            "Apenas o owner ou a professora"
        );
        _;
    }

    constructor() {
        owner = msg.sender;

        // tabela exemplo da professora
        // o owner eh quem faz o deploy (conta #0 do hardhat node)
        // sem mint aqui
        _setUser(PROFESSORA, 0x502542668aF09fa7aea52174b9965A7799343Df7);
        _setUser("nome1", 0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
        _setUser("nome2", 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
        _setUser("nome3", 0x90F79bf6EB2c4f870365E785982E1f101E93b906);
        _setUser("nome4", 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);
        _setUser("nome5", 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc);
    }

    function updateUser(string memory codinome, address user_addr)
        external
        onlyOwnerOrProfessora
    {
        require(bytes(codinome).length > 0, "Codinome vazio");
        _setUser(codinome, user_addr);
    }

    function votingOn() external onlyOwnerOrProfessora {
        voting = true;
        emit VotingStatusChanged(true);
    }

    function votingOff() external onlyOwnerOrProfessora {
        voting = false;
        emit VotingStatusChanged(false);
    }

    function issueToken(string memory codinome, uint256 qtde_de_Turings)
        external
        onlyOwnerOrProfessora
    {
        address to = users[codinome];
        require(to != address(0), "Codinome inexistente");
        _mint(to, qtde_de_Turings);
    }

    function vote(string memory codinome, uint256 qtde_de_Turings) external {
        require(voting, "Votacao nao esta ativa");

        string memory voter = codinomeOf[msg.sender];
        require(
            bytes(voter).length > 0 && users[voter] == msg.sender,
            "Usuario nao autorizado"
        );

        address to = users[codinome];
        require(to != address(0), "Codinome inexistente");
        require(
            keccak256(bytes(voter)) != keccak256(bytes(codinome)),
            "Nao pode votar em si mesmo"
        );
        require(
            qtde_de_Turings > 0 && qtde_de_Turings <= MAX_VOTE,
            "Quantidade deve ser > 0 e <= 2 Turings"
        );
        require(!hasVote[voter][codinome], "Ja votou neste codinome");

        hasVote[voter][codinome] = true;
        _mint(to, qtde_de_Turings);
        emit Voted(voter, codinome, qtde_de_Turings);

        // bonus: a cada 10 votos quem votou ganha 1 turing (10, 20, 30...)
        voteCount[voter] += 1;
        if (voteCount[voter] % VOTES_PER_REWARD == 0) {
            _mint(msg.sender, ONE_TURING);
        }
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function getCodinomes() external view returns (string[] memory) {
        return codinomes;
    }

    function _setUser(string memory codinome, address user_addr) private {
        // se o codinome ja tinha endereco, apaga o inverso do antigo
        address old = users[codinome];
        if (old != address(0)) {
            delete codinomeOf[old];
        }

        users[codinome] = user_addr;
        if (user_addr != address(0)) {
            codinomeOf[user_addr] = codinome;
        }

        if (!isListed[codinome]) {
            isListed[codinome] = true;
            codinomes.push(codinome);
        }
        emit UserUpdated(codinome, user_addr);
    }

    // todo mint passa por aqui: aumenta o supply e o saldo
    // o Transfer vindo do endereco zero eh o que o front escuta pra atualizar o ranking
    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
