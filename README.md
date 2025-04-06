# Exchange_Office
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

## License

GPL-3.0
