// MarkovChainCloseStatExtrapolation.js

// Weighted random implementation from
// https://www.codementor.io/@trehleb/1mxquk46q0
function weightedRandom(items, weights) {
  if (items.length !== weights.length) {
    throw new Error("Items and weights must be of the same size");
  }

  if (!items.length) {
    throw new Error("Items must not be empty");
  }

  const cumulativeWeights = [];
  for (let i = 0; i < weights.length; i += 1) {
    cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0);
  }

  const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1];
  const randomNumber = maxCumulativeWeight * Math.random();

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    if (cumulativeWeights[itemIndex] >= randomNumber) {
      return {
        item: items[itemIndex],
        index: itemIndex,
      };
    }
  }
}

function createTransitionProbabilityMatrix(records) {
  const states = [];

  // Find the change between a statistic and it's
  // previous value.
  for (const i in records) {
    if (i === 0) continue;
    const x2 = records[i];
    const x1 = records[i - 1];

    const change = x2 - x1;
    states.push(change);
  }

  // Construct a table of frequency tables
  const tableOfFrequencyTables = {};

  for (const _i in states) {
    const i = Number(_i);

    const currentState = states[i];
    const nextState = states[i + 1];

    if (!nextState) continue;

    let frequencyTable = tableOfFrequencyTables[currentState];
    if (!frequencyTable) tableOfFrequencyTables[currentState] = {};

    let frequency = tableOfFrequencyTables[currentState][nextState];
    if (frequency === undefined)
      tableOfFrequencyTables[currentState][nextState] = 1;
    else tableOfFrequencyTables[currentState][nextState] = frequency + 1;
  }

  // Convert the frequencies to relative frequencies
  let tableOfRelativeFrequencyTables = {};

  for (const [currentState, table] of Object.entries(tableOfFrequencyTables)) {
    const total = Object.values(table).reduce((a, b) => a + b);

    tableOfRelativeFrequencyTables[currentState] = {};

    for (const [nextState, frequency] of Object.entries(
      tableOfFrequencyTables[currentState]
    )) {
      tableOfRelativeFrequencyTables[currentState][nextState] = Number(
        frequency / total
      ).toFixed(3);
    }
  }

  // Create the state space from all the states in
  // the table of relative frequencies.
  const stateSpace = Object.keys(tableOfRelativeFrequencyTables);

  // Create the transition probability matrix using
  // the transition probability matrix.
  const transitionProbabilityMatrix = [];

  for (const i in stateSpace) {
    transitionProbabilityMatrix[i] = [];
  }

  for (const i in stateSpace) {
    const currentState = stateSpace[i];
    for (const j in stateSpace) {
      const nextState = stateSpace[j];
      const probability =
        tableOfRelativeFrequencyTables[currentState][nextState];
      transitionProbabilityMatrix[j][i] = probability || 0;
    }
  }

  return [stateSpace, transitionProbabilityMatrix];
}

const fs = require("node:fs");
const { parse } = require("csv-parse");
const { multiply, matrix } = require("mathjs");

const records = [];

// Create a stream with read flags from the raw historical data
fs.createReadStream("./HistoricalData_1680608572393.csv")
  // Pipe the stream through the CSV parser
  .pipe(parse({ delimiter: ",", from_line: 2 }))
  .on("data", (row) => {
    const statistic = 1; // Close

    // Strip the dollar sign from the close statistic,
    // coerce it into a number, make it a whole integer
    // value, and add it to the records array.
    records.push(Number(row[statistic].slice(1)).toFixed(0));
  })
  .on("end", () => {
    // Create a Transition Probability Matrix.
    const [stateSpace, transitionProbabilityMatrix] =
      createTransitionProbabilityMatrix(records);
    const initialValue = 145; // Set the initial value of the stock.
    const initialChange = 1; // Set the initial change value.

    // Create an initial state vector that has a 100% probability
    // of being the initial change value.
    const initialStateVector = stateSpace.map((value) =>
      value === String(initialChange) ? [1] : [0]
    );

    let stateVector = null;
    let timeSteps = 19;

    // Create an array of state vectors for the Markov Chain.
    const markovChain = [];
    markovChain.push(initialStateVector);
    let length = timeSteps;
    length = length - 1;

    // Create a Markov Chain of the specified length.
    while (length > 0) {
      // Multiply the transition probability matrix
      // by the current state vector.
      stateVector = multiply(
        matrix(transitionProbabilityMatrix),
        matrix(stateVector || initialStateVector)
      ).toArray();

      // Add the new state vector to the Markov Chain.
      markovChain.push(stateVector.flat(1));

      length = length - 1;
    }

    const results = [];

    // Choose a random state using the weighted probabilities
    // of the state vector.
    for (const probability of markovChain) {
      results.push(weightedRandom(stateSpace, probability).item);
    }

    // Find the total change value.
    const totalChange =
      initialChange + results.reduce((a, b) => Number(a) + Number(b));

    console.log(`There will be a total change of ${totalChange}.`);
    console.log(
      `Stock A will cost approximately $${
        initialValue + totalChange
      } after ${timeSteps} time-steps.`
    );
  });
