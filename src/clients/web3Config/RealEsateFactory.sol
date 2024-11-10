// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts@4.9.3/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/security/Pausable.sol";

interface IUSDC {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);
    
    function transfer(address to, uint256 amount) external returns (bool);
    
    function allowance(address owner, address spender) external view returns (uint256);
    
    function approve(address spender, uint256 amount) external returns (bool);
    
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IRealEstateToken {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function assetValue() external view returns (uint256);
    function maxSupply() external view returns (uint256);
}

contract RealEstateFactory is Ownable {
    address[] public realEstateContracts;
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // USDC address

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
    ) public onlyOwner {
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

    function getRealEstateContractByIndex(
        uint index
    ) public view returns (address) {
        require(index < realEstateContracts.length, "Index out of bounds");
        return realEstateContracts[index];
    }

    function getAllRealEstateContracts()
        public
        view
        returns (address[] memory)
    {
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
    IUSDC public usdc;
    uint256 public assetValue;
    uint256 public SHARE_PRICE;
    uint256 public maxSupply;
    mapping(address => uint256) public investment;

    event SharesPurchased(
        address indexed buyer,
        uint256 numberOfShares,
        uint256 amount
    );
    event SharesWithdrawn(
        address indexed seller,
        uint256 numberOfShares,
        uint256 amount
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
        // mainnet -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        usdc = IUSDC(0x036CbD53842c5426634e7929541eC2318f3dCF7e); // USDC address
        
        // Convert initialAssetValue to USDC's 6 decimals
        assetValue = initialAssetValue * 1e6;
        
        // Store maxSupply without decimals for calculations
        maxSupply = _maxSupply;
        
        // Mint tokens with 18 decimals
        _mint(address(this), maxSupply * 1e18);

        // Calculate share price in USDC (6 decimals)
        // assetValue (in USDC with 6 decimals) / maxSupply (no decimals)
        SHARE_PRICE = assetValue / maxSupply;
        transferOwnership(ownerAddress);
    }

    function buyShares(uint256 numberOfShares) public whenNotPaused {
        require(numberOfShares > 0, "Number of shares must be greater than 0");
        
        // Calculate USDC amount needed (will have 6 decimals)
        uint256 requiredUSDC = SHARE_PRICE * numberOfShares;
        
        require(
            usdc.balanceOf(msg.sender) >= requiredUSDC,
            "Insufficient USDC balance"
        );

        // Check for sufficient allowance
        uint256 allowance = usdc.allowance(msg.sender, address(this));
        // Convert numberOfShares to 18 decimals for ERC20 transfer
        uint256 scaledAmount = numberOfShares * 1e18;
        
        require(allowance >= requiredUSDC, "USDC allowance too low");
        require(
            balanceOf(address(this)) >= scaledAmount,
            "Not enough shares available"
        );

        usdc.transferFrom(msg.sender, address(this), requiredUSDC);
        _transfer(address(this), msg.sender, scaledAmount);

        investment[msg.sender] += requiredUSDC;

        emit SharesPurchased(msg.sender, numberOfShares, requiredUSDC);
    }

    function withdrawAndCashOut() public whenNotPaused {
        uint256 tokenBalance = balanceOf(msg.sender);
        require(tokenBalance > 0, "You do not own any tokens");
        
        // Convert 18 decimal token balance to number of shares
        uint256 sharesOwned = tokenBalance / 1e18;
        // Calculate USDC value (will have 6 decimals)
        uint256 totalShareValue = sharesOwned * SHARE_PRICE;

        require(
            usdc.balanceOf(address(this)) >= totalShareValue,
            "Insufficient USDC in the contract"
        );

        usdc.transfer(msg.sender, totalShareValue);
        _transfer(msg.sender, address(this), tokenBalance);

        emit SharesWithdrawn(msg.sender, sharesOwned, totalShareValue);
    }

    function updateAssetValue(
        uint256 newAssetValue
    ) public onlyOwner whenNotPaused {
        require(newAssetValue > 0, "Asset value must be greater than 0");

        // Convert to USDC decimals
        assetValue = newAssetValue * 1e6;
        // Calculate new share price in USDC
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
        uint256 contractBalance = usdc.balanceOf(address(this));
        require(contractBalance > 0, "No funds to withdraw");
        usdc.transfer(owner(), contractBalance);
    }

    receive() external payable {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}