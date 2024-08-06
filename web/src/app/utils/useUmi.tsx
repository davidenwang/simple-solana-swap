import { useWallet } from '@solana/wallet-adapter-react';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { Umi } from '@metaplex-foundation/umi';
import { useEffect, useState } from 'react';
import { RPC_ENDPOINT } from './keys';

/**
 * Hook to retrieve a Umi with a connected wallet, returns null if no wallet is connected
 */
export default function useUmi(): Umi | null {
  const wallet = useWallet();

  const [umi, setUmi] = useState<Umi | null>(null);
  useEffect(() => {
    if (!wallet.connected) {
      setUmi(null);
      return;
    }

    const newUmi = createUmi(RPC_ENDPOINT)
      .use(mplTokenMetadata())
      .use(walletAdapterIdentity(wallet));
    setUmi(newUmi);
  }, [wallet]);

  return umi;
}
