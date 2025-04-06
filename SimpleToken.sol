// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @title Simple Token Implementation
/// @notice A basic ERC20 token with pause and mint functionality
/// @dev Extends OpenZeppelin's ERC20, Ownable, and Pausable contracts
contract SimpleToken is ERC20, Ownable, Pausable {
    /// @notice Maximum supply cap for the token
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    /// @notice Emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount);

    /// @notice Creates a new Simple token
    /// @param initialSupply The initial amount of tokens to mint
    constructor(uint256 initialSupply) ERC20("Simple", "SIMP") {
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds maximum");
        _mint(msg.sender, initialSupply);
    }

    /// @notice Mints new tokens, respecting the maximum supply cap
    /// @param to Address to receive the minted tokens
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed maximum supply");

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Pauses all token transfers
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses all token transfers
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Override of the _beforeTokenTransfer function to add pause functionality
    /// @dev Called before any transfer, mint, or burn
    /// @param from The sender address
    /// @param to The recipient address
    /// @param amount The amount being transferred
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /// @notice Returns the number of decimals used for token amounts
    /// @return The number of decimals (18)
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Returns the remaining amount of tokens that can be minted
    /// @return The remaining mintable supply
    function remainingMintableSupply() public view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}