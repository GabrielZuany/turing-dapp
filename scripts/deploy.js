const fs = require("fs");
const path = require("path");
const { ethers, artifacts, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploy com a conta:", deployer.address);

  // aqui troquei o nome do contrato do boilerplate pra Turing
  const turing = await ethers.deployContract("Turing");
  await turing.waitForDeployment();
  const address = await turing.getAddress();
  console.log("Turing implantado em:", address);

  // salva endereco e abi num json que o front le
  const { abi } = await artifacts.readArtifact("Turing");
  const out = path.join(__dirname, "..", "frontend", "contract.json");
  fs.writeFileSync(
    out,
    JSON.stringify({ address, chainId: Number(network.config.chainId ?? 31337), abi }, null, 2)
  );
  console.log("Endereço e ABI salvos em", path.relative(process.cwd(), out));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
