import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { generatePrivateKey, encryptKey, decryptKey, splitString, combineStrings } from '../utils/crypto';
import { getBalance, type BalanceResponse } from '../utils/midnight';
import { isLikelyMidnightAddress, deriveAddresses } from '../utils/addressDerivation';
import { executeInWorker } from '../utils/sdkWorkerClient';

interface Account {
  address: string;
  unshieldedAddress: string;
  dustAddress: string;
  name: string;
  balance: string;
  dustBalance: string;
}

interface WalletState {
  email: string | null;
  isUnlocked: boolean;
  sessionPrivateKey: string | null;
  currentAddress: string | null;
  accounts: Account[];
  network: 'mainnet' | 'preprod' | 'preview' | 'undeployed';

  /** Create a new wallet with split-key architecture */
  createWalletSplit: (
    email: string,
    password: string,
    backupPass: string
  ) => Promise<{
    backupFileContent: string;
    privateKey: string;
  }>;

  /** Recover wallet from server shards + backup file */
  recoverWallet: (
    str1_1: string,
    str1_2: string,
    password: string
  ) => Promise<void>;

  /** Forgot password: decrypt with backup password, re-encrypt with new password */
  resetPassword: (
    str2_1: string,
    str2_2: string,
    backupPass: string,
    newPassword: string,
    newBackupPass: string
  ) => Promise<{
    newStr1_1: string;
    newStr2_1: string;
    backupFileContent: string;
  }>;

  /** Set session after successful recovery */
  setSession: (email: string, privateKey: string) => Promise<void>;

  lockWallet: () => void;
  setNetwork: (net: 'mainnet' | 'preprod' | 'preview' | 'undeployed') => Promise<void>;
  sendTransaction: (to: string, amount: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
  generateDust: () => Promise<{ txHash: string; utxoCount: number; dustAddress: string }>;
  addAccount: () => Promise<void>;
  upgradeLegacyAccounts: () => Promise<void>;
  isFetchingBalance: boolean;
}

function looksLikeMidnightAddress(address: string | undefined): boolean {
  return isLikelyMidnightAddress(address);
}

function parseAmount(value: string | undefined): bigint {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function mergeBalanceParts(...parts: Array<{ night?: string; dust?: string } | undefined>) {
  let night = BigInt(0);
  let dust = BigInt(0);

  for (const part of parts) {
    if (!part) continue;
    night += parseAmount(part.night);
    dust += parseAmount(part.dust);
  }

  return {
    night: night.toString(),
    dust: dust.toString(),
  };
}

function combineBalances(...balances: BalanceResponse[]) {
  return mergeBalanceParts(...balances.flatMap((balance) => [
    balance.shielded,
    balance.unshielded,
    balance,
  ]));
}

function getCurrentAccount(accounts: Account[], currentAddress: string | null): Account | null {
  if (accounts.length === 0) {
    return null;
  }

  return accounts.find((account) => account.address === currentAddress) || accounts[0];
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      email: null,
      isUnlocked: false,
      sessionPrivateKey: null,
      currentAddress: null,
      accounts: [],
      network: 'undeployed',
      isFetchingBalance: false,

      createWalletSplit: async (email, password, backupPass) => {
        const privateKey = generatePrivateKey();
        const { network } = get();

        // Derive addresses directly on main thread (avoids worker WASM init hang)
        const withTimeout = <T>(promise: Promise<T>, ms: number, msg: string): Promise<T> =>
          Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);

        const addresses = await withTimeout(
          deriveAddresses(network, privateKey),
          15000,
          'Address derivation timed out. Please try again.',
        );

        // Encrypt with password (str1) and backupPass (str2)
        const str1 = await encryptKey(privateKey, password);
        const str2 = await encryptKey(privateKey, backupPass);

        // Split each into halves
        const [str1_1, str1_2] = splitString(str1);
        const [str2_1, str2_2] = splitString(str2);

        // Create backup file content
        const backupFileContent = JSON.stringify({
          str1_2,
          str2_2,
          email,
          version: 2,
        }, null, 2);

        const account: Account = {
          address: addresses.shielded,
          unshieldedAddress: addresses.unshielded,
          dustAddress: addresses.dust,
          name: 'Account 1',
          balance: '0',
          dustBalance: '0',
        };

        set({
          email,
          sessionPrivateKey: privateKey,
          currentAddress: addresses.shielded,
          accounts: [account],
          isUnlocked: true,
        });

        // Return shards and backup for the caller to handle
        return {
          backupFileContent,
          privateKey,
          // These are needed by the caller to send to server:
          str1_1,
          str2_1,
        } as any;
      },

      recoverWallet: async (str1_1, str1_2, password) => {
        // Combine the two halves
        const encryptedStr = combineStrings(str1_1, str1_2);

        // Decrypt with password
        const privateKey = await decryptKey(encryptedStr, password);

        const { network } = get();
        const addresses = await deriveAddresses(network, privateKey);

        const account: Account = {
          address: addresses.shielded,
          unshieldedAddress: addresses.unshielded,
          dustAddress: addresses.dust,
          name: 'Account 1',
          balance: '0',
          dustBalance: '0',
        };

        set({
          sessionPrivateKey: privateKey,
          currentAddress: addresses.shielded,
          accounts: [account],
          isUnlocked: true,
        });
      },

      resetPassword: async (str2_1, str2_2, backupPass, newPassword, newBackupPass) => {
        // Combine backup-encrypted halves
        const encryptedStr = combineStrings(str2_1, str2_2);

        // Decrypt with backup password
        const privateKey = await decryptKey(encryptedStr, backupPass);

        // Re-encrypt with new password and new backup password
        const newStr1 = await encryptKey(privateKey, newPassword);
        const newStr2 = await encryptKey(privateKey, newBackupPass);

        const [newStr1_1, newStr1_2] = splitString(newStr1);
        const [newStr2_1, newStr2_2] = splitString(newStr2);

        const { email, network } = get();
        const addresses = await deriveAddresses(network, privateKey);

        const account: Account = {
          address: addresses.shielded,
          unshieldedAddress: addresses.unshielded,
          dustAddress: addresses.dust,
          name: 'Account 1',
          balance: '0',
          dustBalance: '0',
        };

        set({
          sessionPrivateKey: privateKey,
          currentAddress: addresses.shielded,
          accounts: [account],
          isUnlocked: true,
        });

        const backupFileContent = JSON.stringify({
          str1_2: newStr1_2,
          str2_2: newStr2_2,
          email,
          version: 2,
        }, null, 2);

        return {
          newStr1_1,
          newStr2_1,
          backupFileContent,
        };
      },

      setSession: async (email, privateKey) => {
        const { network } = get();
        const addresses = await deriveAddresses(network, privateKey);

        const account: Account = {
          address: addresses.shielded,
          unshieldedAddress: addresses.unshielded,
          dustAddress: addresses.dust,
          name: 'Account 1',
          balance: '0',
          dustBalance: '0',
        };

        set({
          email,
          sessionPrivateKey: privateKey,
          currentAddress: addresses.shielded,
          accounts: [account],
          isUnlocked: true,
        });
      },

      lockWallet: () => set({ isUnlocked: false, sessionPrivateKey: null }),

      setNetwork: async (network) => {
        const { sessionPrivateKey, accounts } = get();
        if (!sessionPrivateKey || accounts.length === 0) {
          set({ network });
          return;
        }

        try {
          const derived = await deriveAddresses(network, sessionPrivateKey);
          
          set((state) => {
            const currentIndex = Math.max(
              0,
              state.accounts.findIndex((account) => account.address === state.currentAddress)
            );
            const updatedAccounts = state.accounts.map((account, index) =>
              index === currentIndex
                ? {
                    ...account,
                    address: derived.shielded,
                    unshieldedAddress: derived.unshielded,
                    dustAddress: derived.dust,
                  }
                : account
            );

            return {
              network,
              accounts: updatedAccounts,
              currentAddress: derived.shielded,
            };
          });
        } catch (error) {
          console.error('[Luna] Failed to re-derive addresses for network switch:', error);
          set({ network });
        }
      },

      sendTransaction: async (to, amount) => {
        const { currentAddress, network, sessionPrivateKey } = get();
        if (!currentAddress) throw new Error('No active account selected');
        if (!sessionPrivateKey) throw new Error('Unlock wallet to send transactions');

        const response = await executeInWorker<{ txHash: string }>('SEND_TRANSACTION', { network, privateKey: sessionPrivateKey, to, amount });

        if (!response?.txHash) throw new Error('Transaction was not accepted by network');
        return response.txHash;
      },

      refreshBalance: async () => {
        const { accounts, currentAddress, network, sessionPrivateKey } = get();
        const currentAccount = getCurrentAccount(accounts, currentAddress);
        if (!currentAccount) return;

        set({ isFetchingBalance: true });

        try {
          // Phase 1: Fast RPC query for immediate NIGHT balance update
          try {
            const [shieldedBalance, unshieldedBalance] = await Promise.all([
              getBalance(network, currentAccount.address),
              getBalance(network, currentAccount.unshieldedAddress),
            ]);
            const rpcMerged = combineBalances(shieldedBalance, unshieldedBalance);
            
            set((state) => {
              const latest = getCurrentAccount(state.accounts, state.currentAddress);
              if (!latest || latest.address !== currentAccount.address) return state;

              const updated = state.accounts.map((acc) =>
                acc.address === currentAccount.address
                  ? { ...acc, balance: rpcMerged.night }
                  : acc
              );
              return { accounts: updated };
            });
          } catch (rpcError) {
            console.warn('[Luna] RPC GET_BALANCES failed:', rpcError);
          }

          // Phase 2: Slow SDK query to retrieve DUST and potential accurate state
          if (sessionPrivateKey) {
            try {
              const sdkBalance = await executeInWorker<{
                addresses: { shielded: string; unshielded: string; dust: string };
                night: { shielded: string; unshielded: string; total: string };
                dust: string;
              }>('GET_BALANCES', { network, privateKey: sessionPrivateKey });

              set((state) => {
                const latest = getCurrentAccount(state.accounts, state.currentAddress);
                if (!latest || latest.address !== currentAccount.address) return state;

                const currentBalance = latest.balance;
                const finalNight = (BigInt(currentBalance) > 0) ? currentBalance : (sdkBalance?.night?.total || '0');
                const finalDust = sdkBalance?.dust || '0';

                const updated = state.accounts.map((acc) =>
                  acc.address === currentAccount.address
                    ? {
                        ...acc,
                        address: sdkBalance.addresses.shielded || acc.address,
                        unshieldedAddress: sdkBalance.addresses.unshielded || acc.unshieldedAddress,
                        dustAddress: sdkBalance.addresses.dust || acc.dustAddress,
                        balance: finalNight,
                        dustBalance: finalDust,
                      }
                    : acc
                );
                return {
                  accounts: updated,
                  currentAddress: sdkBalance.addresses.shielded || state.currentAddress,
                };
              });
            } catch (sdkError) {
              console.warn('[Luna] SDK GET_BALANCES failed, bypassed:', sdkError);
            }
          }
        } finally {
          set({ isFetchingBalance: false });
        }
      },

      generateDust: async () => {
        const { currentAddress, accounts, network, sessionPrivateKey } = get();
        if (!currentAddress) throw new Error('No active account selected');
        if (!sessionPrivateKey) throw new Error('Unlock wallet to generate DUST');

        const currentAccount = getCurrentAccount(accounts, currentAddress);
        if (!currentAccount) throw new Error('No active account selected');
        const result = await executeInWorker<{ txHash: string; utxoCount: number; dustAddress: string }>('GENERATE_DUST', { network, privateKey: sessionPrivateKey, dustAddress: currentAccount.dustAddress });
        await get().refreshBalance();
        return result;
      },

      addAccount: async () => {
        const { accounts, network, sessionPrivateKey } = get();
        const addresses = await deriveAddresses(network, sessionPrivateKey || undefined);
        const newAccount: Account = {
          address: addresses.shielded,
          unshieldedAddress: addresses.unshielded,
          dustAddress: addresses.dust,
          name: `Account ${accounts.length + 1}`,
          balance: '0',
          dustBalance: '0',
        };
        set({ accounts: [...accounts, newAccount], currentAddress: addresses.shielded });
      },

      upgradeLegacyAccounts: async () => {
        const { accounts, currentAddress, network, sessionPrivateKey } = get();
        if (accounts.length === 0) return;

        const needsUpgrade = accounts.some(
          (account) =>
            !looksLikeMidnightAddress(account.address) ||
            !looksLikeMidnightAddress(account.unshieldedAddress) ||
            !looksLikeMidnightAddress(account.dustAddress)
        );

        if (!needsUpgrade) return;

        const upgradedAccounts: Account[] = [];
        for (const account of accounts) {
          const addresses = await deriveAddresses(network, sessionPrivateKey || undefined);
          upgradedAccounts.push({
            ...account,
            address: addresses.shielded,
            unshieldedAddress: addresses.unshielded,
            dustAddress: addresses.dust,
          });
        }

        const previousIndex = accounts.findIndex((account) => account.address === currentAddress);
        const nextCurrentAddress =
          previousIndex >= 0
            ? upgradedAccounts[previousIndex]?.address || upgradedAccounts[0].address
            : upgradedAccounts[0].address;

        set({ accounts: upgradedAccounts, currentAddress: nextCurrentAddress });
      },
    }),
    {
      name: 'luna-wallet',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        email: state.email,
        currentAddress: state.currentAddress,
        accounts: state.accounts,
        network: state.network,
      }),
    }
  )
);
