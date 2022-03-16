import HDWalletProvider from '@truffle/hdwallet-provider';
import Web3 from 'web3';
import BN from'bn.js';
import fs from 'fs';
const MNEMONIC="ill rigid magic normal mesh deny round faint museum staff suggest wool"
const PROVIDER_MUMBAI="https://polygon-mumbai.g.alchemy.com/v2/6gGF8qK26yTyEt3zB6mbQG3joIBL1sUx"
const PROVIDER_GOERLI="https://goerli.infura.io/v3/deac92b380cd4b219b0c57a59cf363b1"
const contract = JSON.parse(fs.readFileSync('../build/contracts/PheasantNetworkBridgeChild.json', 'utf8'));
const tokenContract = JSON.parse(fs.readFileSync('../build/contracts/TestToken.json', 'utf8'));

const provider = new HDWalletProvider({
  mnemonic: MNEMONIC,
  providerOrUrl: PROVIDER_GOERLI,
  chainId: 5
});

const mumbaiProvider = new HDWalletProvider({
  mnemonic: MNEMONIC,
  providerOrUrl: PROVIDER_MUMBAI,
  chainId:80001 
});

const web3Goerli = new Web3(provider);
const web3Mumbai = new Web3(mumbaiProvider);
const web3 = new Web3('http://localhost:8545');

const bridge = new web3Mumbai.eth.Contract(contract.abi , contract.networks['80001'].address);
const bridgeLocal = new web3.eth.Contract(contract.abi , contract.networks['5777'].address);
const token = new web3.eth.Contract(tokenContract.abi, tokenContract.networks['5777'].address);


const main = async () => {
  let accounts = await web3.eth.getAccounts();
  let response;

  let user = accounts[0];
  let amount = 10000;
  let fee = 100;

  response = await token.methods.approve(contract.networks['5777'].address, amount).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  response = await bridgeLocal.methods.newTrade(amount, accounts[0], fee, 0).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  console.log(response);
}

main();


