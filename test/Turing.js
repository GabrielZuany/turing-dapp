const {
  loadFixture,
  impersonateAccount,
  setBalance,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const T = (n) => ethers.parseUnits(String(n), 18);
const ROBERTA = "0x502542668aF09fa7aea52174b9965A7799343Df7";

describe("Turing", function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const [owner, nome1, nome2] = signers;

    // O endereço da professora não é uma conta do Hardhat: usamos impersonation.
    await impersonateAccount(ROBERTA);
    await setBalance(ROBERTA, T(10));
    const professora = await ethers.getSigner(ROBERTA);

    const outsider = ethers.Wallet.createRandom().connect(ethers.provider);
    await owner.sendTransaction({ to: outsider.address, value: T(1) });

    const turing = await ethers.deployContract("Turing");
    return { turing, signers, owner, nome1, nome2, professora, outsider };
  }

  describe("Deploy", function () {
    it("não emite tokens no construtor", async function () {
      const { turing, owner } = await loadFixture(deployFixture);
      expect(await turing.totalSupply()).to.equal(0);
      expect(await turing.balanceOf(owner.address)).to.equal(0);
    });

    it("inicializa o mapping users com a tabela", async function () {
      const { turing, nome1, professora } = await loadFixture(deployFixture);
      expect(await turing.users("nome1")).to.equal(nome1.address);
      expect(await turing.users("roberta")).to.equal(professora.address);
      expect(await turing.getCodinomes()).to.have.length(6);
      expect(await turing.voting()).to.equal(false);
    });
  });

  describe("Superusuários", function () {
    it("owner e professora podem ligar/desligar a votação", async function () {
      const { turing, professora } = await loadFixture(deployFixture);
      await turing.votingOn();
      expect(await turing.voting()).to.equal(true);
      await turing.connect(professora).votingOff();
      expect(await turing.voting()).to.equal(false);
    });

    it("usuário comum não pode chamar funções restritas", async function () {
      const { turing, nome1 } = await loadFixture(deployFixture);
      const msg = "Apenas o owner ou a professora";
      await expect(turing.connect(nome1).votingOn()).to.be.revertedWith(msg);
      await expect(turing.connect(nome1).votingOff()).to.be.revertedWith(msg);
      await expect(turing.connect(nome1).issueToken("nome1", 1)).to.be.revertedWith(msg);
      await expect(turing.connect(nome1).updateUser("x", nome1.address)).to.be.revertedWith(msg);
    });

    it("issueToken cunha Turings para o codinome", async function () {
      const { turing, nome2 } = await loadFixture(deployFixture);
      await expect(turing.issueToken("nome2", T(5)))
        .to.emit(turing, "Transfer")
        .withArgs(ethers.ZeroAddress, nome2.address, T(5));
      expect(await turing.balanceOf(nome2.address)).to.equal(T(5));
      expect(await turing.totalSupply()).to.equal(T(5));
      await expect(turing.issueToken("ninguem", 1)).to.be.revertedWith("Codinome inexistente");
    });

    it("updateUser atualiza o endereço e ativa a votação", async function () {
      const { turing, nome1, outsider } = await loadFixture(deployFixture);
      await expect(turing.updateUser("", outsider.address)).to.be.revertedWith("Codinome vazio");

      await turing.updateUser("nome1", outsider.address);
      expect(await turing.users("nome1")).to.equal(outsider.address);
      expect(await turing.codinomeOf(nome1.address)).to.equal("");
      expect(await turing.voting()).to.equal(true);

      // O endereço antigo não pode mais votar; o novo pode.
      await expect(turing.connect(nome1).vote("nome2", 1)).to.be.revertedWith("Usuario nao autorizado");
      await turing.connect(outsider).vote("nome2", 1);

      // Codinome novo entra na lista.
      await turing.updateUser("novo", nome1.address);
      expect(await turing.getCodinomes()).to.include("novo");
    });
  });

  describe("vote", function () {
    it("cunha os Turings para o votado e registra o voto", async function () {
      const { turing, nome1, nome2 } = await loadFixture(deployFixture);
      await turing.votingOn();
      await expect(turing.connect(nome1).vote("nome2", T(1.5)))
        .to.emit(turing, "Voted")
        .withArgs("nome1", "nome2", T(1.5));
      expect(await turing.balanceOf(nome2.address)).to.equal(T(1.5));
      expect(await turing.hasVote("nome1", "nome2")).to.equal(true);
    });

    it("respeita todos os requires", async function () {
      const { turing, owner, nome1, outsider } = await loadFixture(deployFixture);
      await expect(turing.connect(nome1).vote("nome2", 1)).to.be.revertedWith("Votacao nao esta ativa");

      await turing.votingOn();
      await expect(turing.connect(outsider).vote("nome2", 1)).to.be.revertedWith("Usuario nao autorizado");
      await expect(turing.connect(owner).vote("nome2", 1)).to.be.revertedWith("Usuario nao autorizado");
      await expect(turing.connect(nome1).vote("nome1", 1)).to.be.revertedWith("Nao pode votar em si mesmo");
      await expect(turing.connect(nome1).vote("nome2", 0)).to.be.revertedWith("Quantidade deve ser > 0 e <= 2 Turings");
      await expect(turing.connect(nome1).vote("nome2", T(2) + 1n)).to.be.revertedWith("Quantidade deve ser > 0 e <= 2 Turings");
      await expect(turing.connect(nome1).vote("ninguem", 1)).to.be.revertedWith("Codinome inexistente");

      await turing.connect(nome1).vote("nome2", T(2));
      await expect(turing.connect(nome1).vote("nome2", 1)).to.be.revertedWith("Ja votou neste codinome");
    });

    it("dá 1 Turing ao votante a cada 10 votos", async function () {
      const { turing, nome1 } = await loadFixture(deployFixture);
      // A tabela só tem 5 alunos: cadastra mais alguns para chegar a 11 votados.
      for (let i = 6; i <= 11; i++) {
        await turing.updateUser(`nome${i}`, ethers.Wallet.createRandom().address);
      }
      await turing.votingOn();
      for (let i = 2; i <= 10; i++) {
        await turing.connect(nome1).vote(`nome${i}`, 1);
      }
      expect(await turing.balanceOf(nome1.address)).to.equal(0);

      await turing.connect(nome1).vote("nome11", 1);
      expect(await turing.voteCount("nome1")).to.equal(10);
      expect(await turing.balanceOf(nome1.address)).to.equal(T(1));
    });
  });
});
