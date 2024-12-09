// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract SaleTicket {
    struct Ticket {
        address owner;
        uint256 price;
        bool forSale;
    }

    address public manager;
    uint256 public ticketPrice;
    uint256 public totalTickets;
    mapping(uint256 => Ticket) public tickets;
    mapping(address => uint256) public ticketOwners;
    mapping(address => mapping(address => uint256)) public swapOffers;

    // Constructor initializes the contract with a specified number of tickets and their price, 
    // setting the sender as the manager
    constructor(uint256 numTickets, uint256 price) {
        manager = msg.sender;
        totalTickets = numTickets;
        ticketPrice = price;
    }

    // Allows a user to purchase a ticket by providing the correct payment amount and an available ticket ID
    function buyTicket(uint256 ticketId) public payable {
        require(ticketId > 0 && ticketId <= totalTickets, "Invalid ticket ID");
        require(tickets[ticketId].owner == address(0), "Ticket already sold");
        require(ticketOwners[msg.sender] == 0, "You already own a ticket");
        require(msg.value == ticketPrice, "Incorrect payment amount");

        tickets[ticketId].owner = msg.sender;
        ticketOwners[msg.sender] = ticketId;
    }

    // Returns the ticket ID owned by a specified address
    function getTicketOf(address person) public view returns (uint256) {
        return ticketOwners[person];
    }

    // Allows a user to offer their ticket for a swap with another ticket by its ID
    function offerSwap(uint256 ticketId) public {
        require(ticketOwners[msg.sender] != 0, "You don't own a ticket");
        require(tickets[ticketId].owner != address(0), "Target ticket not sold");
        require(tickets[ticketId].owner != msg.sender, "Cannot swap with yourself");

        uint256 myTicketId = ticketOwners[msg.sender];
        address targetOwner = tickets[ticketId].owner;

        swapOffers[msg.sender][targetOwner] = myTicketId;
    }

    // Enables a user to accept a pending swap offer on their ticket
    function acceptSwap(uint256 myTicketId) public {
        require(ticketOwners[msg.sender] == myTicketId, "You don't own this ticket");

        address swapPartner;
        uint256 offeredTicketId = 0;

        // Search for an active swap offer from another ticket owner
        for (uint256 i = 1; i <= totalTickets; i++) {
            if (swapOffers[tickets[i].owner][msg.sender] != 0) {
                swapPartner = tickets[i].owner;
                offeredTicketId = swapOffers[swapPartner][msg.sender];
                break;
            }
        }

        require(offeredTicketId != 0, "No swap offer for you");

        // Complete the ticket swap between the two users
        tickets[myTicketId].owner = swapPartner;
        tickets[offeredTicketId].owner = msg.sender;
        ticketOwners[msg.sender] = offeredTicketId;
        ticketOwners[swapPartner] = myTicketId;

        // Remove the swap offer
        delete swapOffers[swapPartner][msg.sender];
    }

    // Allows the ticket owner to set their ticket for resale at a specified price
    function resaleTicket(uint256 price) public {
        uint256 ticketId = ticketOwners[msg.sender];
        require(ticketId != 0, "You don't own a ticket");

        tickets[ticketId].price = price;
        tickets[ticketId].forSale = true;
    }

    // Allows a user to buy a ticket that is on resale
    function acceptResale(uint256 ticketId) public payable {
        require(tickets[ticketId].forSale, "Ticket not for sale");
        require(ticketOwners[msg.sender] == 0, "You already own a ticket");
        require(msg.value == tickets[ticketId].price, "Incorrect payment amount");

        address seller = tickets[ticketId].owner;
        uint256 serviceFee = (tickets[ticketId].price * 10) / 100;
        uint256 sellerAmount = tickets[ticketId].price - serviceFee;

        payable(seller).transfer(sellerAmount);
        payable(manager).transfer(serviceFee);

        tickets[ticketId].owner = msg.sender;
        tickets[ticketId].forSale = false;
        ticketOwners[msg.sender] = ticketId;
        delete ticketOwners[seller];
    }

    // Returns an array of tickets available for resale, each followed by its price
    function checkResale() public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= totalTickets; i++) {
            if (tickets[i].forSale) {
                count++;
            }
        }

        uint256[] memory resaleTickets = new uint256[](count * 2);
        uint256 index = 0;
        for (uint256 i = 1; i <= totalTickets; i++) {
            if (tickets[i].forSale) {
                resaleTickets[index] = i;
                resaleTickets[index + 1] = tickets[i].price;
                index += 2;
            }
        }

        return resaleTickets;
    }
}
