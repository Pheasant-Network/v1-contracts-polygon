require("@nomiclabs/hardhat-waffle");
require('dotenv').config();
require("hardhat-gas-reporter");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  console.log(process.env.PROVIDER_MUMBAI);
  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
 defaultNetwork: "hardhat",
 networks: {
   localhost: {
     url: "http://127.0.0.1:8545"
   },
   hardhat: {
   },
   mumbai: {
     url: process.env.PROVIDER_MUMBAI,
     chainId: 80001,
     //gasPrice: 10000000000,
     accounts: {mnemonic: process.env.MNEMONIC}
   },
   goerli: {
     url: process.env.PROVIDER_GOERLI,
     chainId: 5,
     //gasPrice: 10000000000,
     accounts: {mnemonic: process.env.MNEMONIC}
   }

 },
 solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
