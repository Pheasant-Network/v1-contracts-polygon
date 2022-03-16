const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config({ path: '../.env' });
const Web3 = require('web3');
const readlineSync = require('readline-sync')
const fs = require('fs');
const utils = require('../migrations/utils')

const childManager = JSON.parse(fs.readFileSync('../build/contracts/PolygonChildCheckPointManager.json', 'utf8'));
const rootManager = JSON.parse(fs.readFileSync('../build/contracts/PolygonRootCheckPointManager.json', 'utf8'));
let contractAddressObj = utils.getContractAddresses("../")
const childAbi = childManager.abi;
const rootAbi = rootManager.abi;
const web3_goerli = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_GOERLI,
  chainId: 5
}));

const web3_mumbai = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_MUMBAI,
  chainId: 80001
}));

const web3_mainnet = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_ETHEREUM_MAINNET,
  chainId: 1 
}));

const web3_polygon = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_POLYGON,
  chainId: 137
}));



const main = async () => {
  const accounts = await web3_goerli.eth.getAccounts();

  if (readlineSync.keyInYN('Set up Tunnel?')) {
    const env = readlineSync.question("Input ENV (m/p)");
    if(env == "m") {
      const rootAddress = contractAddressObj["goerli"].PolygonRootCheckPointManager;
      const childAddress = contractAddressObj["mumbai"].PolygonChildCheckPointManager;

      const childContract = new web3_mumbai.eth.Contract(childAbi , childAddress);
      const rootContract = new web3_goerli.eth.Contract(rootAbi , rootAddress);
      let accountNonce = await web3_mumbai.eth.getTransactionCount(accounts[0]);
      let response = await childContract.methods.setFxRootTunnel(rootAddress).send({from:accounts[0], nonce: accountNonce});
      console.log(response);
      accountNonce = await web3_goerli.eth.getTransactionCount(accounts[0]);
      response = await rootContract.methods.setFxChildTunnel(childAddress).send({from:accounts[0], nonce: accountNonce});
      console.log(response);
    } else if(env == "p") {
      const rootAddress = contractAddressObj["mainnet"].PolygonRootCheckPointManager;
      const childAddress = contractAddressObj["polygon"].PolygonChildCheckPointManager;

      const childContract = new web3_polygon.eth.Contract(childAbi , childAddress);
      const rootContract = new web3_mainnet.eth.Contract(rootAbi , rootAddress);
      let accountNonce = await web3_polygon.eth.getTransactionCount(accounts[0]);
      let response = await childContract.methods.setFxRootTunnel(rootAddress).send({from:accounts[0], nonce: accountNonce});
      console.log(response);
      accountNonce = await web3_mainnet.eth.getTransactionCount(accounts[0]);
      response = await rootContract.methods.setFxChildTunnel(childAddress).send({from:accounts[0], nonce: accountNonce});
      console.log(response);

    } else {
      console.log("invalid input")
    }
  } else {
    //Testing
    
    const sendOrReceive = readlineSync.question("send or receive? (s/r)");

    let rootAddress = contractAddressObj["goerli"].PolygonRootCheckPointManager;
    let rootContract = new web3_goerli.eth.Contract(rootAbi , rootAddress);
    let childAddress = contractAddressObj["mumbai"].PolygonChildCheckPointManager;
    let childContract = new web3_mumbai.eth.Contract(childAbi , childAddress);
    let currentBlockNumber = await web3_goerli.eth.getBlockNumber();
  
    if (readlineSync.keyInYN('isPolygon?')) {
      rootAddress = contractAddressObj["mainnet"].PolygonRootCheckPointManager;
      rootContract = new web3_mainnet.eth.Contract(rootAbi , rootAddress);
      childAddress = contractAddressObj["polygon"].PolygonChildCheckPointManager;
      childContract = new web3_polygon.eth.Contract(childAbi , childAddress);
      currentBlockNumber = await web3_mainnet.eth.getBlockNumber();
    }

    if(sendOrReceive == "s") {
      let response = await rootContract.methods.sendBlockInfo(currentBlockNumber).send({from:accounts[0]});
      console.log(response);
    } else if(sendOrReceive == "r") {
      const blockNumber = readlineSync.question("blockNumber?");
      console.log(parseInt(blockNumber));
      let response = await childContract.methods.getBlockHash(parseInt(blockNumber)).call({from:accounts[0]});
      console.log(response);
    } else {
      console.log("invalid input")
    }

  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


