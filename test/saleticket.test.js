const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider());
const { abi, bytecode } = require("../compile");

beforeEach(async () => {
  // Get a list of all accounts
  accounts = await web3.eth.getAccounts();

  // Deploy the contract with constructor arguments
  ticketSale = await new web3.eth.Contract(abi)
    .deploy({
      data: bytecode,
      arguments: [10, 100], // Passing number of tickets(10) and price(100 each)
    })
    .send({ from: accounts[0], gasPrice: 8000000000, gas: 4700000 });
});

describe("ticketSale", () => {
  it("deploys a contract", () => {
    assert.ok(ticketSale.options.address, "Contract deployment failed");
  });

  it("allows ticket purchase", async () => {
    const ticketId = 1; // Buy ticket with ID 1
    const buyer = accounts[1];
    const initialBalance = await web3.eth.getBalance(buyer);
    await ticketSale.methods.buyTicket(ticketId).send({
      from: buyer,
      value: 100,
    });

    const ticketIdOwned = parseInt(
      await ticketSale.methods.getTicketOf(buyer).call()
    );
    const finalBalance = await web3.eth.getBalance(buyer);

    assert.equal(
      ticketIdOwned,
      ticketId,
      "Buyer does not own the correct ticket after purchase"
    );
    assert(
      web3.utils.toBN(initialBalance).gt(web3.utils.toBN(finalBalance)),
      "Buyer's balance did not decrease as expected"
    );

    const buyerTicket = await ticketSale.methods.tickets(ticketId).call();
    assert.equal(
      buyerTicket.owner,
      buyer,
      "Ticket ownership not correctly assigned to buyer"
    );
  });

  it("records a swap offer correctly", async () => {
    const buyer1 = accounts[2];
    const buyer2 = accounts[3];
    const ticket1Id = 2;
    const ticket2Id = 3;

    await ticketSale.methods
      .buyTicket(ticket1Id)
      .send({ from: buyer1, value: 100 });
    await ticketSale.methods
      .buyTicket(ticket2Id)
      .send({ from: buyer2, value: 100 });

    await ticketSale.methods.offerSwap(ticket2Id).send({ from: buyer1 });

    const swapOffer = parseInt(
      await ticketSale.methods.swapOffers(buyer1, buyer2).call()
    );

    assert.equal(swapOffer, ticket1Id, "Swap offer not recorded correctly");

    const buyer1Ticket = parseInt(
      await ticketSale.methods.getTicketOf(buyer1).call()
    );
    assert.equal(
      buyer1Ticket,
      ticket1Id,
      "Buyer1 should still have their original ticket after offering swap"
    );

    const buyer2Ticket = parseInt(
      await ticketSale.methods.getTicketOf(buyer2).call()
    );
    assert.equal(
      buyer2Ticket,
      ticket2Id,
      "Buyer2 should still have their original ticket"
    );
  });

  it("executes ticket swap offer successfully", async () => {
    const buyer1 = accounts[4];
    const buyer2 = accounts[5];
    const ticket1Id = 4;
    const ticket2Id = 5;

    await ticketSale.methods
      .buyTicket(ticket1Id)
      .send({ from: buyer1, value: 100 });
    await ticketSale.methods
      .buyTicket(ticket2Id)
      .send({ from: buyer2, value: 100 });

    await ticketSale.methods.offerSwap(ticket2Id).send({ from: buyer1 });
    await ticketSale.methods.acceptSwap(ticket2Id).send({ from: buyer2 });

    const buyer1NewTicket = parseInt(
      await ticketSale.methods.getTicketOf(buyer1).call()
    );
    const buyer2NewTicket = parseInt(
      await ticketSale.methods.getTicketOf(buyer2).call()
    );
    assert.equal(
      buyer1NewTicket,
      ticket2Id,
      "Ticket swap failed; Buyer1 does not have Buyer2's ticket"
    );
    assert.equal(
      buyer2NewTicket,
      ticket1Id,
      "Ticket swap failed; Buyer2 does not have Buyer1's ticket"
    );
  });

  it("sets ticket for resale at specified price", async () => {
    const buyer = accounts[6];
    const ticketId = 6;
    const initialPrice = 100;
    const resalePrice = 120;

    await ticketSale.methods
      .buyTicket(ticketId)
      .send({ from: buyer, value: initialPrice });

    const initialOwner = parseInt(
      await ticketSale.methods.getTicketOf(buyer).call()
    );
    assert.equal(
      initialOwner,
      ticketId,
      "Buyer does not initially own the ticket before resale"
    );

    await ticketSale.methods.resaleTicket(resalePrice).send({ from: buyer });

    const resaleTicketDetails = await ticketSale.methods
      .tickets(ticketId)
      .call();
    assert.equal(
      resaleTicketDetails.price,
      resalePrice,
      "Resale price not set correctly"
    );
    assert.equal(
      resaleTicketDetails.forSale,
      true,
      "Ticket is not marked as for sale"
    );

    const resaleList = await ticketSale.methods.checkResale().call();
    assert(
      resaleList.includes(ticketId.toString()),
      "Ticket not found in resale list"
    );
  });

  it("processes resale ticket purchase with service fee distribution", async () => {
    const seller = accounts[7];
    const buyer = accounts[8];
    const manager = await ticketSale.methods.manager().call();
    const ticketId = 7;
    const initialPrice = 100;
    const resalePrice = 120;

    await ticketSale.methods
      .buyTicket(ticketId)
      .send({ from: seller, value: initialPrice });

    await ticketSale.methods.resaleTicket(resalePrice).send({ from: seller });

    const initialSellerBalance = await web3.eth.getBalance(seller);
    const initialManagerBalance = await web3.eth.getBalance(manager);

    await ticketSale.methods
      .acceptResale(ticketId)
      .send({ from: buyer, value: resalePrice });

    const newOwner = parseInt(
      await ticketSale.methods.getTicketOf(buyer).call()
    );
    assert.equal(newOwner, ticketId, "Buyer does not own the ticket after resale");

    const ticketDetails = await ticketSale.methods.tickets(ticketId).call();
    assert.equal(
      ticketDetails.forSale,
      false,
      "Ticket incorrectly remains marked for sale after resale"
    );

    const sellerTicket = parseInt(
      await ticketSale.methods.getTicketOf(seller).call()
    );
    assert.equal(sellerTicket, 0, "Seller incorrectly retains ticket ownership");

    const serviceFee = web3.utils
      .toBN(resalePrice)
      .mul(web3.utils.toBN(10))
      .div(web3.utils.toBN(100));
    const sellerAmount = web3.utils.toBN(resalePrice).sub(serviceFee);

    const finalSellerBalance = await web3.eth.getBalance(seller);
    assert.equal(
      web3.utils
        .toBN(finalSellerBalance)
        .sub(web3.utils.toBN(initialSellerBalance))
        .toString(),
      sellerAmount.toString(),
      "Seller did not receive the correct resale amount"
    );

    const finalManagerBalance = await web3.eth.getBalance(manager);
    assert.equal(
      web3.utils
        .toBN(finalManagerBalance)
        .sub(web3.utils.toBN(initialManagerBalance))
        .toString(),
      serviceFee.toString(),
      "Manager did not receive the correct service fee"
    );
  });
});
