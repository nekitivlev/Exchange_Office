// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Exchange Office for ERC20 tokens
/// @notice Allows users to exchange ETH for ERC20 tokens and vice versa
/// @dev Implements ReentrancyGuard, Pausable and Ownable for security
contract ExchangeOffice is ReentrancyGuard, Pausable, Ownable {
    mapping(IERC20 => uint256) private rates;
    bool public isShutdown;

    event RateSet(address indexed token, uint256 rate);
    event TokensBought(address indexed buyer, address indexed token, uint256 amount, uint256 ethAmount);
    event TokensSold(address indexed seller, address indexed token, uint256 amount, uint256 ethAmount);
    event TokensSupplied(address indexed token, uint256 amount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event EmergencyEthWithdraw(uint256 amount);
    event ShutdownInitiated(address indexed by);
    
    // Add this function to allow the contract to receive ETH
    receive() external payable {}

    /// @notice Ensures the contract is not in shutdown state
    modifier notShutdown() {
        require(!isShutdown, "Contract is shut down");
        _;
    }

    /// @notice Sets the exchange rate for a token
    /// @param token The token address
    /// @param rate The new rate in wei per token unit
    function setRate(address token, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be greater than 0");
        require(rate <= type(uint256).max / 1e18, "Rate too high");
        rates[IERC20(token)] = rate;
        emit RateSet(token, rate);
    }

    /// @notice Supplies tokens to the exchange office
    /// @param token The token address
    /// @param amount Amount of tokens to supply
    function supplyToken(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0"); // Add this check
        IERC20 tokenContract = IERC20(token);
        require(amount <= tokenContract.balanceOf(msg.sender), "Insufficient token balance");
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensSupplied(token, amount);
    }

    /// @notice Buy tokens with ETH
    /// @param _token The token address to buy
    /// @param amount Amount of tokens to buy
    function buy(address _token, uint256 amount) external payable
    nonReentrant
    whenNotPaused
    notShutdown
    {
        require(amount > 0, "Amount must be greater than 0"); // Add this check
        IERC20 token = IERC20(_token);
        uint256 rate = rates[token];
        require(rate != 0, "Token not supported");

        // Fix the calculation by dividing by 1e18
        uint256 weiRequired = amount * rate / 1e18;
        require(msg.value >= weiRequired, "Insufficient ETH sent for purchase");
        require(amount <= token.balanceOf(address(this)), "Insufficient exchange office token balance");

        require(token.transfer(msg.sender, amount), "Token transfer failed");

        uint256 excess = msg.value - weiRequired;
        if(excess > 0) {
            payable(msg.sender).transfer(excess);
        }

        emit TokensBought(msg.sender, _token, amount, weiRequired);
    }

    /// @notice Sell tokens for ETH
    /// @param _token The token address to sell
    /// @param amount Amount of tokens to sell
    function sell(address _token, uint256 amount) external
    nonReentrant
    whenNotPaused
    notShutdown
    {
        require(amount > 0, "Amount must be greater than 0"); // Add this check
        IERC20 token = IERC20(_token);
        uint256 rate = rates[token];
        require(rate != 0, "Token not supported");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient token balance");

        // Fix the calculation by dividing by 1e18
        uint256 weiToReturn = amount * rate / 1e18;
        require(weiToReturn <= address(this).balance, "Insufficient exchange office ETH balance");

        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        payable(msg.sender).transfer(weiToReturn);

        emit TokensSold(msg.sender, _token, amount, weiToReturn);
    }

    /// @notice Check if a token is supported
    /// @param token The token address to check
    /// @return bool indicating if the token is supported
    function isTokenSupported(address token) external view returns (bool) {
        return rates[IERC20(token)] > 0;
    }

    /// @notice Get the current rate for a token
    /// @param token The token address
    /// @return The current rate in wei per token unit
    function getRate(address token) external view returns (uint256) {
        return rates[IERC20(token)];
    }

    /// @notice Emergency withdrawal of tokens
    /// @param token The token address to withdraw
    /// @param amount Amount of tokens to withdraw
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0"); // Add this check
        IERC20 tokenContract = IERC20(token);
        require(amount <= tokenContract.balanceOf(address(this)), "Insufficient token balance");
        require(tokenContract.transfer(owner(), amount), "Transfer failed");
        emit EmergencyWithdraw(token, amount);
    }

    /// @notice Emergency withdrawal of ETH
    /// @param amount Amount of ETH to withdraw
    function withdrawETH(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0"); // Add this check
        require(amount <= address(this).balance, "Insufficient ETH balance");
        payable(owner()).transfer(amount);
        emit EmergencyEthWithdraw(amount);
    }

    /// @notice Initiates contract shutdown
    function initiateShutdown() external onlyOwner {
        isShutdown = true;
        _pause();
        emit ShutdownInitiated(msg.sender);
    }

    /// @notice Pauses the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract
    function unpause() external onlyOwner {
        require(!isShutdown, "Cannot unpause: contract is shut down");
        _unpause();
    }
}