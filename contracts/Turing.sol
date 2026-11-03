// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * Turing: criptomoeda da disciplina, usada para votar nos projetos finais.
 *
 * Estratégia "Uncapped Lazy Supply": não existe emissão inicial (nada é
 * cunhado no construtor) e não há limite máximo de supply. Os tokens são
 * criados sob demanda por issueToken() e vote().
 *
 * Assim como o Ether, o Turing tem 18 casas decimais: 1 Turing = 10**18
 * unidades. Todas as quantidades recebidas pelas funções estão nessa unidade.
 */
contract Turing {
    string public name = "Turing";
    string public symbol = "TUR";
    uint8 public constant decimals = 18;

    uint256 public constant ONE_TURING = 10 ** 18;
    uint256 public constant MAX_VOTE = 2 * ONE_TURING;
    uint256 public constant VOTES_PER_REWARD = 10;

    // Codinome da professora (superusuária, junto com o owner).
    string public constant PROFESSORA = "roberta";

    uint256 public totalSupply;
    address public owner;

    // Indica se a votação está ativa.
    bool public voting;

    // Usuários autorizados: codinome => endereço.
    mapping(string => address) public users;

    // Caminho inverso (endereço => codinome), usado para identificar quem chama vote().
    mapping(address => string) public codinomeOf;

    // Lista de codinomes cadastrados, para o frontend conseguir listá-los.
    string[] private codinomes;
    mapping(string => bool) private isListed;

    // hasVote[votante][votado] => já votou?
    mapping(string => mapping(string => bool)) public hasVote;

    // Quantidade de votos dados por cada codinome (para a recompensa a cada 10 votos).
    mapping(string => uint256) public voteCount;

    mapping(address => uint256) private balances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Voted(string voter, string codinome, uint256 amount);
    event VotingStatusChanged(bool voting);
    event UserUpdated(string codinome, address user_addr);

    modifier onlyOwnerOrProfessora() {
        require(
            msg.sender == owner || msg.sender == users[PROFESSORA],
            "Apenas o owner ou a professora"
        );
        _;
    }

    constructor() {
        owner = msg.sender;

        // Dados da tabela exemplo. O owner é quem faz o deploy
        // (conta #0 do `npx hardhat node`: 0xf39F...2266).
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
        // Conforme a especificação, updateUser também ativa a votação.
        voting = true;
        emit VotingStatusChanged(true);
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

        // A cada 10 votos, o votante recebe 1 Turing.
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
        // Remove o vínculo inverso do endereço antigo deste codinome.
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

    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
