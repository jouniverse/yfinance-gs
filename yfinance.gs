/**
 * Fetches Yahoo Finance chart data for a given ticker.
 * Internal helper function used by other custom functions.
 *
 * @param {string} ticker The stock symbol.
 * @param {string} range Optional. Time range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max. Default: 1d.
 * @param {string} interval Optional. Data interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo. Default: 1m.
 * @return {Object|string} The parsed chart result or an error message.
 */
function fetchYahooFinanceData_(ticker, range, interval) {
  if (!ticker || typeof ticker !== 'string') {
    return "Error: Ticker is required and must be a string.";
  }

  // Default values
  const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'];
  const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  
  const selectedRange = range && validRanges.includes(range) ? range : '1d';
  const selectedInterval = interval && validIntervals.includes(interval) ? interval : '1m';

  // URL-encode the ticker to handle special characters like ^ in indices (e.g., ^GSPC, ^DJI)
  // Manual encoding for ^ character as encodeURIComponent may not work reliably in Apps Script
  const cleanTicker = ticker.trim().replace(/\^/g, '%5E').replace(/=/g, '%3D');
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + cleanTicker + '?range=' + selectedRange + '&interval=' + selectedInterval;

  try {
    Logger.log('Fetching URL: ' + url);  // Debug: check Apps Script logs (View > Logs)
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const contentText = response.getContentText();
    const data = JSON.parse(contentText);

    if (data && data.chart && data.chart.result && data.chart.result.length > 0) {
      return data.chart.result[0];
    } else if (data && data.chart && data.chart.error) {
      return `Error: ${data.chart.error.description || 'Unknown API error'}`;
    } else {
      return `Error: Unable to retrieve data for ticker ${ticker}. Check the symbol.`;
    }
  } catch (error) {
    return `Error fetching data: ${error.message}`;
  }
}

/**
 * Gets the current regular market price for a given ticker from Yahoo Finance.
 * Supports stocks, ETFs, indices, futures, currencies, and crypto.
 *
 * @param {string} ticker The symbol (e.g., "AAPL", "BTC-USD", "^GSPC", "^DJI", "GC=F", "EURUSD=X").
 * @return {number|string} The current market price, or an error message.
 * @customfunction
 */
function YAHOOFINANCE_PRICE(ticker) {
  const result = fetchYahooFinanceData_(ticker);
  if (typeof result === 'string') return result;

  const price = result.meta.regularMarketPrice;
  return price ? price : `Error: Price not found for ticker ${ticker}.`;
}

/**
 * Gets comprehensive metadata for a given ticker from Yahoo Finance.
 * Supports stocks, ETFs, indices, futures, currencies, and crypto.
 * Returns a row with: Symbol, Name, Currency, Exchange, Type, Price, Previous Close,
 * Day High, Day Low, Volume, 52W High, 52W Low, Market Time
 *
 * @param {string} ticker The symbol (e.g., "AAPL", "^GSPC", "^DJI", "GC=F", "EURUSD=X").
 * @param {boolean} includeHeaders Optional. If TRUE, includes a header row. Default is FALSE.
 * @return {Array} A row (or rows with header) of metadata values.
 * @customfunction
 */
function YAHOOFINANCE_QUOTE(ticker, includeHeaders) {
  const result = fetchYahooFinanceData_(ticker);
  if (typeof result === 'string') return result;

  const meta = result.meta;
  
  const dataRow = [
    meta.symbol || "",
    meta.longName || meta.shortName || "",
    meta.currency || "",
    meta.fullExchangeName || meta.exchangeName || "",
    meta.instrumentType || "",
    meta.regularMarketPrice || "",
    meta.previousClose || "",
    meta.regularMarketDayHigh || "",
    meta.regularMarketDayLow || "",
    meta.regularMarketVolume || "",
    meta.fiftyTwoWeekHigh || "",
    meta.fiftyTwoWeekLow || "",
    meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : ""
  ];

  if (includeHeaders === true) {
    const headerRow = [
      "Symbol", "Name", "Currency", "Exchange", "Type", "Price", "Prev Close",
      "Day High", "Day Low", "Volume", "52W High", "52W Low", "Market Time"
    ];
    return [headerRow, dataRow];
  }

  return [dataRow];
}

/**
 * Gets the latest OHLCV (Open, High, Low, Close, Volume) data for a given ticker.
 * Returns a row with: Timestamp, Open, High, Low, Close, Volume
 *
 * @param {string} ticker The stock symbol (e.g., "AAPL", "GOOG", "USO").
 * @param {boolean} includeHeaders Optional. If TRUE, includes a header row. Default is FALSE.
 * @return {Array} A row (or rows with header) of the latest OHLCV values.
 * @customfunction
 */
function YAHOOFINANCE_OHLCV(ticker, includeHeaders) {
  const result = fetchYahooFinanceData_(ticker);
  if (typeof result === 'string') return result;

  const timestamps = result.timestamp;
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  
  if (!timestamps || !quote || timestamps.length === 0) {
    return `Error: No OHLCV data available for ticker ${ticker}.`;
  }

  // Get the last (most recent) data point
  const lastIndex = timestamps.length - 1;
  
  const dataRow = [
    new Date(timestamps[lastIndex] * 1000),
    quote.open ? quote.open[lastIndex] : "",
    quote.high ? quote.high[lastIndex] : "",
    quote.low ? quote.low[lastIndex] : "",
    quote.close ? quote.close[lastIndex] : "",
    quote.volume ? quote.volume[lastIndex] : ""
  ];

  if (includeHeaders === true) {
    const headerRow = ["Timestamp", "Open", "High", "Low", "Close", "Volume"];
    return [headerRow, dataRow];
  }

  return [dataRow];
}

/**
 * Gets historical OHLCV data for a given ticker with customizable time range and interval.
 * Returns multiple rows with: Timestamp, Open, High, Low, Close, Volume
 *
 * @param {string} ticker The stock symbol (e.g., "AAPL", "GOOG", "USO").
 * @param {boolean} includeHeaders Optional. If TRUE, includes a header row. Default is FALSE.
 * @param {number} limit Optional. Maximum number of rows to return. Default is all.
 * @param {string} range Optional. Time range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max. Default: 1d.
 * @param {string} interval Optional. Data interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo. Default: 1m.
 * @return {Array} Multiple rows of OHLCV values (newest first).
 * @customfunction
 */
function YAHOOFINANCE_OHLCV_HISTORY(ticker, includeHeaders, limit, range, interval) {
  const result = fetchYahooFinanceData_(ticker, range, interval);
  if (typeof result === 'string') return result;

  const timestamps = result.timestamp;
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  
  if (!timestamps || !quote || timestamps.length === 0) {
    return `Error: No OHLCV data available for ticker ${ticker}.`;
  }

  const rows = [];
  
  if (includeHeaders === true) {
    rows.push(["Timestamp", "Open", "High", "Low", "Close", "Volume"]);
  }

  // Determine how many rows to return
  const maxRows = limit && limit > 0 ? Math.min(limit, timestamps.length) : timestamps.length;
  
  // Iterate from newest to oldest
  for (let i = timestamps.length - 1; i >= timestamps.length - maxRows; i--) {
    rows.push([
      new Date(timestamps[i] * 1000),
      quote.open ? quote.open[i] : "",
      quote.high ? quote.high[i] : "",
      quote.low ? quote.low[i] : "",
      quote.close ? quote.close[i] : "",
      quote.volume ? quote.volume[i] : ""
    ]);
  }

  return rows;
}

/**
 * Gets a specific metadata field for a given ticker.
 * Available fields: symbol, longName, shortName, currency, exchangeName, fullExchangeName,
 * instrumentType, regularMarketPrice, previousClose, regularMarketDayHigh, regularMarketDayLow,
 * regularMarketVolume, fiftyTwoWeekHigh, fiftyTwoWeekLow, chartPreviousClose, regularMarketTime,
 * firstTradeDate, exchangeTimezoneName, timezone
 *
 * @param {string} ticker The stock symbol (e.g., "AAPL", "GOOG", "USO").
 * @param {string} field The metadata field name to retrieve.
 * @return {any} The value of the requested field.
 * @customfunction
 */
function YAHOOFINANCE_META(ticker, field) {
  const result = fetchYahooFinanceData_(ticker);
  if (typeof result === 'string') return result;

  const meta = result.meta;
  
  if (!field || typeof field !== 'string') {
    return "Error: Field name is required.";
  }

  const fieldLower = field.toLowerCase().replace(/[_\s]/g, '');
  
  // Map common field variations to actual field names
  const fieldMap = {
    'symbol': meta.symbol,
    'longname': meta.longName,
    'name': meta.longName || meta.shortName,
    'shortname': meta.shortName,
    'currency': meta.currency,
    'exchangename': meta.exchangeName,
    'exchange': meta.fullExchangeName || meta.exchangeName,
    'fullexchangename': meta.fullExchangeName,
    'instrumenttype': meta.instrumentType,
    'type': meta.instrumentType,
    'regularmarketprice': meta.regularMarketPrice,
    'price': meta.regularMarketPrice,
    'previousclose': meta.previousClose,
    'prevclose': meta.previousClose,
    'regularmarketdayhigh': meta.regularMarketDayHigh,
    'dayhigh': meta.regularMarketDayHigh,
    'high': meta.regularMarketDayHigh,
    'regularmarketdaylow': meta.regularMarketDayLow,
    'daylow': meta.regularMarketDayLow,
    'low': meta.regularMarketDayLow,
    'regularmarketvolume': meta.regularMarketVolume,
    'volume': meta.regularMarketVolume,
    'fiftytwoweeklow': meta.fiftyTwoWeekLow,
    '52weeklow': meta.fiftyTwoWeekLow,
    '52wlow': meta.fiftyTwoWeekLow,
    'fiftytwoweekhigh': meta.fiftyTwoWeekHigh,
    '52weekhigh': meta.fiftyTwoWeekHigh,
    '52whigh': meta.fiftyTwoWeekHigh,
    'chartpreviousclose': meta.chartPreviousClose,
    'regularmarkettime': meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : "",
    'markettime': meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : "",
    'firsttradedate': meta.firstTradeDate ? new Date(meta.firstTradeDate * 1000) : "",
    'exchangetimezonename': meta.exchangeTimezoneName,
    'timezone': meta.timezone || meta.exchangeTimezoneName
  };

  if (fieldLower in fieldMap) {
    return fieldMap[fieldLower] !== undefined ? fieldMap[fieldLower] : "";
  }
  
  // Try direct field access as fallback
  if (field in meta) {
    return meta[field];
  }

  return `Error: Unknown field "${field}".`;
}
