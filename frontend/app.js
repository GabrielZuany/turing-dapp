/* global ethers */

const RPC_URL = "http://127.0.0.1:8545";
const HARDHAT_CHAIN_ID = 31337;
const PROFESSORA = "roberta";

const $ = (id) => document.getElementById(id);

const state = {
  config: null, // contract.json gerado pelo deploy
  readProvider: null, // no local, usado pra leitura e eventos
  readContract: null,
  signer: null,
  contract: null, // contrato com o signer, pra mandar transacao
  address: null,
  codinome: "",
  codinomes: [],
};

// utilidades

function showMessage(text, isError = false) {
  const el = $("message");
  el.textContent = text;
  el.className = isError ? "error" : "";
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => el.classList.add("hidden"), 6000);
}

function errorMessage(err) {
  return (
    err?.reason ||
    err?.info?.error?.data?.message ||
    err?.info?.error?.message ||
    err?.shortMessage ||
    err?.message ||
    String(err)
  );
}

function formatTuring(value) {
  const [int, frac = ""] = ethers.formatUnits(value, 18).split(".");
  const trimmed = frac.replace(/0+$/, "").slice(0, 4);
  return trimmed ? `${int}.${trimmed}` : int;
}

function sameAddress(a, b) {
  return a && b && a.toLowerCase() === b.toLowerCase();
}

function fillSelect(select, options) {
  const current = select.value;
  select.innerHTML = "";
  for (const { value, label } of options) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  if (options.some((o) => o.value === current)) select.value = current;
}

// manda a transacao e trava o botao ate confirmar
async function sendTx(button, label, fn) {
  if (!state.contract) return showMessage("Conecte uma conta primeiro.", true);
  button.disabled = true;
  try {
    const tx = await fn(state.contract);
    showMessage(`${label}: aguardando confirmação...`);
    await tx.wait();
    showMessage(`${label}: sucesso!`);
    await refreshAll();
  } catch (err) {
    console.error(err);
    showMessage(`${label} falhou: ${errorMessage(err)}`, true);
  } finally {
    button.disabled = false;
  }
}

// leitura do contrato

async function loadCodinomes() {
  state.codinomes = await state.readContract.getCodinomes();
}

async function refreshVotingStatus() {
  const voting = await state.readContract.voting();
  const el = $("voting-status");
  el.textContent = voting ? "ativa" : "pausada";
  el.className = `badge ${voting ? "on" : "off"}`;
}

async function refreshRanking() {
  const alunos = state.codinomes.filter((c) => c !== PROFESSORA);
  const rows = await Promise.all(
    alunos.map(async (codinome) => {
      const addr = await state.readContract.users(codinome);
      const balance = addr === ethers.ZeroAddress ? 0n : await state.readContract.balanceOf(addr);
      return { codinome, addr, balance };
    })
  );
  rows.sort((a, b) =>
    a.balance === b.balance
      ? a.codinome.localeCompare(b.codinome, undefined, { numeric: true })
      : a.balance > b.balance ? -1 : 1
  );

  const tbody = $("ranking-body");
  tbody.innerHTML = "";
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    if (sameAddress(r.addr, state.address)) tr.className = "me";
    tr.innerHTML = `<td>${i + 1}</td><td></td><td><code></code></td><td class="num">${formatTuring(r.balance)}</td>`;
    tr.children[1].textContent = r.codinome;
    tr.children[2].firstChild.textContent = r.addr;
    tbody.appendChild(tr);
  });
}

function refreshSelects() {
  const alunos = state.codinomes.filter((c) => c !== PROFESSORA);
  fillSelect(
    $("vote-codinome"),
    alunos.filter((c) => c !== state.codinome).map((c) => ({ value: c, label: c }))
  );
  fillSelect($("issue-codinome"), alunos.map((c) => ({ value: c, label: c })));
}

async function refreshAccount() {
  if (!state.address) return;
  const c = state.readContract;
  const [owner, professoraAddr, codinome, balance] = await Promise.all([
    c.owner(),
    c.users(PROFESSORA),
    c.codinomeOf(state.address),
    c.balanceOf(state.address),
  ]);
  state.codinome = codinome;

  const isOwner = sameAddress(owner, state.address);
  const isProfessora = sameAddress(professoraAddr, state.address);
  const isSuper = isOwner || isProfessora;
  const isUser = codinome !== "";

  const roles = [];
  if (isOwner) roles.push("owner");
  if (isProfessora) roles.push("professora");
  if (isSuper) roles.unshift("superusuário");
  else if (isUser) roles.push("usuário registrado");
  else roles.push("não autorizado");

  $("account-info").classList.remove("hidden");
  $("acc-address").textContent = state.address;
  $("acc-codinome").textContent = codinome || "—";
  $("acc-role").textContent = roles.join(" · ");
  $("acc-balance").textContent = formatTuring(balance);

  // usuario comum so ve o votar, superusuario ve votar + issueToken, votingOn e votingOff
  $("vote-card").classList.toggle("hidden", !(isUser || isSuper));
  $("admin-card").classList.toggle("hidden", !isSuper);
}

async function refreshAll() {
  await loadCodinomes();
  // precisa saber o codinome antes pra tirar ele do select de voto
  await refreshAccount();
  refreshSelects();
  await Promise.all([refreshVotingStatus(), refreshRanking()]);
}

// contas

async function useSigner(signer) {
  state.signer = signer;
  state.address = await signer.getAddress();
  state.contract = new ethers.Contract(state.config.address, state.config.abi, signer);
  await refreshAll();
  showMessage(`Conectado como ${state.codinome || state.address}`);
}

async function connectMetaMask() {
  if (!window.ethereum) return showMessage("MetaMask não encontrada no navegador.", true);
  try {
    const chainHex = "0x" + HARDHAT_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
    } catch (err) {
      if (err.code !== 4902) throw err;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainHex,
          chainName: "Hardhat Localhost",
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        }],
      });
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await useSigner(await provider.getSigner());

    window.ethereum.removeAllListeners?.("accountsChanged");
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts.length) await useSigner(await provider.getSigner());
    });
  } catch (err) {
    console.error(err);
    showMessage(`Erro ao conectar: ${errorMessage(err)}`, true);
  }
}

// contas do hardhat node, da pra usar sem metamask
async function loadLocalAccounts() {
  const accounts = await state.readProvider.listAccounts();
  const options = await Promise.all(
    accounts.map(async (s, i) => {
      const addr = await s.getAddress();
      const codinome = await state.readContract.codinomeOf(addr);
      const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
      return { value: addr, label: `#${i} ${codinome || (i === 0 ? "owner" : "—")} (${short})` };
    })
  );
  fillSelect($("local-account"), options);
}

async function connectLocal() {
  try {
    await useSigner(await state.readProvider.getSigner($("local-account").value));
  } catch (err) {
    console.error(err);
    showMessage(`Erro ao conectar: ${errorMessage(err)}`, true);
  }
}

// init

async function init() {
  try {
    const res = await fetch("contract.json", { cache: "no-store" });
    if (!res.ok) throw new Error("contract.json não encontrado. Rode `npm run deploy` primeiro.");
    state.config = await res.json();

    state.readProvider = new ethers.JsonRpcProvider(RPC_URL);
    state.readProvider.pollingInterval = 1000;
    state.readContract = new ethers.Contract(state.config.address, state.config.abi, state.readProvider);

    if ((await state.readProvider.getCode(state.config.address)) === "0x") {
      throw new Error("Contrato não encontrado no nó local. Rode `npm run deploy` novamente.");
    }

    await refreshAll();
    await loadLocalAccounts();

    // ranking por eventos: todo mint (vote, issueToken, bonus) emite Transfer e a pagina recarrega os saldos
    state.readContract.on("Transfer", () => refreshRanking().then(refreshAccount));
    state.readContract.on("VotingStatusChanged", refreshVotingStatus);
    state.readContract.on("UserUpdated", () => refreshAll().then(loadLocalAccounts));
  } catch (err) {
    console.error(err);
    showMessage(errorMessage(err), true);
  }
}

$("btn-metamask").addEventListener("click", connectMetaMask);
$("btn-local").addEventListener("click", connectLocal);

$("vote-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const codinome = $("vote-codinome").value;
  // usuario digita em turings (ex 1.5) e aqui vira 1.5 * 10**18 que eh o que o contrato espera
  const amount = ethers.parseUnits($("vote-amount").value, 18);
  sendTx(e.submitter, "vote", (c) => c.vote(codinome, amount));
});

$("issue-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const codinome = $("issue-codinome").value;
  const amount = ethers.parseUnits($("issue-amount").value, 18);
  sendTx(e.submitter, "issueToken", (c) => c.issueToken(codinome, amount));
});

$("btn-voting-on").addEventListener("click", (e) =>
  sendTx(e.currentTarget, "votingOn", (c) => c.votingOn())
);
$("btn-voting-off").addEventListener("click", (e) =>
  sendTx(e.currentTarget, "votingOff", (c) => c.votingOff())
);

init();
