// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts@4.9.3/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/security/Pausable.sol";

interface IToroTokenERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function balanceOf(address addr) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function calculateTxFee(address sender, uint256 val) external returns (uint256);
}

interface IRealEstateToken {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function assetValue() external view returns (uint256);
    function maxSupply() external view returns (uint256);
}

contract RealEstateFactory {
    address[] public realEstateContracts;
    address public constant TORO_TOKEN_ADDRESS = 0xff0dFAe9c45EeB5cA5d269BE47eea69eab99bf6C; // Replace with actual ToroToken address

    event RealEstateTokenCreated(
        address indexed newTokenAddress,
        string name,
        string symbol,
        uint256 initialAssetValue,
        uint256 maxSupply,
        address owner
    );

    function createRealEstateToken(
        string memory name,
        string memory symbol,
        uint256 initialAssetValue,
        uint256 maxSupply,
        address tokenOwner
    ) public {
        require(tokenOwner != address(0), "Invalid owner address");
        RealEstateToken newToken = new RealEstateToken(
            name,
            symbol,
            initialAssetValue,
            maxSupply,
            tokenOwner
        );
        realEstateContracts.push(address(newToken));
        emit RealEstateTokenCreated(
            address(newToken),
            name,
            symbol,
            initialAssetValue,
            maxSupply,
            tokenOwner
        );
    }

    function getRealEstateContractsCount() public view returns (uint) {
        return realEstateContracts.length;
    }

    function getRealEstateContractByIndex(uint index) public view returns (address) {
        require(index < realEstateContracts.length, "Index out of bounds");
        return realEstateContracts[index];
    }

    function getAllRealEstateContracts() public view returns (address[] memory) {
        return realEstateContracts;
    }

    function getRealEstateTokenDetails(
        address tokenAddress
    ) public view returns (string memory, string memory, uint256, uint256) {
        IRealEstateToken token = IRealEstateToken(tokenAddress);
        return (
            token.name(),
            token.symbol(),
            token.assetValue(),
            token.maxSupply()
        );
    }
}

contract RealEstateToken is ERC20, Ownable, Pausable {
    IToroTokenERC20 public toroToken;
    uint256 public assetValue;
    uint256 public SHARE_PRICE;
    uint256 public maxSupply;
    mapping(address => uint256) public investment;

    event SharesPurchased(
        address indexed buyer,
        uint256 numberOfShares,
        uint256 amount,
        uint256 fee
    );
    event SharesWithdrawn(
        address indexed seller,
        uint256 numberOfShares,
        uint256 amount,
        uint256 fee
    );

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialAssetValue,
        uint256 _maxSupply,
        address ownerAddress
    ) ERC20(name, symbol) {
        require(initialAssetValue > 0, "Asset value must be greater than 0");
        require(_maxSupply > 0, "Max supply must be greater than 0");
        
        toroToken = IToroTokenERC20(0xff0dFAe9c45EeB5cA5d269BE47eea69eab99bf6C); // Replace with actual ToroToken address
        
        // Convert initialAssetValue to ToroToken's decimals (assuming 18 decimals)
        assetValue = initialAssetValue * 1e18;
        
        // Store maxSupply without decimals for calculations
        maxSupply = _maxSupply;
        
        // Mint tokens with 18 decimals
        _mint(address(this), maxSupply * 1e18);

        // Calculate share price in ToroToken (18 decimals)
        SHARE_PRICE = assetValue / maxSupply;
        transferOwnership(ownerAddress);
    }

    function buyShares(uint256 numberOfShares) public whenNotPaused {
        require(numberOfShares > 0, "Number of shares must be greater than 0");
        
        // Calculate ToroToken amount needed (will have 18 decimals)
        uint256 requiredToro = SHARE_PRICE * numberOfShares;
        
        // Calculate transaction fee
        uint256 txFee = toroToken.calculateTxFee(msg.sender, requiredToro);
        uint256 totalAmount = requiredToro + txFee;

        require(
            toroToken.balanceOf(msg.sender) >= totalAmount,
            "Insufficient ToroToken balance"
        );

        // Check for sufficient allowance
        uint256 allowance = toroToken.allowance(msg.sender, address(this));
        // Convert numberOfShares to 18 decimals for ERC20 transfer
        uint256 scaledAmount = numberOfShares * 1e18;
        
        require(allowance >= totalAmount, "ToroToken allowance too low");
        require(
            balanceOf(address(this)) >= scaledAmount,
            "Not enough shares available"
        );

        toroToken.transferFrom(msg.sender, address(this), totalAmount);
        _transfer(address(this), msg.sender, scaledAmount);

        investment[msg.sender] += requiredToro;

        emit SharesPurchased(msg.sender, numberOfShares, requiredToro, txFee);
    }

    function withdrawAndCashOut() public whenNotPaused {
        uint256 tokenBalance = balanceOf(msg.sender);
        require(tokenBalance > 0, "You do not own any tokens");
        
        // Convert 18 decimal token balance to number of shares
        uint256 sharesOwned = tokenBalance / 1e18;
        // Calculate ToroToken value (will have 18 decimals)
        uint256 totalShareValue = sharesOwned * SHARE_PRICE;

        // Calculate transaction fee for withdrawal
        uint256 txFee = toroToken.calculateTxFee(address(this), totalShareValue);
        uint256 netAmount = totalShareValue - txFee;

        require(
            toroToken.balanceOf(address(this)) >= totalShareValue,
            "Insufficient ToroToken in the contract"
        );

        toroToken.transfer(msg.sender, netAmount);
        _transfer(msg.sender, address(this), tokenBalance);

        emit SharesWithdrawn(msg.sender, sharesOwned, netAmount, txFee);
    }

    function updateAssetValue(uint256 newAssetValue) public onlyOwner whenNotPaused {
        require(newAssetValue > 0, "Asset value must be greater than 0");

        // Convert to ToroToken decimals
        assetValue = newAssetValue * 1e18;
        // Calculate new share price in ToroToken
        SHARE_PRICE = assetValue / maxSupply;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function emergencyWithdraw() public onlyOwner {
        uint256 contractBalance = toroToken.balanceOf(address(this));
        require(contractBalance > 0, "No funds to withdraw");
        
        uint256 txFee = toroToken.calculateTxFee(address(this), contractBalance);
        uint256 netAmount = contractBalance - txFee;
        
        toroToken.transfer(owner(), netAmount);
    }

    receive() external payable {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}