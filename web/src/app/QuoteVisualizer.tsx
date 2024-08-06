import { amountToString, createAmount } from '@metaplex-foundation/umi';
import { TokenOption } from './SwapPage';
import { QuoteResponse, TradeableToken } from './utils/api';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface Props {
  quoteResponse: QuoteResponse;
  fee: number;
  fromTokenData?: TokenOption;
  toTokenData?: TradeableToken;
}

export function QuoteVisualizer({
  quoteResponse,
  fee,
  fromTokenData,
  toTokenData,
}: Props) {
  const { outAmount } = quoteResponse;
  if (!fromTokenData || !toTokenData) {
    return <div>Missing data for from or to tokens</div>;
  }

  const toAmount = createAmount(
    outAmount,
    toTokenData.name,
    toTokenData.decimals
  );
  return (
    <div>
      Expected to receive: {amountToString(toAmount)} {toTokenData.symbol} with
      prioritization fees of {amountToString(createAmount(fee, 'SOL', 9))} SOL
    </div>
  );
}
