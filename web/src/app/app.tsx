import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { RPC_ENDPOINT } from './utils/keys';
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import SwapPage from './SwapPage';

require('@solana/wallet-adapter-react-ui/styles.css');

export function App() {
  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <WalletMultiButton />
          <SwapPage />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
