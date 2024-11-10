// import { ethers } from 'ethers';
// import {
//     REAL_ESTATE_FACTORY_ABI,
//     USDC_ABI,
//     FACTORY_CONTRACT_ADDRESS,
//     BASE_USDC_CONTRACT_ADDRESS,
// } from '../utils/abis';
// import { logger } from '../utils/logger';

// // Define interfaces for our contracts
// export interface RealEstateFactoryContract extends ethers.Contract {
//     createRealEstateToken: (name: string, symbol: string, initialAssetValue: bigint, maxSupply: bigint, ownerAddress: string) => Promise<ethers.ContractTransactionResponse>;
//     USDC_ADDRESS(): Promise<string>;
// }

// export interface USDCContract extends ethers.Contract {
//     balanceOf(account: string): Promise<bigint>;
//     approve(spender: string, amount: bigint): Promise<ethers.ContractTransactionResponse>;
// }

// // Initialize provider
// const BASE_SEPOLIA_RPC = 'https://base-sepolia-rpc.publicnode.com';
// export const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, {
//     chainId: 84532,
//     name: 'base-sepolia',
// });

// // Initialize contract instances
// const factoryContract = new ethers.Contract(
//     FACTORY_CONTRACT_ADDRESS,
//     REAL_ESTATE_FACTORY_ABI,
//     provider
// ) as unknown as RealEstateFactoryContract;

// const usdcContract = new ethers.Contract(
//     BASE_USDC_CONTRACT_ADDRESS,
//     USDC_ABI,
//     provider
// ) as unknown as USDCContract;

// // Get contract instances with optional signer
// export function getFactoryContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): RealEstateFactoryContract {
//     if (signerOrProvider) {
//         return factoryContract.connect(signerOrProvider) as RealEstateFactoryContract;
//     }
//     return factoryContract;
// }

// export function getUSDCContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): USDCContract {
//     if (signerOrProvider) {
//         return usdcContract.connect(signerOrProvider) as USDCContract;
//     }
//     return usdcContract;
// }

// // Helper function to get signer for wallet
// export async function getWalletSigner(privateKey: string): Promise<ethers.Wallet> {
//     return new ethers.Wallet(privateKey, provider);
// }

// // Main class for Web3 interactions
// class Web3ClientConfig {
//     private static wallet: ethers.Wallet | null = null;
//     private static factoryContractWithSigner: RealEstateFactoryContract | null = null;
//     private static usdcContractWithSigner: USDCContract | null = null;

//     static async initialize(privateKey: string) {
//         try {
//             // Initialize wallet
//             this.wallet = await getWalletSigner(privateKey);
            
//             // Initialize contracts with signer
//             this.factoryContractWithSigner = getFactoryContractInstance(this.wallet);
//             this.usdcContractWithSigner = getUSDCContractInstance(this.wallet);

//             logger.info('Web3 client initialized successfully with address:', this.wallet.address);

//         } catch (error) {
//             logger.error('Failed to initialize Web3 client:', error);
//             throw error;
//         }
//     }

//     static async createPropertyToken({ 
//         name, 
//         symbol, 
//         initialAssetValue, 
//         maxSupply, 
//         ownerAddress, 
//     }: ICreateTokenParams): Promise<string> {
//         try {
//             if (!this.factoryContractWithSigner) {
//                 throw new Error('Factory contract not initialized');
//             }

//             logger.info('Creating property token with params:', {
//                 name,
//                 symbol,
//                 initialAssetValue,
//                 maxSupply,
//                 ownerAddress,
//             });

//             const tx = await this.factoryContractWithSigner.createRealEstateToken(
//                 name,
//                 symbol,
//                 BigInt(initialAssetValue),
//                 BigInt(maxSupply),
//                 ownerAddress
//             );

//             logger.info(`Transaction submitted with hash: ${tx.hash}`);

//             const receipt = await tx.wait();
//             if (!receipt) {
//                 throw new Error('Transaction receipt not found');
//             }

//             logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

//             // Find the token creation event
//             const event = receipt.logs.find((log: ethers.Log) => {
//                 try {
//                     const parsedLog = this.factoryContractWithSigner?.interface.parseLog({
//                         topics: [...log.topics],
//                         data: log.data,
//                     });
//                     return parsedLog?.name === 'RealEstateTokenCreated';
//                 } catch {
//                     return false;
//                 }
//             });

//             if (!event) {
//                 throw new Error('Token creation event not found in transaction receipt');
//             }

//             const parsedEvent = this.factoryContractWithSigner.interface.parseLog({
//                 topics: [...event.topics],
//                 data: event.data,
//             });

//             if (!parsedEvent || !parsedEvent.args || !parsedEvent.args['newTokenAddress']) {
//                 throw new Error('Invalid event data: newTokenAddress not found in event args');
//             }

//             const newTokenAddress = parsedEvent.args['newTokenAddress'] as string;
//             logger.info(`Token created successfully at address: ${newTokenAddress}`);
//             return newTokenAddress;

//         } catch (error) {
//             logger.error('Error creating property token:', error);
//             throw error;
//         }
//     }

//     static async getUSDCBalance(userAddress: string): Promise<bigint> {
//         try {
//             const balance = await usdcContract.balanceOf(userAddress);
//             return balance;
//         } catch (error) {
//             logger.error('Error getting USDC balance:', error);
//             throw error;
//         }
//     }

//     static async approveUSDCSpending(spenderAddress: string, amount: bigint): Promise<string> {
//         try {
//             if (!this.usdcContractWithSigner) {
//                 throw new Error('USDC contract not initialized');
//             }

//             const tx = await this.usdcContractWithSigner.approve(spenderAddress, amount);
//             const receipt = await tx.wait();
            
//             if (!receipt) {
//                 throw new Error('Transaction receipt not found');
//             }

//             return tx.hash;

//         } catch (error) {
//             logger.error('Error approving USDC spending:', error);
//             throw error;
//         }
//     }

//     static async getFactoryUSDCAddress(): Promise<string> {
//         try {
//             const usdcAddress = await factoryContract.USDC_ADDRESS();
//             logger.info('Retrieved USDC address from factory:', usdcAddress);
//             return usdcAddress;
//         } catch (error) {
//             logger.error('Error getting USDC address from factory:', error);
//             throw error;
//         }
//     }
// }

// // Retry configuration for initialization
// const MAX_RETRY_ATTEMPTS = 3;
// const RETRY_DELAY = 5000; // 5 seconds

// export async function initializeWeb3(privateKey: string, attempt: number = 1): Promise<void> {
//     try {
//         await Web3ClientConfig.initialize(privateKey);
//     } catch (error) {
//         logger.error(`Failed to initialize Web3 client (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`, error);

//         if (attempt < MAX_RETRY_ATTEMPTS) {
//             logger.info(`Retrying Web3 initialization in ${RETRY_DELAY / 1000} seconds...`);
//             await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
//             await initializeWeb3(privateKey, attempt + 1);
//         } else {
//             throw new Error('Failed to initialize Web3 client after maximum retry attempts');
//         }
//     }
// }

// export interface ICreateTokenParams {
//     name: string;
//     symbol: string;
//     initialAssetValue: number;
//     maxSupply: number;
//     ownerAddress: string;
// }

// export default Web3ClientConfig;