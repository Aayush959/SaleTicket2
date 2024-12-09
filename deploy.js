const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');
const { abi, bytecode } = require('./compile');

const provider = new HDWalletProvider(
  'wave lazy regret away high guide clarify nephew quarter hurry shop hazard',
  'https://sepolia.infura.io/v3/c815328f969c4bf3b9edafd397ba8bbc' 
);

const web3 = new Web3(provider);

const deploy = async () => {
  const accounts = await web3.eth.getAccounts();
  console.log('Attempting to deploy from account', accounts[0]);

  // Define the constructor arguments
  const numTickets = 50; // Number of tickets
  const ticketPrice = 30; // Price per ticket in wei

  const ticketSale = await new web3.eth.Contract(abi) // Use 'abi' here
    .deploy({ data: bytecode, arguments: [numTickets, ticketPrice] })
    .send({ from: accounts[0], gasPrice: '4000000000', gas: '4700000' });

  console.log('Contract deployed to', ticketSale.options.address);

  provider.engine.stop();
};

deploy();