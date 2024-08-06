import {
  signTransaction,
  Transaction,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import base58 from 'bs58';

export interface TradeableToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
}

export async function getTradeableTokens(): Promise<TradeableToken[] | null> {
  const response = await fetch('https://token.jup.ag/strict');
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export interface QuoteResponse {
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  otherAmountThreshold: string;
  outAmount: string;
  outputMint: string;
  routePlan: { percent: number; swapInfo: { feeAmount: string } }[];
}

export async function quoteSwap(
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<QuoteResponse | null> {
  const queryParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
  });

  const response = await fetch(
    'https://quote-api.jup.ag/v6/quote?' + queryParams.toString()
  );
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function getSwapTransaction(
  userPublicKey: string,
  quoteResponse: QuoteResponse,
  umi: Umi
): Promise<[Transaction, number] | null> {
  const response = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPublicKey, quoteResponse }),
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();

  const swapTransactionBuf = Buffer.from(json.swapTransaction, 'base64');
  const transaction = umi.transactions.deserialize(swapTransactionBuf);
  return [transaction, json.prioritizationFeeLamports];
}

export async function triggerJupiterSwap(transaction: Transaction, umi: Umi) {
  let signedTransaction;
  try {
    signedTransaction = await signTransaction(transaction, [umi.identity]);
  } catch (error) {
    return null;
  }

  try {
    const signature = await umi.rpc.sendTransaction(signedTransaction);
    await umi.rpc.confirmTransaction(signature, {
      strategy: { type: 'blockhash', ...(await umi.rpc.getLatestBlockhash()) },
    });
    return base58.encode(signature);
  } catch (error) {
    return null;
  }
}
