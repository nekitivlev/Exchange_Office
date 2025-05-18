# Decentralized Exchange Office

A decentralized exchange platform for trading ERC20 tokens against ETH, built with Solidity.

## Overview

This project implements a decentralized exchange office where users can:
- Buy ERC20 tokens with ETH
- Sell ERC20 tokens for ETH
- Get current exchange rates
- Supply tokens to the exchange

## Smart Contracts

### SimpleToken.sol
- ERC20-compliant token implementation
- Features:
    - Configurable initial supply
    - Maximum supply cap of 1 billion tokens
    - Pausable transfers
    - Controlled minting
    - Owner-only administrative functions

### ExchangeOffice.sol
- Main exchange contract
- Features:
    - Token/ETH trading pairs
    - Configurable exchange rates
    - Emergency pause functionality
    - Reentrancy protection
    - Owner-only administrative functions
    - Emergency withdrawal options

## Deployment Guide

### Prerequisites
- [MetaMask](https://metamask.io/) or similar Web3 wallet
- [Remix IDE](https://remix.ethereum.org/)
- Test ETH (for testnet deployment)

### Deployment Steps

1. **Contract Preparation**
    - Open Remix IDE
    - Create new files for `SimpleToken.sol` and `ExchangeOffice.sol`
    - Copy the contract code into respective files

2. **Compile Contracts**
    - Select Solidity compiler version `^0.8.0`
    - Enable optimization (recommended)
    - Compile both contracts

3. **Deploy SimpleToken**
    - Select "Injected Web3" environment
    - Deploy `SimpleToken` with parameters:
        - `initialSupply`: Amount of tokens to mint (in wei, 1 token = 10^18 wei)
    - Save the deployed token address

4. **Deploy ExchangeOffice**
    - Deploy `ExchangeOffice` contract
    - Save the deployed exchange address

5. **Configure Exchange**
    - Call `setRate` function:
        - `token`: SimpleToken contract address
        - `rate`: Exchange rate (in wei per token)
    - Approve token transfer:
        - In SimpleToken, call `approve` with exchange address and desired amount
    - Supply tokens:
        - Call `supplyToken` with token address and amount

## Usage Guide

### For Token Holders
1. **Selling Tokens**
    - Approve exchange office to spend your tokens
    - Call `sell` function with:
        - Token address
        - Amount to sell
    - Receive ETH automatically

2. **Buying Tokens**
    - Check token rate using `getRate`
    - Call `buy` function with:
        - Token address
        - Amount to buy
    - Include required ETH amount in transaction

### For Exchange Owner
1. **Managing Rates**
    - Set/update rates using `setRate`
    - Monitor token supply

2. **Emergency Controls**
    - Pause/unpause exchange: `pause`/`unpause`
    - Emergency withdrawal: `withdrawToken`/`withdrawETH`
    - Initiate shutdown: `initiateShutdown`

## Testing

The project includes comprehensive tests to verify all functionality works as expected.

### Test Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Directory Structure**
   ```
   /contracts       # Smart contract source files
   /test            # Test files
   hardhat.config.js # Hardhat configuration
   ```

### Running Tests

Run all tests with:

```
bash npx hardhat test
```

Generate test coverage report:

```
bash npx hardhat coverage
```

Run a specific test file:

```
bash npx hardhat test ./test/SimpleTokenTests.js
```


### Test Architecture

Tests are organized into two main files:

- **SimpleTokenTests.js**: Tests for the ERC20 token functionality
- **ExchangeOfficeTests.js**: Tests for the exchange functionality

### Important Implementation Notes

1. **Token Rates and ETH Calculations**:
    - Token rates are defined as wei per token unit (1 * 10^18 wei)
    - When calculating ETH amounts for tokens, the formula is: `amount * rate / 1e18`
    - This division is now handled correctly in the contract

2. **Zero Amount Protection**:
    - All functions that handle token or ETH transfers now check for zero amounts
    - Attempting to transfer zero tokens will be rejected with a clear error message

3. **Receiving ETH**:
    - The ExchangeOffice contract includes a `receive()` function to accept ETH transfers
    - This is essential for sending ETH to the contract during testing or manual funding

4. **Overflow Prevention**:
    - The contract includes checks to prevent numeric overflows
    - Rate setting has a maximum limit to prevent multiplication overflows

5. **Emergency Controls**:
    - The contract can be paused, which blocks all buy/sell operations
    - The contract can be permanently shut down, which cannot be reversed
    - Emergency withdrawal functions allow the owner to recover assets

### Common Issues and Solutions

1. **"Insufficient ETH sent for purchase" errors**:
    - Ensure you're sending enough ETH for the purchase
    - Remember the calculation is `tokenAmount * rate / 1e18`

2. **"Function selector not recognized" errors**:
    - This happens when trying to send ETH to a contract without a receive function
    - The ExchangeOffice contract now includes this function

3. **"Amount must be greater than 0" errors**:
    - The contract now explicitly rejects zero-amount transfers
    - Always use positive, non-zero values for all token and ETH operations

4. **Gas Estimation**:
    - When testing ETH transfers, remember to account for gas costs
    - Use `closeTo` rather than `equal` for comparing ETH balances after transactions

## Security Considerations

1. **Reentrancy Protection**:
    - The contract uses OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks
    - Critical functions use the nonReentrant modifier

2. **Access Control**:
    - Administrative functions are protected with the Ownable pattern
    - Only the contract owner can change rates, pause the contract, or withdraw assets

3. **Rate Limits**:
    - Token rates have upper limits to prevent overflow issues
    - Rates must be positive to prevent zero-value transactions

4. **Pausability**:
    - The contract can be paused in emergency situations
    - A permanent shutdown option is available for critical scenarios

## Future Enhancements

Potential improvements for future versions:

1. **Fee Structure**:
    - Implement percentage-based fees for transactions
    - Allow fee distribution to multiple stakeholders

2. **Multi-signature Control**:
    - Replace single-owner model with a multi-signature wallet requirement
    - Enhance security for high-value administrative operations

3. **Oracle Integration**:
    - Connect to price oracles for automated rate updates
    - Ensure rates reflect current market conditions

4. **Limit Orders**:
    - Implement limit order functionality
    - Allow users to set conditions for automated trades

5. **Token Whitelisting**:
    - Add formal token whitelisting process
    - Ensure only vetted tokens can be traded
