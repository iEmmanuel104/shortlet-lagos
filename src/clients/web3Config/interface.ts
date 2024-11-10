/* eslint-disable no-unused-vars */
import { BaseContract, ContractTransactionResponse } from 'ethers';

export interface ICreateTokenParams {
    name: string;
    symbol: string;
    initialAssetValue: number;
    maxSupply: number;
    ownerAddress: string;
}

export interface RealEstateFactoryContract extends BaseContract {
    // Methods
    createRealEstateToken: {
        (
            name: string,
            symbol: string,
            initialAssetValue: bigint,
            maxSupply: bigint,
            ownerAddress: string
        ): Promise<ContractTransactionResponse>;
    };
    USDC_ADDRESS: {
        (): Promise<string>;
    };
    getRealEstateContractsCount: {
        (): Promise<bigint>;
    };
    getRealEstateContractByIndex: {
        (index: bigint): Promise<string>;
    };
    getAllRealEstateContracts: {
        (): Promise<string[]>;
    };
    getRealEstateTokenDetails: {
        (tokenAddress: string): Promise<[string, string, bigint, bigint]>;
    };
}

export interface USDCContract extends BaseContract {
    balanceOf: {
        (account: string): Promise<bigint>;
    };
    approve: {
        (spender: string, amount: bigint): Promise<ContractTransactionResponse>;
    };
    transferFrom: {
        (from: string, to: string, amount: bigint): Promise<ContractTransactionResponse>;
    };
    allowance: {
        (owner: string, spender: string): Promise<bigint>;
    };
}

export interface RealEstateTokenContract extends BaseContract {
    assetValue: {
        (): Promise<bigint>;
    };
    SHARE_PRICE: {
        (): Promise<bigint>;
    };
    maxSupply: {
        (): Promise<bigint>;
    };
    investment: {
        (address: string): Promise<bigint>;
    };
    buyShares: {
        (numberOfShares: bigint): Promise<ContractTransactionResponse>;
    };
    withdrawAndCashOut: {
        (): Promise<ContractTransactionResponse>;
    };
    updateAssetValue: {
        (newAssetValue: bigint): Promise<ContractTransactionResponse>;
    };
    emergencyWithdraw: {
        (): Promise<ContractTransactionResponse>;
    };
    pause: {
        (): Promise<ContractTransactionResponse>;
    };
    unpause: {
        (): Promise<ContractTransactionResponse>;
    };
}