const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1', // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: '*', // Any network (default: none)
    },
    mumbai: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_MUMBAI,
          0,
          4,
        );
      },
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 10000000000,
      chainId: 80001,
    },
    polygon: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_POLYGON,
          0,
          4,
        );
      },
      network_id: 137,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 100000000000,
      chainId: 137,
    },
    optimism: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_OPTIMISM,
          0,
          4,
        );
      },
      network_id: 10,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 1000000,
      chainId: 10,
    },
    optimism_kovan: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_OPTIMISM_KOVAN,
          0,
          4,
        );
      },
      network_id: 69,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 10000,
      chainId: 69,
    },
    arbitrum_rinkeby: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_ARBITRUM_RINKEBY,
          0,
          4,
        );
      },
      network_id: 421611,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 10000,
      chainId: 69,
    },
    arbitrum: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_ARBITRUM,
          0,
          4,
        );
      },
      network_id: 42161,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 4500000,
      gasPrice: 10000,
      chainId: 69,
    },
    goerli: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_GOERLI,
          0,
          4,
        );
      },
      skipDryRun: true,
      network_id: 5,
      gas: 6000000,
      gasPrice: 10000000000,
    },
    mainnet: {
      provider: function () {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.PROVIDER_ETHEREUM_MAINNET,
          0,
          4,
        );
      },
      skipDryRun: true,
      network_id: 1, // Ethereum public network
      gas: 6000000,
      gasPrice: 40000000000,
    },
  },
  mocha: {
    // timeout: 100000
  },
  compilers: {
    solc: {
      version: '0.8.9',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
