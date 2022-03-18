import HDWalletProvider from '@truffle/hdwallet-provider';
import * as dotenv from 'dotenv';
dotenv.config({path: "../.env"});
import Web3 from 'web3';
import BN from'bn.js';
import fs from 'fs';
import EthereumProof from "ethereum-proof";
const contract = JSON.parse(fs.readFileSync('../build/contracts/PheasantNetworkBridgeChild.json', 'utf8'));
const tokenContract = JSON.parse(fs.readFileSync('../build/contracts/TestToken.json', 'utf8'));

const provider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_GOERLI,
  chainId: 5
});

const mumbaiProvider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_MUMBAI,
  chainId:80001 
});

const web3Goerli = new Web3(provider);
const web3Mumbai = new Web3(mumbaiProvider);
const web3 = new Web3('http://localhost:8545');
const mumbaiWethAddress = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

const bridge = new web3Mumbai.eth.Contract(contract.abi , contract.networks['80001'].address);
const bridgeLocal = new web3.eth.Contract(contract.abi , contract.networks['5777'].address);
const token = new web3.eth.Contract(tokenContract.abi, tokenContract.networks['5777'].address);
const mumbaiWeth = new web3Mumbai.eth.Contract(tokenContract.abi, mumbaiWethAddress);

const ethereumProof = new EthereumProof.EthereumProof(web3Goerli);

const main = async () => {
  let accounts = await web3.eth.getAccounts();
  //let accounts = await web3Mumbai.eth.getAccounts();
  let response;

  let user = accounts[0];
  let amount = 10000;
  let fee = 100;

  response = await token.methods.approve(contract.networks['5777'].address, amount).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  //response = await mumbaiWeth.methods.approve(contract.networks['80001'].address, amount).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  response = await bridgeLocal.methods.newTrade(amount, accounts[0], fee, 0).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  //response = await bridge.methods.newTrade(amount, accounts[0], 0, 0).send({from:accounts[0], gas: 500000, gasPrice: 10000000000});
  console.log(response);


  const evidence = await ethereumProof.composeEvidence("0x3d9d1d13f5051765ff870d90dc8ea8eed4427abdcfc48cc71e77b820b8af0a3f", false);

  console.log(evidence);
}

main();


