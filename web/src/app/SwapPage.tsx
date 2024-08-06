import useUmi from './utils/useUmi';
import { useEffect, useMemo, useState } from 'react';
import { fetchAllDigitalAssetWithTokenByOwner } from '@metaplex-foundation/mpl-token-metadata';
import {
  Amount,
  amountToString,
  createAmount,
  Transaction,
} from '@metaplex-foundation/umi';
import {
  getSwapTransaction,
  getTradeableTokens,
  QuoteResponse,
  quoteSwap,
  TradeableToken,
  triggerJupiterSwap,
} from './utils/api';
import { QuoteVisualizer } from './QuoteVisualizer';

export interface TokenOption {
  name: string;
  mint: string;
  amount: Amount;
}

const TO_TOKEN_LIMIT = 15;

export default function SwapPage() {
  const umi = useUmi();
  const [tokens, setTokens] = useState<TokenOption[] | null>(null);
  const [tradeableTokens, setTradeableTokens] = useState<
    TradeableToken[] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<boolean>(false);

  // Debounced amount
  const [amount, setAmount] = useState<string>('0');
  // Non-debounced amount
  const [rawAmount, setRawAmount] = useState<string>('0');
  const [fromToken, setFromToken] = useState<string | undefined>(undefined);
  const [toToken, setToToken] = useState<string | undefined>(undefined);

  const [swapData, setSwapData] = useState<{
    quoteResponse: QuoteResponse;
    transaction: Transaction;
    prioritizationFee: number;
  } | null>(null);
  const [fetchingQuoteResponse, setFetchingQuoteResponse] =
    useState<boolean>(false);

  // Debounced effect for amount input
  useEffect(() => {
    const delayTimeoutId = setTimeout(() => {
      setAmount(rawAmount);
    }, 500);
    return () => clearTimeout(delayTimeoutId);
  }, [rawAmount]);

  // Loads a list of tradeable tokens
  useEffect(() => {
    async function fetchTradeableTokens() {
      const tokens = await getTradeableTokens();
      if (!tokens) {
        setErrorMessage('Failed to fetch tradeable tokens');
      }

      if (tokens && tokens.length > 0) {
        setToToken(tokens[0].address);
      }
      setTradeableTokens(tokens);
    }

    fetchTradeableTokens();
  }, []);

  // Load tokens and balances for user
  useEffect(() => {
    async function fetchBalanceAndTokens() {
      if (!umi) {
        return;
      }

      const publicKey = umi.identity.publicKey;
      const ownedTokensPromise = fetchAllDigitalAssetWithTokenByOwner(
        umi,
        publicKey
      );
      const balancePromise = umi.rpc.getBalance(publicKey);
      const [ownedTokens, balance] = await Promise.all([
        ownedTokensPromise,
        balancePromise,
      ]);

      const { identifier, basisPoints, decimals } = balance;
      const options = [
        {
          name: identifier,
          mint: 'So11111111111111111111111111111111111111112',
          amount: createAmount(basisPoints, identifier, decimals),
        },
        ...ownedTokens.map(({ metadata, token, mint }) => ({
          name: metadata.name,
          mint: token.mint,
          amount: createAmount(token.amount, metadata.name, mint.decimals),
        })),
      ];

      if (options.length > 0) {
        setFromToken(options[0].mint);
      }

      setTokens(options);
    }

    fetchBalanceAndTokens();
  }, [umi]);

  const fromTokenData = tokens?.find(({ mint }) => mint === fromToken);
  const toTokenData = useMemo(
    () => tradeableTokens?.find(({ address }) => address === toToken),
    [toToken, tradeableTokens]
  );

  // Polls user input for new swaps/quotes
  useEffect(() => {
    async function updateQuote(
      fromToken: string,
      toToken: string,
      fixedAmount: number
    ) {
      if (!umi) {
        return null;
      }

      setFetchingQuoteResponse(true);
      const quoteResponse = await quoteSwap(fromToken, toToken, fixedAmount);
      if (quoteResponse) {
        const transactionResult = await getSwapTransaction(
          umi.identity.publicKey,
          quoteResponse,
          umi
        );
        if (transactionResult) {
          const [transaction, prioritizationFee] = transactionResult;
          setSwapData({
            quoteResponse,
            transaction,
            prioritizationFee,
          });
        }
      }
      setFetchingQuoteResponse(false);
    }

    const fromTokenAmount = fromTokenData?.amount;
    const fromTokenDecimals = fromTokenAmount?.decimals;

    // Validate the swap
    const validFields = !!toToken && !!fromToken;
    const validSwap =
      toToken != fromToken && parseFloat(amount) > 0 && fromTokenDecimals;

    if (!validFields) {
      setSwapMessage('Please select a from and to token');
      return;
    }

    if (!validSwap) {
      setSwapMessage('Please select differing tokens and a valid amount');
      return;
    }

    if (validFields && validSwap) {
      const fixedAmount = parseFloat(amount) * Math.pow(10, fromTokenDecimals);
      if (fixedAmount > fromTokenAmount.basisPoints) {
        setSwapMessage(`Insufficient ${fromTokenAmount.identifier}`);
        return;
      }

      setSwapMessage(null);
      updateQuote(fromToken, toToken, fixedAmount);
    }
  }, [amount, toToken, fromToken]);

  // Sign and send the transaction on-chain
  async function triggerSwap() {
    if (!umi || !swapData) {
      return;
    }

    setSwapping(true);
    const response = await triggerJupiterSwap(swapData.transaction, umi);
    if (response) {
      setSwapMessage(`Transaction succeeded with signature: ${response}`);
    } else {
      setSwapMessage('Transaction failed');
    }
    setSwapping(false);
  }

  if (errorMessage) {
    return <h1>{errorMessage}</h1>;
  }

  if (!umi) {
    return <h1>Please connect a wallet to continue</h1>;
  }

  if (!tokens || !tradeableTokens) {
    return (
      <main className="container">
        <article>
          <h1>Token Swap</h1>
          <span aria-busy="true">Fetching account details...</span>;
        </article>
      </main>
    );
  }

  return (
    <main className="container">
      <article>
        <h1>Token Swap</h1>
        <label>
          From:
          <select
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value)}
          >
            {tokens.map(({ mint, name, amount }) => (
              <option key={mint} value={mint}>
                {name} - {amountToString(amount)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount:
          <input
            type="number"
            value={rawAmount}
            onChange={(e) => setRawAmount(e.target.value)}
          />
        </label>
        <hr />
        <label>
          To:
          <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
            {tradeableTokens
              .slice(0, TO_TOKEN_LIMIT)
              .map(({ address, symbol, name }) => (
                <option key={address} value={address}>
                  {symbol} - {name}
                </option>
              ))}
          </select>
        </label>
        {swapMessage && <div style={{ color: 'red' }}>{swapMessage}</div>}
        {fetchingQuoteResponse && <div aria-busy="true">Loading quote...</div>}
        {swapData && (
          <QuoteVisualizer
            quoteResponse={swapData.quoteResponse}
            fee={swapData.prioritizationFee}
            fromTokenData={fromTokenData}
            toTokenData={toTokenData}
          />
        )}
        <button
          disabled={!swapData}
          onClick={triggerSwap}
          aria-busy={swapping ? 'true' : 'false'}
        >
          Swap
        </button>
      </article>
    </main>
  );
}
