const path = require("path");
const fs = require("fs");
const solc = require("solc");

const ticketsalePath = path.resolve(__dirname, "contracts", "SaleTicket.sol");
const source = fs.readFileSync(ticketsalePath, "utf8");
//console.log(source);
let input = {
  language: "Solidity",
  sources: {
    "SaleTicket.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

const stringInput = JSON.stringify(input);

const compiledCode = solc.compile(stringInput);
const output = JSON.parse(compiledCode);
const contractOutput = output.contracts;
const ticketSaleOutput = contractOutput["SaleTicket.sol"];
const ticketSaleABI = ticketSaleOutput.SaleTicket.abi;
//console.log(ticketSaleABI);

const ticketSaleBytecode = ticketSaleOutput.SaleTicket.evm.bytecode;
// console.log(ticketSaleBytecode);
module.exports = { abi: ticketSaleABI, bytecode: ticketSaleBytecode.object };
